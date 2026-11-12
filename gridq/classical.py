"""Classical solvers on the ORIGINAL constrained model (same objective J, same hard constraints):

- exhaustive_solve : enumerate all free variables (ground truth for small instances)
- milp_solve       : exact MILP via HiGHS (scipy.optimize.milp). The quadratic fairness term is linearised
                     EXACTLY with y_kl = x_k x_l (y<=x_k, y<=x_l, y>=x_k+x_l-1); |x_t - x_{t-1}| via two
                     inequalities. Supports the optional max-switching limit.
- greedy_priority  : hour-by-hour, protect critical, then urgent (outage-limit) feeders, then by c_i*D_it
- greedy_atc       : emulates Pakistan's AT&C-loss-band load shedding: high-loss feeders are shed first
- anneal_solve     : simulated annealing on J + large constraint-violation penalty (documented budget)
"""
from __future__ import annotations

import itertools
import time

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import lil_matrix

from .model import Instance


def _free_index(inst: Instance):
    fx = inst.fixed()
    free = [(i, t) for i in range(inst.N) for t in range(inst.T) if fx[i, t] == -1]
    return fx, free


# ------------------------------------------------------------------ exhaustive
def exhaustive_solve(inst: Instance, max_free: int = 24, chunk: int = 1 << 16):
    fx, free = _free_index(inst)
    n = len(free)
    if n > max_free:
        raise ValueError(f"{n} free variables: too many for exhaustive search (limit {max_free})")
    base = np.where(fx == 1, 1, 0)
    best_J, best_X, n_feasible, optima = np.inf, None, 0, []
    rows = np.array([i for i, _ in free], int)
    cols = np.array([t for _, t in free], int)
    for start in range(0, 1 << n, chunk):
        idx = np.arange(start, min(start + chunk, 1 << n))
        bits = (idx[:, None] >> np.arange(n)[None, :]) & 1
        X = np.broadcast_to(base, (len(idx), inst.N, inst.T)).copy()
        X[:, rows, cols] = bits
        ok = inst.is_feasible_batch(X)
        n_feasible += int(ok.sum())
        if not ok.any():
            continue
        Jv = np.where(ok, inst.J(X), np.inf)
        m = Jv.min()
        if m < best_J - 1e-9:
            best_J, optima = m, []
        if np.isclose(m, best_J, atol=1e-9):
            for k in np.flatnonzero(np.isclose(Jv, best_J, atol=1e-9)):
                optima.append(X[k].copy())
            best_X = optima[0]
    return dict(X=best_X, J=float(best_J), optima=optima, n_feasible=n_feasible, n_free=n, n_total=1 << n)


