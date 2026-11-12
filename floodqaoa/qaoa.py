"""QAOA circuits and training.

Variants
  A  X-mixer  + penalty QUBO   + expectation objective         (standard QAOA)
  B  X-mixer  + penalty QUBO   + CVaR_alpha objective          (Barkoutsos et al. 2020)
  C  XY-mixer + W-state init   + expectation objective         (constraint-preserving, Hadfield et al. 2019)
  D  XY-mixer + W-state init   + CVaR_alpha objective          (C + B combined)

The XY ring mixer exp(-i beta/2 (XX+YY)) on each team register preserves Hamming weight, so starting
from a W state (one team -> exactly one site, uniform superposition) the circuit never leaves the
one-hot subspace: the one-hot penalty is removed from the Hamiltonian and its qubits are not wasted
on infeasible states.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit.circuit import ParameterVector
from qiskit.circuit.library import StatePreparation
from qiskit.primitives import StatevectorSampler
from qiskit.quantum_info import SparsePauliOp, Statevector
from scipy.optimize import minimize

VARIANTS = {
    "A": dict(mixer="x", objective="expectation", label="QAOA (X-mixer, penalty)"),
    "B": dict(mixer="x", objective="cvar", label="CVaR-QAOA (X-mixer, penalty)"),
    "C": dict(mixer="xy", objective="expectation", label="XY-QAOA (constraint-preserving)"),
    "D": dict(mixer="xy", objective="cvar", label="XY-CVaR-QAOA (constraint-preserving)"),
}


def ising_diagonal(op: SparsePauliOp, offset: float) -> np.ndarray:
    """Exact energy of every computational basis state (Z-only operator), little-endian index."""
    n = op.num_qubits
    idx = np.arange(2 ** n)
    bits = (idx[:, None] >> np.arange(n)[None, :]) & 1
    zvals = 1 - 2 * bits  # Z eigenvalue: |0> -> +1, |1> -> -1
    diag = np.full(2 ** n, offset, dtype=float)
    for pauli, coeff in zip(op.paulis, op.coeffs):
        if np.any(pauli.x):
            raise ValueError("cost operator must be diagonal")
        mask = pauli.z
        diag += np.real(coeff) * np.prod(zvals[:, mask], axis=1)
    return diag


def build_qaoa_circuit(op: SparsePauliOp, T: int, S: int, p: int, mixer: str) -> QuantumCircuit:
    n = op.num_qubits
    gammas, betas = ParameterVector("gamma", p), ParameterVector("beta", p)
    qc = QuantumCircuit(n, name=f"QAOA_{mixer}_p{p}")
    # ---- initial state
    if mixer == "x":
        qc.h(range(n))
    else:
        w = np.zeros(2 ** S)
        w[[1 << k for k in range(S)]] = 1 / np.sqrt(S)
        for t in range(T):
            qc.append(StatePreparation(w), list(range(t * S, (t + 1) * S)))
    # ---- layers
    for k in range(p):
        qc.barrier()
        for pauli, coeff in zip(op.paulis, op.coeffs):
            qs = np.flatnonzero(pauli.z)
            c = float(np.real(coeff))
            if len(qs) == 1:
                qc.rz(2 * gammas[k] * c, int(qs[0]))
            elif len(qs) == 2:
                qc.rzz(2 * gammas[k] * c, int(qs[0]), int(qs[1]))
            elif len(qs) > 2:
                raise ValueError("only quadratic Ising terms expected")
        qc.barrier()
        if mixer == "x":
            qc.rx(2 * betas[k], range(n))
        else:
            ring = [(i, (i + 1) % S) for i in range(S)] if S > 2 else [(0, 1)]
            for start in (0, 1):  # even / odd edges (parity ordering)
                for t in range(T):
                    for (i, j) in ring[start::2]:
                        a, b = t * S + i, t * S + j
                        # exp(-i beta/2 (XX + YY)) ; XX and YY commute on the same pair
                        qc.rxx(betas[k], a, b)
                        qc.ryy(betas[k], a, b)
    return qc


@dataclass
class RunResult:
    variant: str
    lam: float
    p: int
    theta: np.ndarray
    final_objective: float
    n_evals: int
    history: list = field(default_factory=list)
    probs: np.ndarray | None = None
    counts: dict | None = None
    seconds: float = 0.0


class QAOARunner:
    def __init__(self, op: SparsePauliOp, offset: float, T: int, S: int, p: int,
                 mixer: str, objective: str, alpha: float = 0.1):
        self.op, self.offset, self.T, self.S, self.p = op, offset, T, S, p
        self.mixer, self.objective, self.alpha = mixer, objective, alpha
        self.diag = ising_diagonal(op, offset)
        self.circuit = build_qaoa_circuit(op, T, S, p, mixer)
        self.tqc = transpile(self.circuit, basis_gates=["rz", "rx", "ry", "rzz", "rxx", "ryy", "h", "cx", "u", "x", "sx"],
                             optimization_level=1)
        self._order = np.argsort(self.diag)
        self.history: list[float] = []

    # parameters are ordered [beta..., gamma...] by Qiskit (alphabetical); expose (gamma, beta)
    def _bind(self, theta):
        gam, bet = theta[: self.p], theta[self.p:]
        mapping = {}
        for prm in self.tqc.parameters:
            name, k = prm.name.split("[")[0], int(prm.name.split("[")[1][:-1])
            mapping[prm] = gam[k] if name == "gamma" else bet[k]
        return self.tqc.assign_parameters(mapping)

    def probabilities(self, theta) -> np.ndarray:
        return Statevector(self._bind(theta)).probabilities()

    def evaluate(self, probs) -> float:
        if self.objective == "expectation":
            return float(probs @ self.diag)
        # CVaR_alpha: mean energy of the best alpha-fraction of the distribution
        p_sorted, e_sorted = probs[self._order], self.diag[self._order]
        cum = np.cumsum(p_sorted)
        k = int(np.searchsorted(cum, self.alpha))
        mass_before = cum[k - 1] if k > 0 else 0.0
        val = float(p_sorted[:k] @ e_sorted[:k]) + (self.alpha - mass_before) * e_sorted[k]
        return val / self.alpha

    track_idx: np.ndarray | None = None  # optional: record probabilities of these basis states per evaluation

    def cost(self, theta) -> float:
        probs = self.probabilities(theta)
        val = self.evaluate(probs)
        self.history.append(val)
        if self.track_idx is not None:
            self.snaps.append(probs[self.track_idx].copy())
        return val

    def optimise(self, inits, maxiter=250, seed=0):
        best = None
        self.best_snaps = []
        for theta0 in inits:
            self.history, self.snaps = [], []
            res = minimize(self.cost, np.asarray(theta0, float), method="COBYLA",
                           options={"maxiter": maxiter, "rhobeg": 0.4})
            if best is None or res.fun < best[0].fun:
                best = (res, list(self.history))
                self.best_snaps = list(self.snaps)
        return best

    def sample(self, theta, shots, seed):
        qc = self._bind(theta).copy()
        qc.measure_all()
        result = StatevectorSampler(seed=seed).run([qc], shots=shots).result()
        counts = result[0].data.meas.get_counts()
        return {int(b, 2): c for b, c in counts.items()}


def default_inits(p: int, rng: np.random.Generator, n_random: int, warm=None):
    """Linear-ramp (annealing-like) start, optional warm start, plus random starts."""
    ramp = np.concatenate([np.linspace(0.1, 0.8, p) * 1.0, np.linspace(0.8, 0.1, p) * 0.6])
    inits = [ramp]
    if warm is not None:
        inits.insert(0, np.asarray(warm))
    for _ in range(n_random):
        inits.append(np.concatenate([rng.uniform(0, np.pi, p), rng.uniform(0, np.pi / 2, p)]))
    return inits


def run_variant(variant, op, offset, T, S, p, lam, shots=1024, seed=0, alpha=0.1,
                n_random=2, warm=None, maxiter=250, track_idx=None):
    cfg = VARIANTS[variant]
    t0 = time.perf_counter()
    runner = QAOARunner(op, offset, T, S, p, cfg["mixer"], cfg["objective"], alpha)
    runner.track_idx = track_idx
    rng = np.random.default_rng(seed)
    res, hist = runner.optimise(default_inits(p, rng, n_random, warm), maxiter=maxiter)
    probs = runner.probabilities(res.x)
    counts = runner.sample(res.x, shots, seed)
    return RunResult(variant, lam, p, res.x, float(res.fun), int(res.nfev), hist, probs, counts,
                     time.perf_counter() - t0), runner
