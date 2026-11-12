"""QUBO / Ising formulation via qiskit-optimization.

minimise  F_lambda(x) = -(1-lam) f1(x)/f1max + lam f2(x)/f2max
          + P * sum_t (sum_s x[t,s] - 1)^2         (one-hot: every team dispatched once)   [only for X-mixer]
          + P * sum_s sum_{t<t'} x[t,s] x[t',s]     (capacity: at most one team per site)

The capacity penalty is written slack-free (pairwise products), so no auxiliary qubits are needed
(qiskit-optimization's QuadraticProgramToQubo reaches the same 12 qubits; tests cross-check both).
We build the penalties explicitly so the one-hot term can be dropped for the XY-mixer variants.
"""
from __future__ import annotations

from qiskit_optimization import QuadraticProgram
from qiskit_optimization.converters import QuadraticProgramToQubo

from .scenario import Scenario


def constrained_program(sc: Scenario, lam: float, f1max: float, f2max: float) -> QuadraticProgram:
    """The 'textbook' constrained model (used for documentation + qubit-count comparison)."""
    qp = QuadraticProgram("flood_dispatch")
    names = [sc.var_name(v) for v in range(sc.n)]
    for nm in names:
        qp.binary_var(nm)
    lin, quad = _objective_terms(sc, lam, f1max, f2max)
    qp.minimize(linear={names[v]: c for v, c in lin.items()},
                quadratic={(names[a], names[b]): c for (a, b), c in quad.items()})
    for t in range(sc.T):
        qp.linear_constraint({names[sc.var(t, s)]: 1 for s in range(sc.S)}, "==", 1, f"team_{sc.teams[t]['id']}")
    for s in range(sc.S):
        qp.linear_constraint({names[sc.var(t, s)]: 1 for t in range(sc.T)}, "<=", 1, f"site_{sc.sites[s]['id']}")
    return qp


def _objective_terms(sc: Scenario, lam, f1max, f2max):
    lin = {}
    for t in range(sc.T):
        for s in range(sc.S):
            v = sc.var(t, s)
            lin[v] = -(1 - lam) * sc.benefit[t, s] / f1max + lam * sc.travel_h[t, s] / f2max
    quad = {}
    for a, b in sc.congestion_pairs():
        quad[(a, b)] = quad.get((a, b), 0.0) + lam * sc.congestion_h / f2max
    return lin, quad


def penalty_program(sc: Scenario, lam: float, f1max: float, f2max: float,
                    penalty: float, one_hot_penalty: bool = True) -> QuadraticProgram:
    """Unconstrained QUBO with slack-free penalties.

    one_hot_penalty=False is used with the XY mixer, which enforces one-hot per team by construction.
    """
    lin, quad = _objective_terms(sc, lam, f1max, f2max)
    const = 0.0
    if one_hot_penalty:
        # P (sum_s x_s - 1)^2 = P (1 - sum_s x_s + 2 sum_{s<s'} x_s x_s')   using x^2 = x
        for t in range(sc.T):
            const += penalty
            for s in range(sc.S):
                v = sc.var(t, s)
                lin[v] = lin.get(v, 0.0) - penalty
                for s2 in range(s + 1, sc.S):
                    k = (v, sc.var(t, s2))
                    quad[k] = quad.get(k, 0.0) + 2 * penalty
    for s in range(sc.S):
        for t in range(sc.T):
            for t2 in range(t + 1, sc.T):
                k = (sc.var(t, s), sc.var(t2, s))
                quad[k] = quad.get(k, 0.0) + penalty
    qp = QuadraticProgram("flood_dispatch_qubo")
    names = [sc.var_name(v) for v in range(sc.n)]
    for nm in names:
        qp.binary_var(nm)
    qp.minimize(constant=const,
                linear={names[v]: c for v, c in lin.items()},
                quadratic={(names[a], names[b]): c for (a, b), c in quad.items()})
    return qp


def to_ising(qp: QuadraticProgram):
    """Returns (SparsePauliOp, offset). Variable i -> qubit i (verified in tests)."""
    return qp.to_ising()


def generic_qubo(sc: Scenario, lam, f1max, f2max, penalty=None):
    """qiskit-optimization's own constrained->QUBO conversion (independent cross-check)."""
    return QuadraticProgramToQubo(penalty=penalty).convert(constrained_program(sc, lam, f1max, f2max))
