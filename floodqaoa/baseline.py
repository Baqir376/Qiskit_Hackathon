"""Exact / classical references: brute force, Pareto front, hypervolume, greedy dispatcher."""
from __future__ import annotations

import itertools

import numpy as np

from .scenario import Scenario, all_bitstrings


def enumerate_feasible(sc: Scenario):
    """All feasible assignments (exhaustive over 2^n) with their objective values."""
    X = all_bitstrings(sc.n)
    feas = sc.is_feasible(X)
    idx = np.flatnonzero(feas)
    Xf = X[idx]
    return idx, Xf, sc.f1(Xf), sc.f2(Xf)


def normalisers(sc: Scenario):
    _, _, f1, f2 = enumerate_feasible(sc)
    return float(f1.max()), float(f2.max())


def scalarised(f1, f2, lam, f1max, f2max):
    """F_lambda = -(1 - lam) * f1/f1max + lam * f2/f2max   (to minimise)."""
    return -(1 - lam) * np.asarray(f1) / f1max + lam * np.asarray(f2) / f2max


def pareto_mask(f1, f2):
    """Non-dominated points for (maximise f1, minimise f2)."""
    f1, f2 = np.asarray(f1), np.asarray(f2)
    keep = np.ones(len(f1), bool)
    for i in range(len(f1)):
        dom = (f1 >= f1[i]) & (f2 <= f2[i]) & ((f1 > f1[i]) | (f2 < f2[i]))
        if dom.any():
            keep[i] = False
    return keep


def hypervolume(f1, f2, ref_f1, ref_f2):
    """2-D hypervolume dominated by points (max f1, min f2) w.r.t. reference (ref_f1 low, ref_f2 high)."""
    pts = sorted({(float(a), float(b)) for a, b in zip(f1, f2) if a > ref_f1 and b < ref_f2},
                 key=lambda p: -p[0])
    hv, best_f2 = 0.0, ref_f2
    for a, b in pts:  # descending f1
        if b < best_f2:
            # strip between this point's f1 and the reference, from b up to best_f2
            hv += (a - ref_f1) * (best_f2 - b)
            best_f2 = b
    return hv


def supported_mask(f1, f2, f1max, f2max, lams=np.linspace(0, 1, 1001)):
    """Pareto points reachable by some weighted-sum scalarisation (convex hull)."""
    f1, f2 = np.asarray(f1), np.asarray(f2)
    hit = np.zeros(len(f1), bool)
    for lam in lams:
        F = scalarised(f1, f2, lam, f1max, f2max)
        hit[np.flatnonzero(np.isclose(F, F.min(), atol=1e-12))] = True
    return hit


def greedy_dispatch(sc: Scenario, lam, f1max, f2max):
    """A dispatcher's rule of thumb: repeatedly take the best remaining (team, site) pair by
    single-pair scalarised score (ignores congestion interactions)."""
    score = -(1 - lam) * sc.benefit / f1max + lam * sc.travel_h / f2max
    x = np.zeros((sc.T, sc.S))
    free_t, free_s = set(range(sc.T)), set(range(sc.S))
    while free_t:
        t, s = min(((t, s) for t in free_t for s in free_s), key=lambda p: score[p])
        x[t, s] = 1
        free_t.discard(t)
        free_s.discard(s)
    return x.reshape(-1)


def count_feasible_by_permutation(sc: Scenario) -> int:
    return len(list(itertools.permutations(range(sc.S), sc.T)))
