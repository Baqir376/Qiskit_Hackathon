"""GridQ M1-M2: objectives, feasibility checker, mini example, exact solvers (exhaustive vs MILP)."""
import itertools

import numpy as np
import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from gridq.classical import anneal_solve, exhaustive_solve, greedy_atc, greedy_priority, milp_solve
from gridq.model import Instance, mini_instance


def spec_mini_cost(v):
    """Verbatim from the specification (§10.8)."""
    r1, r2, f1, f2 = v
    u_r = (1 - r1) + (1 - r2); u_f = (1 - f1) + (1 - f2)
    return 3 * (u_r + u_f) + (u_r - u_f) ** 2 + 0.5 * ((r1 - r2) ** 2 + (f1 - f2) ** 2) + 10 * (r1 * f1 + r2 * f2)


def mini_X(v):
    r1, r2, f1, f2 = v
    return np.array([[1, 1], [r1, r2], [f1, f2]])


# ---------------- mini example (spec Part VII)
@pytest.mark.parametrize("v", list(itertools.product([0, 1], repeat=4)))
def test_mini_objective_matches_spec_on_every_bitstring(v):
    inst = mini_instance()
    X = mini_X(v)
    capacity = 10 * (v[0] * v[2] + v[1] * v[3])           # spec's product-form supply penalty
    assert inst.J(X) + capacity == pytest.approx(spec_mini_cost(v))
    assert inst.is_feasible(X) == (capacity == 0)


def test_mini_optimum_and_breakdown():
    inst = mini_instance()
    res = exhaustive_solve(inst)
    assert res["J"] == pytest.approx(7.0)
    got = sorted(tuple(X[1:].ravel()) for X in res["optima"])   # (r1, r2, f1, f2)
    assert got == [(0, 1, 1, 0), (1, 0, 0, 1)]
    b = inst.breakdown(res["X"])
    assert (b["f1"], b["f2"], b["f3"]) == pytest.approx((6.0, 0.0, 1.0))


def test_mini_milp_and_anneal_agree():
    inst = mini_instance()
    assert milp_solve(inst)["J"] == pytest.approx(7.0)
    assert anneal_solve(inst, iters=3000, seed=1)["J"] == pytest.approx(7.0)


# ---------------- feasibility checker edge cases
def _inst(D, P, max_off=None, min_on=None, crit=None, K=None, tr=None, x0=None, hist=None, smax=None, avail=None):
    D = np.asarray(D, float)
    N, T = D.shape
    feeders = [dict(id=f"F{i}", name=f"F{i}", category="residential", critical=bool(crit[i]) if crit else False, c=1.0,
                    min_on=(min_on[i] if min_on else 0), max_off=(max_off[i] if max_off else T), sigma=1.0,
                    transformer=(tr[i] if tr else "")) for i in range(N)]
    return Instance("t", feeders, D, np.ones((N, T), int) if avail is None else np.asarray(avail), np.asarray(P, float),
                    np.zeros(T), K or {}, [], x0=None if x0 is None else np.asarray(x0),
                    off_history=None if hist is None else np.asarray(hist), smax=None if smax is None else np.asarray(smax))


@pytest.mark.parametrize("row,ok", [([0, 0, 1, 1, 1], True), ([0, 0, 0, 1, 1], False), ([1, 0, 0, 0, 1], False), ([1, 1, 0, 0, 0], False), ([1, 0, 0, 1, 0], True)])
def test_max_consecutive_off_beginning_middle_end(row, ok):
    inst = _inst(np.ones((1, 5)), [9] * 5, max_off=[2])
    assert inst.is_feasible(np.array([row])) == ok
    assert inst.is_feasible_batch(np.array([[row]]))[0] == ok


def test_unavailable_hours_are_not_outages():
    inst = _inst(np.array([[0, 0, 0, 1, 1]], float), [9] * 5, max_off=[1], avail=np.array([[0, 0, 0, 1, 1]]))
    assert inst.is_feasible(np.array([[0, 0, 0, 1, 0]]))       # closed overnight is fine
    assert not inst.is_feasible(np.array([[0, 0, 0, 0, 0]]))   # 2 available OFF hours > 1


def test_outage_history_carries_over():
    inst = _inst(np.ones((1, 4)), [9] * 4, max_off=[2], hist=[2])
    assert not inst.is_feasible(np.array([[0, 1, 1, 1]]))   # 2 earlier + 1 = 3 > 2
    assert inst.is_feasible(np.array([[1, 0, 0, 1]]))


def test_switching_counts_initial_state():
    inst = _inst(np.ones((1, 3)), [9] * 3, x0=[0])
    assert inst.switches(np.array([[1, 1, 0]]))[0] == 2      # 0->1 at t=1, 1->0 at t=3


def test_critical_infeasibility_is_reported():
    inst = _inst([[5, 5], [1, 1]], [4, 9], crit=[1, 0])
    assert any("critical demand" in e for e in inst.validate())


