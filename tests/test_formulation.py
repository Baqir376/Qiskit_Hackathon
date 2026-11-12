import numpy as np
import pytest

from floodqaoa.baseline import enumerate_feasible, normalisers, scalarised
from floodqaoa.formulation import penalty_program, to_ising, generic_qubo
from floodqaoa.qaoa import QAOARunner, ising_diagonal
from floodqaoa.scenario import all_bitstrings, load_scenario

SC = load_scenario("data/sindh_2022.json")
F1MAX, F2MAX = normalisers(SC)
X_ALL = all_bitstrings(SC.n)
PENALTY = 2.0


def classical_qubo_values(lam, one_hot):
    """Penalised objective computed directly from the problem definition (no Qiskit)."""
    F = scalarised(SC.f1(X_ALL), SC.f2(X_ALL), lam, F1MAX, F2MAX)
    M = X_ALL.reshape(-1, SC.T, SC.S)
    per_site = M.sum(axis=1)                      # teams at each site
    pen = PENALTY * np.sum(per_site * (per_site - 1) / 2, axis=1)   # number of clashing pairs
    if one_hot:
        pen = pen + PENALTY * np.sum((M.sum(axis=2) - 1) ** 2, axis=1)
    return F + pen


@pytest.mark.parametrize("lam", [0.0, 0.3, 0.7, 1.0])
@pytest.mark.parametrize("one_hot", [True, False])
def test_ising_matches_definition(lam, one_hot):
    """Ising operator energies (qubit i = variable i) equal the hand-computed QUBO for all 4096 states."""
    op, off = to_ising(penalty_program(SC, lam, F1MAX, F2MAX, PENALTY, one_hot))
    assert op.num_qubits == SC.n == 12
    np.testing.assert_allclose(ising_diagonal(op, off), classical_qubo_values(lam, one_hot), atol=1e-9)
    # cross-check with Qiskit's dense matrix diagonal
    dense = np.real(op.to_matrix(sparse=True).diagonal()) + off
    np.testing.assert_allclose(dense, ising_diagonal(op, off), atol=1e-9)


@pytest.mark.parametrize("lam", np.linspace(0, 1, 11))
def test_penalty_ground_state_is_constrained_optimum(lam):
    """With P=2 the unconstrained QUBO minimum is feasible and equals the exact constrained optimum."""
    vals = classical_qubo_values(lam, True)
    g = int(np.argmin(vals))
    assert SC.is_feasible(X_ALL[g][None])[0]
    _, _, f1, f2 = enumerate_feasible(SC)
    assert np.isclose(vals[g], scalarised(f1, f2, lam, F1MAX, F2MAX).min())


def test_feasible_count():
    idx, *_ = enumerate_feasible(SC)
    assert len(idx) == 4 * 3 * 2  # injective maps 3 teams -> 4 sites


def test_xy_mixer_preserves_one_hot():
    op, off = to_ising(penalty_program(SC, 0.5, F1MAX, F2MAX, PENALTY, one_hot_penalty=False))
    r = QAOARunner(op, off, SC.T, SC.S, p=2, mixer="xy", objective="expectation")
    rng = np.random.default_rng(1)
    for _ in range(3):
        probs = r.probabilities(rng.uniform(0, np.pi, 4))
        M = X_ALL.reshape(-1, SC.T, SC.S)
        one_hot = np.all(M.sum(axis=2) == 1, axis=1)
        assert probs[one_hot].sum() == pytest.approx(1.0, abs=1e-9)


@pytest.mark.parametrize("lam", [0.0, 0.25, 0.5, 0.75, 1.0])
def test_agrees_with_qiskit_optimization_converter(lam):
    """Independent check: Qiskit's own constrained->QUBO converter has the same qubit count and optimum."""
    qubo = generic_qubo(SC, lam, F1MAX, F2MAX)
    assert qubo.get_num_vars() == SC.n
    op, off = qubo.to_ising()
    g = int(np.argmin(ising_diagonal(op, off)))
    _, _, f1, f2 = enumerate_feasible(SC)
    ours = classical_qubo_values(lam, True)
    assert SC.is_feasible(X_ALL[g][None])[0]
    assert np.isclose(ours[g], ours.min())