# ------------------------------------------------------------------ MILP (exact, linearised)
def milp_solve(inst: Instance, time_limit: float = 120.0):
    t0 = time.perf_counter()
    N, T = inst.N, inst.T
    kf = np.array([float(f.get("feeder_cap", np.inf) or np.inf) for f in inst.feeders])
    clash = inst.critical[:, None] & (inst.avail == 1) & (inst.D > kf[:, None] + 1e-9)
    if clash.any():   # critical protection vs feeder thermal limit: infeasible, surfaced explicitly (spec 29.1)
        return dict(status=2, message="infeasible: critical feeder demand exceeds its thermal limit",
                    seconds=time.perf_counter() - t0, X=None, J=None, n_vars=0, n_cons=0, n_products=0)
    l1, l2, l3 = inst.lambdas
    s1, s2, s3 = inst.scales
    fx = inst.fixed()
    nx = N * T
    xi = lambda i, t: i * T + t  # noqa: E731
    # switching variables s[i,t] for t=1..T-1 (and t=0 if x0 given)
    s_list = [(i, t) for i in range(N) for t in range(0 if inst.x0 is not None else 1, T)]
    s_off = nx
    # fairness products
    prod_terms: dict[tuple[int, int], float] = {}
    lin = np.zeros(nx)
    const = 0.0
    E = np.where(inst.E > 0, inst.E, 1.0)   # E_i = 0 -> D_it = 0, contributes nothing (rho_i = 0), avoid 0/0
    for i in range(N):
        for t in range(T):
            lin[xi(i, t)] += -l1 / s1 * inst.c[i] * inst.D[i, t] * inst.dt
            const += l1 / s1 * inst.c[i] * inst.D[i, t] * inst.dt
    for (i, j, w) in inst.pairs:
        # rho_i - rho_j = sum_t (D_jt/E_j) x_jt - sum_t (D_it/E_i) x_it   (constants cancel: 1 - 1)
        g = {}
        for t in range(T):
            g[xi(j, t)] = g.get(xi(j, t), 0.0) + inst.D[j, t] * inst.dt / E[j]
            g[xi(i, t)] = g.get(xi(i, t), 0.0) - inst.D[i, t] * inst.dt / E[i]
        keys = sorted(g)
        coef = l2 / s2 * w
        # rho_k = k0_k - a_k with k0_k = 1 if E_k > 0 else 0 (rho = 0 for zero-demand feeders), so
        # rho_i - rho_j = cst + g.x  with cst = k0_i - k0_j ;  (cst + g.x)^2 = cst^2 + 2 cst g.x + (g.x)^2
        cst = float(inst.E[i] > 0) - float(inst.E[j] > 0)
        const += coef * cst ** 2
        for a in keys:
            lin[a] += coef * (g[a] ** 2 + 2 * cst * g[a])
        for a, b in itertools.combinations(keys, 2):
            prod_terms[(a, b)] = prod_terms.get((a, b), 0.0) + coef * 2 * g[a] * g[b]
    prods = [k for k, v in prod_terms.items() if abs(v) > 1e-15]
    y_off = s_off + len(s_list)
    nv = y_off + len(prods)
    cvec = np.zeros(nv)
    cvec[:nx] = lin
    for k, (i, t) in enumerate(s_list):
        cvec[s_off + k] = l3 / s3 * inst.sigma[i]
    for k, ab in enumerate(prods):
        cvec[y_off + k] = prod_terms[ab]

    rows, lo, hi = [], [], []
    A = lil_matrix((0, nv))

    def add(coefs: dict, lb, ub):
        rows.append(coefs); lo.append(lb); hi.append(ub)

    for t in range(T):
        add({xi(i, t): inst.D[i, t] for i in range(N)}, -np.inf, inst.Pmax[t])
    for j, mem in inst.transformer_members().items():
        for t in range(T):
            add({xi(i, t): inst.D[i, t] for i in mem}, -np.inf, inst.K[j])
    for i in range(N):
        if inst.min_on[i] > 0:
            add({xi(i, t): 1 for t in range(T)}, inst.min_on[i], np.inf)
        for win in inst.outage_windows(i):      # windows over available hours (history-aware)
            add({xi(i, k): 1 for k in win}, 1, np.inf)   # empty window -> 0 >= 1 -> infeasible
    for k, (i, t) in enumerate(s_list):
        if t == 0:
            add({s_off + k: 1, xi(i, 0): -1}, -inst.x0[i], np.inf)       # s >= x - x0
            add({s_off + k: 1, xi(i, 0): 1}, inst.x0[i], np.inf)         # s >= x0 - x
        else:
            add({s_off + k: 1, xi(i, t): -1, xi(i, t - 1): 1}, 0, np.inf)
            add({s_off + k: 1, xi(i, t): 1, xi(i, t - 1): -1}, 0, np.inf)
    if inst.smax is not None:
        for i in range(N):
            add({s_off + k: 1 for k, (ii, _) in enumerate(s_list) if ii == i}, -np.inf, inst.smax[i])
    for k, (a, b) in enumerate(prods):
        y = y_off + k
        add({y: 1, a: -1}, -np.inf, 0)
        add({y: 1, b: -1}, -np.inf, 0)
        add({y: 1, a: -1, b: -1}, -1, np.inf)
    A = lil_matrix((len(rows), nv))
    for r, coefs in enumerate(rows):
        for col, val in coefs.items():
            A[r, col] = val
    lb = np.zeros(nv)
    ub = np.ones(nv)
    for i in range(N):
        for t in range(T):
            if fx[i, t] == 1:
                lb[xi(i, t)] = 1
            elif fx[i, t] == 0:
                ub[xi(i, t)] = 0
    integrality = np.zeros(nv)
    integrality[:nx] = 1
    res = milp(cvec, constraints=LinearConstraint(A.tocsr(), lo, hi), integrality=integrality,
               bounds=Bounds(lb, ub), options={"time_limit": time_limit, "disp": False})
    out = dict(status=res.status, message=res.message, seconds=time.perf_counter() - t0,
               n_vars=nv, n_cons=len(rows), n_products=len(prods))
    if res.x is None:
        out.update(X=None, J=None)
        return out
    X = np.round(res.x[:nx]).astype(int).reshape(N, T)
    out.update(X=X, J=float(inst.J(X)), J_milp=float(res.fun + const), mip_gap=getattr(res, "mip_gap", None))
    return out


