"""GridQ problem instance, objectives (f1, f2, f3, J) and the independent feasibility checker.

Notation follows the specification:
    x[i, t] in {0,1}   feeder i ON during hour t
    D[i, t]            demand (MW), dt = 1 h
    U_i = sum_t D_it (1 - x_it) dt            unserved energy (MWh)
    rho_i = U_i / E_i,  E_i = sum_t D_it dt   normalised outage burden
    f1 = sum_i c_i U_i                        weighted unserved energy
    f2 = sum_(i,j,w) w (rho_i - rho_j)^2      fairness over comparable pairs
    f3 = sum_i sigma_i sum_t |x_it - x_i,t-1|  switching (t=1 uses x0 if given)
    J  = l1 f1/S1 + l2 f2/S2 + l3 f3/S3
Hard constraints: supply, availability, critical protection, min ON hours, max consecutive OFF
(with outage history), transformer capacity, optional max switches.
Arrays X may carry leading batch dimensions: shape (..., N, T).
"""
from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np


@dataclass
class Instance:
    name: str
    feeders: list[dict]                  # id, name, category, critical, c, min_on, max_off, sigma, transformer, ...
    D: np.ndarray                        # (N, T) MW
    avail: np.ndarray                    # (N, T) 0/1
    P: np.ndarray                        # (T,) available supply MW
    R: np.ndarray                        # (T,) reserve MW
    K: dict[str, float]                  # transformer -> capacity MW
    pairs: list[tuple[int, int, float]]  # fairness pairs (i, j, w)
    lambdas: tuple[float, float, float] = (1.0, 1.0, 1.0)
    scales: tuple[float, float, float] = (1.0, 1.0, 1.0)
    x0: np.ndarray | None = None         # (N,) state before hour 1 (for switching at t=1)
    off_history: np.ndarray | None = None  # (N,) consecutive OFF hours already accumulated before hour 1
    smax: np.ndarray | None = None       # (N,) optional max switches (MILP/feasibility only)
    dt: float = 1.0
    meta: dict = field(default_factory=dict)

    # ---- shapes / helpers
    @property
    def N(self) -> int:
        return self.D.shape[0]

    @property
    def T(self) -> int:
        return self.D.shape[1]

    @property
    def Pmax(self) -> np.ndarray:
        return self.P - self.R

    @property
    def E(self) -> np.ndarray:
        return self.D.sum(axis=1) * self.dt

    @property
    def c(self) -> np.ndarray:
        return np.array([f["c"] for f in self.feeders], float)

    @property
    def sigma(self) -> np.ndarray:
        return np.array([f["sigma"] for f in self.feeders], float)

    @property
    def critical(self) -> np.ndarray:
        return np.array([bool(f.get("critical", False)) for f in self.feeders])

    @property
    def min_on(self) -> np.ndarray:
        return np.array([int(f.get("min_on", 0)) for f in self.feeders])

    @property
    def max_off(self) -> np.ndarray:
        """L_i; a value >= T means 'no limit'."""
        return np.array([int(f.get("max_off", self.T)) for f in self.feeders])

    def transformer_members(self) -> dict[str, np.ndarray]:
        out: dict[str, list[int]] = {}
        for i, f in enumerate(self.feeders):
            if f.get("transformer"):
                out.setdefault(f["transformer"], []).append(i)
        return {k: np.array(v) for k, v in out.items()}

    def fixed(self) -> np.ndarray:
        """(N,T) array: 1 = fixed ON (critical & available), 0 = fixed OFF (unavailable), -1 = free."""
        fx = -np.ones((self.N, self.T), int)
        fx[self.avail == 0] = 0
        crit = self.critical[:, None] & (self.avail == 1)
        fx[crit] = 1
        return fx

    def validate(self) -> list[str]:
        """Data validation (spec §18.4). Returns a list of problems; empty means OK."""
        errs = []
        if (self.D < 0).any():
            errs.append("negative demand")
        if (self.P < 0).any() or (self.R < 0).any():
            errs.append("negative supply/reserve")
        if (self.R > self.P).any():
            errs.append("reserve exceeds supply in some hour")
        crit_load = (self.D * (self.critical[:, None] & (self.avail == 1))).sum(axis=0)
        for t in np.flatnonzero(crit_load > self.Pmax + 1e-9):
            errs.append(f"critical demand {crit_load[t]:.2f} MW exceeds usable supply {self.Pmax[t]:.2f} MW at hour {t + 1} (infeasible)")
        for j, mem in self.transformer_members().items():
            if j not in self.K:
                errs.append(f"transformer {j} has no capacity")
        for i, f in enumerate(self.feeders):
            if self.min_on[i] > int(self.avail[i].sum()):
                errs.append(f"{f['id']}: min_on {self.min_on[i]} exceeds available hours {int(self.avail[i].sum())}")
        for i, j, w in self.pairs:
            if self.E[i] <= 0 or self.E[j] <= 0:
                errs.append(f"fairness pair ({self.feeders[i]['id']},{self.feeders[j]['id']}) has zero demand")
            if w < 0:
                errs.append("negative fairness weight")
        return errs

    # ---- objectives (batched)
    def unserved(self, X: np.ndarray) -> np.ndarray:
        return ((1 - X) * self.D).sum(axis=-1) * self.dt              # (..., N)

    def rho(self, X: np.ndarray) -> np.ndarray:
        return self.unserved(X) / np.where(self.E > 0, self.E, 1.0)

    def f1(self, X):
        return self.unserved(X) @ self.c

    def f2(self, X):
        r = self.rho(X)
        out = np.zeros(X.shape[:-2])
        for i, j, w in self.pairs:
            out = out + w * (r[..., i] - r[..., j]) ** 2
        return out

    def switches(self, X: np.ndarray) -> np.ndarray:
        """(..., N) number of state changes, including hour 1 vs x0 when x0 is given."""
        s = np.abs(np.diff(X, axis=-1)).sum(axis=-1)
        if self.x0 is not None:
            s = s + np.abs(X[..., 0] - self.x0)
        return s

    def f3(self, X):
        return self.switches(X) @ self.sigma

    def J(self, X):
        l1, l2, l3 = self.lambdas
        s1, s2, s3 = self.scales
        return l1 * self.f1(X) / s1 + l2 * self.f2(X) / s2 + l3 * self.f3(X) / s3

    def breakdown(self, X) -> dict:
        X = np.asarray(X)
        return dict(f1=float(self.f1(X)), f2=float(self.f2(X)), f3=float(self.f3(X)), J=float(self.J(X)),
                    unserved_MWh=float(self.unserved(X).sum()), switches=int(self.switches(X).sum()))

    # ---- independent feasibility checker (spec §11.5, §29.7)
    def violations(self, X: np.ndarray, tol: float = 1e-9) -> dict[str, list]:
        X = np.asarray(X).astype(int)
        v: dict[str, list] = {k: [] for k in ("supply", "availability", "critical", "min_on", "max_off", "transformer", "switching")}
        load = (self.D * X).sum(axis=0)
        for t in np.flatnonzero(load > self.Pmax + tol):
            v["supply"].append((int(t), float(load[t]), float(self.Pmax[t])))
        for i, t in zip(*np.nonzero((X == 1) & (self.avail == 0))):
            v["availability"].append((int(i), int(t)))
        for i, t in zip(*np.nonzero((X == 0) & self.critical[:, None] & (self.avail == 1))):
            v["critical"].append((int(i), int(t)))
        for i in np.flatnonzero(X.sum(axis=1) < self.min_on):
            v["min_on"].append((int(i), int(X[i].sum()), int(self.min_on[i])))
        hist = np.zeros(self.N, int) if self.off_history is None else self.off_history
        for i in range(self.N):
            run, worst = int(hist[i]), 0
            for t in range(self.T):
                run = run + 1 if X[i, t] == 0 else 0
                worst = max(worst, run)
            if worst > self.max_off[i]:
                v["max_off"].append((int(i), worst, int(self.max_off[i])))
        for j, mem in self.transformer_members().items():
            tl = (self.D[mem] * X[mem]).sum(axis=0)
            for t in np.flatnonzero(tl > self.K[j] + tol):
                v["transformer"].append((j, int(t), float(tl[t]), float(self.K[j])))
        if self.smax is not None:
            sw = self.switches(X)
            for i in np.flatnonzero(sw > self.smax):
                v["switching"].append((int(i), int(sw[i]), int(self.smax[i])))
        return v

    def is_feasible(self, X) -> bool:
        return not any(self.violations(X).values())

    def is_feasible_batch(self, X: np.ndarray) -> np.ndarray:
        """Vectorised feasibility for a batch (B, N, T)."""
        X = np.asarray(X).astype(int)
        ok = np.ones(X.shape[0], bool)
        ok &= ((self.D * X).sum(axis=1) <= self.Pmax + 1e-9).all(axis=1)
        ok &= ~((X == 1) & (self.avail == 0)).any(axis=(1, 2))
        ok &= ~((X == 0) & (self.critical[:, None] & (self.avail == 1))).any(axis=(1, 2))
        ok &= (X.sum(axis=2) >= self.min_on).all(axis=1)
        hist = np.zeros(self.N, int) if self.off_history is None else self.off_history
        run = np.broadcast_to(hist, (X.shape[0], self.N)).copy()
        worst = run.copy()
        for t in range(self.T):
            run = np.where(X[:, :, t] == 0, run + 1, 0)
            worst = np.maximum(worst, run)
        ok &= (worst <= self.max_off).all(axis=1)
        for j, mem in self.transformer_members().items():
            ok &= ((self.D[mem] * X[:, mem]).sum(axis=1) <= self.K[j] + 1e-9).all(axis=1)
        if self.smax is not None:
            ok &= (self.switches(X) <= self.smax).all(axis=1)
        return ok


