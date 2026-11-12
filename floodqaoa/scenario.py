"""Scenario loading and the two competing objectives.

Decision variable x[t, s] = 1 if team t is dispatched to site s.
Qubit / variable index: v = t * S + s.

f1 (maximise): relief impact = sum_{t,s} benefit[t,s] * x[t,s]
f2 (minimise): response burden = sum_{t,s} travel_h[t,s] * x[t,s]
               + congestion_h * sum_{pairs sharing a corridor} x[a] * x[b]
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@dataclass
class Scenario:
    raw: dict
    teams: list
    sites: list
    benefit: np.ndarray      # (T, S)  thousand people-equivalents served
    travel_h: np.ndarray     # (T, S)  hours
    corridor: list           # [T][S]  corridor label
    congestion_h: float

    @property
    def T(self) -> int:
        return len(self.teams)

    @property
    def S(self) -> int:
        return len(self.sites)

    @property
    def n(self) -> int:
        return self.T * self.S

    def var(self, t: int, s: int) -> int:
        return t * self.S + s

    def var_name(self, v: int) -> str:
        t, s = divmod(v, self.S)
        return f"x_{self.teams[t]['id']}_{self.sites[s]['id']}"

    # ---- objectives -------------------------------------------------
    def congestion_pairs(self):
        """(a, b) variable pairs (different teams, same corridor) that congest."""
        pairs = []
        for t1 in range(self.T):
            for t2 in range(t1 + 1, self.T):
                for s1 in range(self.S):
                    for s2 in range(self.S):
                        if self.corridor[t1][s1] == self.corridor[t2][s2]:
                            pairs.append((self.var(t1, s1), self.var(t2, s2)))
        return pairs

    def f1(self, X: np.ndarray) -> np.ndarray:
        """Relief impact for a batch of bit-vectors X (..., n)."""
        return X @ self.benefit.reshape(-1)

    def f2(self, X: np.ndarray) -> np.ndarray:
        """Response burden (hours) for a batch of bit-vectors X (..., n)."""
        val = X @ self.travel_h.reshape(-1)
        for a, b in self.congestion_pairs():
            val = val + self.congestion_h * X[..., a] * X[..., b]
        return val

    def is_feasible(self, X: np.ndarray) -> np.ndarray:
        """Each team exactly one site; each site at most one team."""
        M = X.reshape(*X.shape[:-1], self.T, self.S)
        one_hot = np.all(M.sum(axis=-1) == 1, axis=-1)
        capacity = np.all(M.sum(axis=-2) <= 1, axis=-1)
        return one_hot & capacity

    def decode(self, x) -> list[tuple[str, str]]:
        x = np.asarray(x).reshape(self.T, self.S)
        plan = []
        for t in range(self.T):
            ss = np.flatnonzero(x[t])
            site = ",".join(self.sites[s]["id"] for s in ss) if len(ss) else "-"
            plan.append((self.teams[t]["id"], site))
        return plan


def load_scenario(path: str | Path) -> Scenario:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    teams, sites = raw["teams"], raw["sites"]
    T, S = len(teams), len(sites)
    benefit = np.zeros((T, S))
    travel = np.zeros((T, S))
    corridor = [[None] * S for _ in range(T)]
    for t, tm in enumerate(teams):
        cap = np.array(tm["capability"])
        for s, st in enumerate(sites):
            benefit[t, s] = st["people_k"] * float(cap @ np.array(st["needs"]))
            km = haversine_km(tm["lat"], tm["lon"], st["lat"], st["lon"]) * raw["road_factor"]
            travel[t, s] = km / raw["base_speed_kmh"] * st["access_factor"]
            corridor[t][s] = raw["corridors"][tm["id"]][st["id"]]
    return Scenario(raw, teams, sites, benefit, travel, corridor, raw["congestion_hours"])


def all_bitstrings(n: int) -> np.ndarray:
    """(2^n, n) array; row i is the bit-vector with bit k = (i >> k) & 1 (Qiskit little-endian)."""
    idx = np.arange(2 ** n)
    return ((idx[:, None] >> np.arange(n)[None, :]) & 1).astype(float)