# ------------------------------------------------------------------ greedy baselines
def _greedy(inst: Instance, order_key):
    N, T = inst.N, inst.T
    X = np.zeros((N, T), int)
    run = np.zeros(N, int) if inst.off_history is None else inst.off_history.copy()
    on_count = np.zeros(N, int)
    members = inst.transformer_members()
    tr_of = {i: j for j, mem in members.items() for i in mem}
    fx = inst.fixed()
    for t in range(T):
        cap = inst.Pmax[t]
        tcap = dict(inst.K)
        def fits(i):
            if fx[i, t] == 0 or inst.D[i, t] > cap + 1e-9:
                return False
            j = tr_of.get(i)
            return j is None or inst.D[i, t] <= tcap[j] + 1e-9
        def take(i):
            nonlocal cap
            X[i, t] = 1; cap -= inst.D[i, t]
            j = tr_of.get(i)
            if j is not None:
                tcap[j] -= inst.D[i, t]
        # 1) critical, 2) feeders at their outage limit / behind on min-on, 3) policy order
        remaining_hours = T - t
        urgent = [i for i in range(N) if run[i] >= inst.max_off[i] or inst.min_on[i] - on_count[i] >= remaining_hours]
        for i in [i for i in range(N) if inst.critical[i]] + sorted(urgent, key=lambda i: -inst.c[i]) + sorted(range(N), key=lambda i: order_key(i, t)):
            if X[i, t] == 0 and fits(i):
                take(i)
        run = np.where(inst.avail[:, t] == 1, np.where(X[:, t] == 0, run + 1, 0), 0)
        on_count += X[:, t]
    return X


def greedy_priority(inst: Instance):
    """Conventional priority list: serve highest c_i*D_it first, hour by hour (no lookahead / fairness)."""
    X = _greedy(inst, lambda i, t: -inst.c[i] * inst.D[i, t])
    return dict(X=X, J=float(inst.J(X)), feasible=inst.is_feasible(X))


def greedy_atc(inst: Instance):
    """Pakistan-style AT&C-loss-based load shedding: feeders with higher AT&C losses are shed first."""
    loss = np.array([f.get("atc_loss_pct", 0.0) for f in inst.feeders])
    X = _greedy(inst, lambda i, t: (loss[i], -inst.c[i] * inst.D[i, t]))
    return dict(X=X, J=float(inst.J(X)), feasible=inst.is_feasible(X))


# ------------------------------------------------------------------ simulated annealing
def anneal_solve(inst: Instance, iters: int = 20000, seed: int = 0, t_start: float | None = None, t_end: float = 1e-3,
                 penalty: float | None = None, init: np.ndarray | None = None):
    """Single-bit-flip simulated annealing on J + penalty * (number of violated constraint instances).
    Budget = `iters` flips. Returns the best FEASIBLE schedule found (checked by the independent checker)."""
    rng = np.random.default_rng(seed)
    fx, free = _free_index(inst)
    X = np.where(fx == 1, 1, 0) if init is None else init.copy()
    if init is None:
        for (i, t) in free:
            X[i, t] = rng.integers(0, 2)
    scale = abs(inst.J(np.ones((inst.N, inst.T)) * (fx != 0))) + abs(inst.J(np.zeros((inst.N, inst.T)))) + 1.0
    pen = penalty if penalty is not None else 2.0 * scale
    def energy(Y):
        nv = sum(len(v) for v in inst.violations(Y).values())
        return inst.J(Y) + pen * nv
    e = energy(X)
    best_feas, best_J = None, np.inf
    t_start = t_start if t_start is not None else 0.1 * scale
    t0 = time.perf_counter()
    for k in range(iters):
        temp = t_start * (t_end / t_start) ** (k / max(1, iters - 1))
        i, t = free[rng.integers(len(free))]
        X[i, t] ^= 1
        e2 = energy(X)
        if e2 <= e or rng.random() < np.exp(-(e2 - e) / temp):
            e = e2
            if inst.is_feasible(X):
                Jx = float(inst.J(X))
                if Jx < best_J:
                    best_J, best_feas = Jx, X.copy()
        else:
            X[i, t] ^= 1
    return dict(X=best_feas, J=best_J if best_feas is not None else None, iters=iters, seconds=time.perf_counter() - t0)