# ---------------------------------------------------------------- loaders / instances
def load_instance(folder: str | Path) -> Instance:
    """Load an instance from CSVs (spec §18): feeders.csv, demand_profiles.csv, supply_profiles.csv,
    transformers.csv, fairness_pairs.csv, config.json."""
    folder = Path(folder)
    rd = lambda n: list(csv.DictReader(open(folder / n, encoding="utf-8")))  # noqa: E731
    cfg = json.loads((folder / "config.json").read_text(encoding="utf-8"))
    feeders = []
    for r in rd("feeders.csv"):
        feeders.append(dict(id=r["feeder_id"], name=r["name"], category=r["category"],
                            critical=r["critical"].strip().lower() in ("1", "true", "yes"),
                            c=float(r["impact_weight"]), min_on=int(r["min_on_hours"]),
                            max_off=int(r["max_consecutive_off"]), sigma=float(r["switching_cost"]),
                            transformer=r["transformer_id"], atc_loss_pct=float(r.get("atc_loss_pct", 0) or 0)))
    idx = {f["id"]: k for k, f in enumerate(feeders)}
    dem = rd("demand_profiles.csv")
    T = max(int(r["hour"]) for r in dem)
    D = np.zeros((len(feeders), T))
    A = np.zeros((len(feeders), T), int)
    for r in dem:
        i, t = idx[r["feeder_id"]], int(r["hour"]) - 1
        D[i, t] = float(r["demand_mw"])
        A[i, t] = int(r["available"])
    sup = sorted(rd("supply_profiles.csv"), key=lambda r: int(r["hour"]))
    P = np.array([float(r["available_supply_mw"]) for r in sup])
    R = np.array([float(r["reserve_mw"]) for r in sup])
    K = {r["transformer_id"]: float(r["capacity_mw"]) for r in rd("transformers.csv")}
    pairs = [(idx[r["feeder_i"]], idx[r["feeder_j"]], float(r["weight"])) for r in rd("fairness_pairs.csv")]
    sc = cfg.get("scales", [1, 1, 1])
    inst = Instance(cfg["name"], feeders, D, A, P, R, K, pairs, tuple(cfg["lambdas"]), tuple(sc) if isinstance(sc, list) else (1.0, 1.0, 1.0),
                    meta=cfg.get("meta", {}))
    return inst


def mini_instance() -> Instance:
    """GridQ Mini (spec §10 / Part VII): hospital fixed ON, residential + factory, 2 hours, 2 MW supply.
    Spec fairness (U_R - U_F)^2 with weight 1 equals w*(rho_R - rho_F)^2 with w = 4 because E = 2 MWh."""
    feeders = [
        dict(id="H", name="Hospital", category="hospital", critical=True, c=10.0, min_on=0, max_off=2, sigma=0.0, transformer=""),
        dict(id="R", name="Residential", category="residential", critical=False, c=3.0, min_on=0, max_off=2, sigma=0.5, transformer=""),
        dict(id="F", name="Factory", category="industrial", critical=False, c=3.0, min_on=0, max_off=2, sigma=0.5, transformer=""),
    ]
    D = np.ones((3, 2))
    return Instance("GridQ Mini", feeders, D, np.ones((3, 2), int), np.array([2.0, 2.0]), np.zeros(2), {},
                    pairs=[(1, 2, 4.0)], lambdas=(1.0, 1.0, 1.0))