def test_transformer_and_supply_violations_detected():
    inst = _inst([[2, 2], [2, 2]], [10, 3], K={"T1": 3}, tr=["T1", "T1"])
    v = inst.violations(np.array([[1, 1], [1, 1]]))
    assert v["supply"] and v["transformer"]


# ---------------- exact-solver agreement on random instances (property-based)
@st.composite
def random_instances(draw):
    N = draw(st.integers(2, 4)); T = draw(st.integers(2, 4))
    D = np.array(draw(st.lists(st.integers(1, 4), min_size=N * T, max_size=N * T)), float).reshape(N, T)
    P = np.array(draw(st.lists(st.integers(2, 10), min_size=T, max_size=T)), float)
    crit = [draw(st.booleans()) if i == 0 else False for i in range(N)]
    max_off = [draw(st.integers(1, T)) for _ in range(N)]
    min_on = [draw(st.integers(0, max(0, T - 2))) for _ in range(N)]
    tr = [draw(st.sampled_from(["A", "B"])) for _ in range(N)]
    K = {"A": float(draw(st.integers(2, 10))), "B": float(draw(st.integers(2, 10)))}
    x0 = [draw(st.integers(0, 1)) for _ in range(N)] if draw(st.booleans()) else None
    hist = [draw(st.integers(0, 1)) for _ in range(N)] if draw(st.booleans()) else None
    smax = [draw(st.integers(0, T)) for _ in range(N)] if draw(st.booleans()) else None
    avail = np.array(draw(st.lists(st.sampled_from([1, 1, 1, 0]), min_size=N * T, max_size=N * T))).reshape(N, T)
    avail[0] = 1 if crit[0] else avail[0]
    D = D * avail                                       # no demand while unavailable
    inst = _inst(D, P, max_off=max_off, min_on=min_on, crit=crit, K=K, tr=tr, x0=x0, hist=hist, smax=smax, avail=avail)
    for i, f in enumerate(inst.feeders):
        f["min_on"] = min(f["min_on"], int(avail[i].sum()))
        if draw(st.booleans()):
            f["feeder_cap"] = float(draw(st.integers(1, 4)))
    for f in inst.feeders:
        f["c"] = float(draw(st.integers(1, 10))); f["sigma"] = float(draw(st.integers(0, 3)))
    if N >= 2:
        inst.pairs = [(0, 1, float(draw(st.integers(1, 20))))] + ([(1, 2, 5.0)] if N >= 3 else [])
    inst.lambdas = (1.0, float(draw(st.integers(0, 30))), float(draw(st.integers(0, 3))))
    return inst


@settings(max_examples=60, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(inst=random_instances())
def test_milp_equals_exhaustive_on_random_instances(inst):
    ex = exhaustive_solve(inst)
    mi = milp_solve(inst)
    if ex["X"] is None:
        assert mi["X"] is None                              # both report infeasibility
    else:
        assert mi["X"] is not None and inst.is_feasible(mi["X"])
        assert mi["J"] == pytest.approx(ex["J"], abs=1e-6)
        assert mi["J_milp"] == pytest.approx(ex["J"], abs=1e-6)   # linearisation is exact


def test_greedy_baselines_run_and_are_checked():
    inst = mini_instance()
    for g in (greedy_priority, greedy_atc):
        r = g(inst)
        assert r["X"].shape == (3, 2) and r["feasible"] == inst.is_feasible(r["X"])


# ---------------- strong exact solvers (CP-SAT, SCIP) agree with exhaustive search
@settings(max_examples=40, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(inst=random_instances())
def test_cpsat_and_scip_equal_exhaustive(inst):
    from gridq.exact import cpsat_solve, scip_solve
    ex = exhaustive_solve(inst)
    cp = cpsat_solve(inst, time_limit=20, workers=4)
    sc = scip_solve(inst, time_limit=20)
    if ex["X"] is None:
        assert cp["X"] is None and sc["X"] is None
    else:
        assert inst.is_feasible(cp["X"]) and inst.is_feasible(sc["X"])
        # CP-SAT optimises integer-rounded weights (rel. error < 1/(2*COEF_RES)); allow that tolerance
        assert cp["J"] == pytest.approx(ex["J"], rel=1e-3, abs=1e-6)
        assert sc["J"] == pytest.approx(ex["J"], rel=1e-6, abs=1e-6)


def test_cityx_exact_solvers_agree_and_beat_current_practice():
    from gridq.exact import cpsat_solve, scip_solve
    from gridq.instances import pakistan_instance
    inst = pakistan_instance("severe")
    assert not inst.validate()
    cp = cpsat_solve(inst, time_limit=60, workers=8)
    sc = scip_solve(inst, time_limit=60)
    assert cp["status"] == "OPTIMAL" and inst.is_feasible(cp["X"])
    assert sc["J"] == pytest.approx(cp["J"], rel=1e-4)
    atc = greedy_atc(inst)
    assert atc["J"] == pytest.approx(3.0)           # scales are taken from current practice
    assert cp["J"] < 0.6 * atc["J"]
