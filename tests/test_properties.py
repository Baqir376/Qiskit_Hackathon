"""Property-based tests (Hypothesis): the QUBO -> Ising mapping must be correct for ANY scenario,
not just the Sindh instance. Hypothesis generates random teams/sites/benefits/travel/corridors."""
import json

import numpy as np
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from floodqaoa.baseline import enumerate_feasible, scalarised
from floodqaoa.formulation import penalty_program, to_ising
from floodqaoa.qaoa import QAOARunner, ising_diagonal
from floodqaoa.scenario import Scenario, all_bitstrings

CORRIDORS = ["N55", "N65", "M9"]


@st.composite
def scenarios(draw):
    T = draw(st.integers(2, 3))
    S = draw(st.integers(T, 4))           # need S >= T for a feasible injective plan
    benefit = np.array(draw(st.lists(st.floats(1, 100), min_size=T * S, max_size=T * S))).reshape(T, S)
    travel = np.array(draw(st.lists(st.floats(0.5, 15), min_size=T * S, max_size=T * S))).reshape(T, S)
    corridor = [[draw(st.sampled_from(CORRIDORS)) for _ in range(S)] for _ in range(T)]
    cong = draw(st.floats(0, 3))
    teams = [{"id": f"T{t}"} for t in range(T)]
    sites = [{"id": f"S{s}"} for s in range(S)]
    return Scenario({}, teams, sites, benefit, travel, corridor, cong)


def direct_energy(sc, X, lam, f1max, f2max, P, one_hot):
    F = scalarised(sc.f1(X), sc.f2(X), lam, f1max, f2max)
    M = X.reshape(-1, sc.T, sc.S)
    per_site = M.sum(axis=1)
    pen = P * np.sum(per_site * (per_site - 1) / 2, axis=1)
    if one_hot:
        pen = pen + P * np.sum((M.sum(axis=2) - 1) ** 2, axis=1)
    return F + pen


@settings(max_examples=40, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(sc=scenarios(), lam=st.floats(0, 1), one_hot=st.booleans())
def test_ising_equals_definition_for_any_scenario(sc, lam, one_hot):
    _, _, f1, f2 = enumerate_feasible(sc)
    f1max, f2max = float(f1.max()), float(f2.max())
    op, off = to_ising(penalty_program(sc, lam, f1max, f2max, 2.0, one_hot))
    X = all_bitstrings(sc.n)
    np.testing.assert_allclose(ising_diagonal(op, off), direct_energy(sc, X, lam, f1max, f2max, 2.0, one_hot), atol=1e-8)


@settings(max_examples=40, deadline=None)
@given(sc=scenarios(), lam=st.floats(0, 1))
def test_large_penalty_ground_state_is_feasible_optimum(sc, lam):
    _, _, f1, f2 = enumerate_feasible(sc)
    f1max, f2max = float(f1.max()), float(f2.max())
    # normalised objective lies in [-1, 1+congestion share]; P = 4 exceeds any possible gain from violating
    op, off = to_ising(penalty_program(sc, lam, f1max, f2max, 4.0, True))
    diag = ising_diagonal(op, off)
    g = int(np.argmin(diag))
    X = all_bitstrings(sc.n)
    assert sc.is_feasible(X[g][None])[0]
    assert np.isclose(diag[g], scalarised(f1, f2, lam, f1max, f2max).min())


@settings(max_examples=15, deadline=None)
@given(theta=st.lists(st.floats(-np.pi, np.pi), min_size=4, max_size=4), lam=st.floats(0, 1))
def test_xy_mixer_never_leaves_one_hot_subspace(theta, lam):
    from floodqaoa.scenario import load_scenario
    sc = load_scenario("data/sindh_2022.json")
    _, _, f1, f2 = enumerate_feasible(sc)
    op, off = to_ising(penalty_program(sc, lam, float(f1.max()), float(f2.max()), 2.0, False))
    probs = QAOARunner(op, off, sc.T, sc.S, 2, "xy", "expectation").probabilities(np.array(theta))
    M = all_bitstrings(sc.n).reshape(-1, sc.T, sc.S)
    assert probs[np.all(M.sum(axis=2) == 1, axis=1)].sum() > 1 - 1e-9


@settings(max_examples=15, deadline=None)
@given(theta=st.lists(st.floats(-np.pi, np.pi), min_size=4, max_size=4))
def test_statevector_is_normalised(theta):
    from floodqaoa.scenario import load_scenario
    sc = load_scenario("data/sindh_2022.json")
    _, _, f1, f2 = enumerate_feasible(sc)
    for mixer, oh in (("x", True), ("xy", False)):
        op, off = to_ising(penalty_program(sc, 0.5, float(f1.max()), float(f2.max()), 2.0, oh))
        p = QAOARunner(op, off, sc.T, sc.S, 2, mixer, "expectation").probabilities(np.array(theta))
        assert abs(p.sum() - 1) < 1e-9


def test_cvar_alpha_one_equals_expectation():
    """CVaR_1 must reduce to the plain expectation value (analytical identity)."""
    from floodqaoa.scenario import load_scenario
    sc = load_scenario("data/sindh_2022.json")
    _, _, f1, f2 = enumerate_feasible(sc)
    op, off = to_ising(penalty_program(sc, 0.5, float(f1.max()), float(f2.max()), 2.0, True))
    th = np.array([0.3, 0.7, 0.4, 0.2])
    a = QAOARunner(op, off, sc.T, sc.S, 2, "x", "cvar", alpha=1.0)
    b = QAOARunner(op, off, sc.T, sc.S, 2, "x", "expectation")
    assert np.isclose(a.cost(th), b.cost(th), atol=1e-9)
    json.dumps({})
