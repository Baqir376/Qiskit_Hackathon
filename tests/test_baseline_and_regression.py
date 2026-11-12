"""Unit tests for the classical baseline + regression/reproducibility tests against committed results."""
import json
from pathlib import Path

import numpy as np
import pytest

from floodqaoa.baseline import (enumerate_feasible, greedy_dispatch, hypervolume, normalisers, pareto_mask,
                                scalarised, supported_mask)
from floodqaoa.formulation import penalty_program, to_ising
from floodqaoa.qaoa import VARIANTS, run_variant
from floodqaoa.scenario import haversine_km, load_scenario

SC = load_scenario("data/sindh_2022.json")
F1MAX, F2MAX = normalisers(SC)
R = json.loads(Path("results/results.json").read_text())


# ---------------- unit: baseline helpers ----------------
def test_haversine_known_distance():
    # Karachi (24.86, 67.01) -> Lahore (31.55, 74.34): ~1,030 km great-circle
    assert 1000 < haversine_km(24.86, 67.01, 31.55, 74.34) < 1060


def test_pareto_mask_simple():
    f1 = np.array([1, 2, 3, 2.5])      # maximise
    f2 = np.array([1, 2, 3, 3.5])      # minimise
    assert pareto_mask(f1, f2).tolist() == [True, True, True, False]


def test_hypervolume_single_and_two_points():
    assert hypervolume([2], [1], 0, 3) == pytest.approx(4.0)            # 2 x 2 box
    # union of [0,2]x[2,3] (area 2) and [0,1]x[1,3] (area 2) overlapping in [0,1]x[2,3] (area 1) = 3
    assert hypervolume([2, 1], [2, 1], 0, 3) == pytest.approx(3.0)


def test_unsupported_point_exists_and_is_detected():
    _, _, f1, f2 = enumerate_feasible(SC)
    pm, sm = pareto_mask(f1, f2), supported_mask(f1, f2, F1MAX, F2MAX)
    assert pm.sum() == 4 and (pm & ~sm).sum() == 1


@pytest.mark.parametrize("lam", np.linspace(0, 1, 11))
def test_greedy_always_feasible(lam):
    x = greedy_dispatch(SC, lam, F1MAX, F2MAX)
    assert SC.is_feasible(x[None])[0]


# ---------------- regression: committed results ----------------
def test_results_file_matches_brute_force():
    _, _, f1, f2 = enumerate_feasible(SC)
    assert R["meta"]["n_feasible"] == 24
    np.testing.assert_allclose(R["exact"]["f1"], f1)
    np.testing.assert_allclose(R["exact"]["f2"], f2)


def test_headline_numbers_regression():
    """Guard the numbers quoted in the report/README/website against silent drift."""
    mean = lambda v, k: np.mean([m[k] for m in R["sweep"] if m["variant"] == v])
    assert mean("D", "p_opt_exact") > mean("C", "p_opt_exact") > mean("B", "p_opt_exact") > mean("A", "p_opt_exact")
    assert mean("C", "feasible_ratio_exact") > 0.95
    assert sum(m["found_optimum"] for m in R["sweep"] if m["variant"] == "D") == 11
    assert sum(g["optimal"] for g in R["greedy"]) == 5


@pytest.mark.parametrize("v", list(VARIANTS))
def test_reproducible_rerun_matches_committed_result(v):
    """Integration + reproducibility: re-running the pipeline at lambda=0 with the same seed reproduces
    the committed P(optimal) exactly (no warm start at the first lambda)."""
    lam = 0.0
    op, off = to_ising(penalty_program(SC, lam, F1MAX, F2MAX, R["meta"]["penalty"], VARIANTS[v]["mixer"] == "x"))
    res, _ = run_variant(v, op, off, SC.T, SC.S, R["meta"]["p"], lam, shots=R["meta"]["shots"], seed=R["meta"]["seed"], n_random=2)
    ref = next(m for m in R["sweep"] if m["variant"] == v and m["lam"] == lam)
    idx, _, f1, f2 = enumerate_feasible(SC)
    F = scalarised(f1, f2, lam, F1MAX, F2MAX)
    p_opt = res.probs[idx[np.isclose(F, F.min())]].sum()
    assert p_opt == pytest.approx(ref["p_opt_exact"], abs=1e-9)


def test_same_seed_same_shots():
    op, off = to_ising(penalty_program(SC, 0.5, F1MAX, F2MAX, 2.0, False))
    a, _ = run_variant("C", op, off, SC.T, SC.S, 1, 0.5, shots=256, seed=3, n_random=0, maxiter=30)
    b, _ = run_variant("C", op, off, SC.T, SC.S, 1, 0.5, shots=256, seed=3, n_random=0, maxiter=30)
    assert a.counts == b.counts
