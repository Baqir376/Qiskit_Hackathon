"""Exact solvers for the full GridQ model (quadratic fairness objective) beyond the reach of enumeration.

cpsat_solve : Google OR-Tools CP-SAT. Integer model: with integer MW demands, the fairness difference
              diff_ij = U_i E_j - U_j E_i is an integer, so sq_ij = diff_ij^2 is modelled EXACTLY with
              AddMultiplicationEquality. Only the real objective weights are scaled to integers; the
              relative rounding of every weight is < 1/(2*COEF_RES). The returned schedule is always
              re-scored with the true J, and the solver's bound is mapped back to J units.
scip_solve  : SCIP via PySCIPOpt with real coefficients; the convex quadratic fairness term enters through
              an epigraph variable (z >= sum w (rho_i - rho_j)^2). Reports the proven optimality gap.
Both use the same constraints as the MILP / feasibility checker (supply, transformer, min-on,
availability-aware max-outage windows with history, critical, thermal limit, optional switch limit).
"""
from __future__ import annotations

import time

import numpy as np

from .model import Instance

COEF_RES = 2000


def _check_integer_demand(inst: Instance):
    if not np.allclose(inst.D, np.round(inst.D)):
        raise ValueError("CP-SAT model needs integer demand units; rescale D (e.g. to 0.5 MW units)")


def cpsat_solve(inst: Instance, time_limit: float = 120.0, workers: int = 8, hint: np.ndarray | None = None, seed: int = 0):
    from ortools.sat.python import cp_model
    _check_integer_demand(inst)
    t0 = time.perf_counter()
    N, T = inst.N, inst.T
    D = np.round(inst.D).astype(int)
    E = D.sum(axis=1)
    fx = inst.fixed()
    m = cp_model.CpModel()
    x = [[m.NewBoolVar(f"x{i}_{t}") for t in range(T)] for i in range(N)]
    for i in range(N):
        for t in range(T):
            if fx[i, t] == 1:
                m.Add(x[i][t] == 1)
            elif fx[i, t] == 0:
                m.Add(x[i][t] == 0)
    # constraints
    for t in range(T):
        m.Add(sum(int(D[i, t]) * x[i][t] for i in range(N)) <= int(np.floor(inst.Pmax[t] + 1e-9)))
    for j, mem in inst.transformer_members().items():
        for t in range(T):
            m.Add(sum(int(D[i, t]) * x[i][t] for i in mem) <= int(np.floor(inst.K[j] + 1e-9)))
    for i in range(N):
        if inst.min_on[i] > 0:
            m.Add(sum(x[i]) >= int(inst.min_on[i]))
        for win in inst.outage_windows(i):
            m.Add(sum(x[i][k] for k in win) >= 1) if win else m.Add(0 >= 1)
    kf = np.array([float(f.get("feeder_cap", np.inf) or np.inf) for f in inst.feeders])
    if (inst.critical[:, None] & (inst.avail == 1) & (inst.D > kf[:, None] + 1e-9)).any():
        return dict(status="INFEASIBLE", X=None, J=None, seconds=time.perf_counter() - t0)
    # switching
    sw = {}
    for i in range(N):
        prev = None if inst.x0 is None else int(inst.x0[i])
        for t in range(T):
            if t == 0 and prev is None:
                continue
            s = m.NewBoolVar(f"s{i}_{t}")
            a = x[i][t]
            b = x[i][t - 1] if t > 0 else prev
            m.Add(s >= a - b) if t > 0 else m.Add(s >= a - prev)
            m.Add(s >= b - a) if t > 0 else m.Add(s >= prev - a)
            sw[(i, t)] = s
    if inst.smax is not None:
        for i in range(N):
            m.Add(sum(s for (ii, _), s in sw.items() if ii == i) <= int(inst.smax[i]))
    # objective pieces
    U = [sum(int(D[i, t]) * (1 - x[i][t]) for t in range(T)) for i in range(N)]
    l1, l2, l3 = inst.lambdas
    s1, s2, s3 = inst.scales
    terms = []                                   # (real coefficient, linear/int expr)
    for i in range(N):
        terms.append((l1 / s1 * inst.c[i] * inst.dt, U[i]))
    for (i, t), s in sw.items():
        terms.append((l3 / s3 * inst.sigma[i], s))
    for (i, j, w) in inst.pairs:
        if E[i] <= 0 and E[j] <= 0:
            continue
        if E[i] <= 0 or E[j] <= 0:              # rho of the zero-demand feeder is 0
            k = j if E[i] <= 0 else i
            d = m.NewIntVar(0, int(E[k]), f"u{k}")
            m.Add(d == U[k])
            sq = m.NewIntVar(0, int(E[k]) ** 2, f"sq{i}_{j}")
            m.AddMultiplicationEquality(sq, [d, d])
            terms.append((l2 / s2 * w / float(E[k]) ** 2, sq))
            continue
        bound = int(E[i] * E[j])
        d = m.NewIntVar(-bound, bound, f"d{i}_{j}")
        m.Add(d == U[i] * int(E[j]) - U[j] * int(E[i]))
        sq = m.NewIntVar(0, bound * bound, f"sq{i}_{j}")
        m.AddMultiplicationEquality(sq, [d, d])
        terms.append((l2 / s2 * w / (float(E[i]) * float(E[j])) ** 2, sq))
    coefs = np.array([c for c, _ in terms if c > 0])
    scale = COEF_RES / coefs.min() if len(coefs) else 1.0
    m.Minimize(sum(int(round(c * scale)) * e for c, e in terms if c > 0))
    if hint is not None:
        for i in range(N):
            for t in range(T):
                m.AddHint(x[i][t], int(hint[i, t]))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit)
    solver.parameters.num_search_workers = int(workers)
    solver.parameters.random_seed = int(seed)
    st = solver.Solve(m)
    name = solver.StatusName(st)
    out = dict(status=name, seconds=time.perf_counter() - t0, X=None, J=None)
    if st in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        X = np.array([[int(solver.Value(x[i][t])) for t in range(T)] for i in range(N)])
        const = sum(l1 / s1 * inst.c[i] * inst.dt * 0 for i in range(N))   # U already absolute: no constant
        out.update(X=X, J=float(inst.J(X)), bound_J=float(solver.BestObjectiveBound() / scale + const),
                   objective_J=float(solver.ObjectiveValue() / scale + const), scale=scale,
                   max_rel_rounding=float(np.max(np.abs(np.round(coefs * scale) - coefs * scale) / (coefs * scale))))
    return out


def scip_solve(inst: Instance, time_limit: float = 120.0, gap: float = 0.0, hint: np.ndarray | None = None, quiet: bool = True):
    from pyscipopt import Model, quicksum
    t0 = time.perf_counter()
    N, T = inst.N, inst.T
    fx = inst.fixed()
    m = Model("gridq")
    if quiet:
        m.hideOutput()
    m.setParam("limits/time", float(time_limit))
    m.setParam("limits/gap", float(gap))
    x = {}
    for i in range(N):
        for t in range(T):
            lb = 1 if fx[i, t] == 1 else 0
            ub = 0 if fx[i, t] == 0 else 1
            x[i, t] = m.addVar(vtype="B", lb=lb, ub=ub, name=f"x{i}_{t}")
    for t in range(T):
        m.addCons(quicksum(inst.D[i, t] * x[i, t] for i in range(N)) <= inst.Pmax[t])
    for j, mem in inst.transformer_members().items():
        for t in range(T):
            m.addCons(quicksum(inst.D[i, t] * x[i, t] for i in mem) <= inst.K[j])
    for i in range(N):
        if inst.min_on[i] > 0:
            m.addCons(quicksum(x[i, t] for t in range(T)) >= int(inst.min_on[i]))
        for win in inst.outage_windows(i):
            if not win:
                return dict(status="infeasible", X=None, J=None, seconds=time.perf_counter() - t0)
            m.addCons(quicksum(x[i, k] for k in win) >= 1)
    kf = np.array([float(f.get("feeder_cap", np.inf) or np.inf) for f in inst.feeders])
    if (inst.critical[:, None] & (inst.avail == 1) & (inst.D > kf[:, None] + 1e-9)).any():
        return dict(status="infeasible", X=None, J=None, seconds=time.perf_counter() - t0)
    sw = {}
    for i in range(N):
        for t in range(T):
            if t == 0 and inst.x0 is None:
                continue
            s = m.addVar(vtype="C", lb=0, ub=1, name=f"s{i}_{t}")
            prev = x[i, t - 1] if t > 0 else float(inst.x0[i])
            m.addCons(s >= x[i, t] - prev)
            m.addCons(s >= prev - x[i, t])
            sw[i, t] = s
    if inst.smax is not None:
        for i in range(N):
            m.addCons(quicksum(s for (ii, _), s in sw.items() if ii == i) <= float(inst.smax[i]))
    l1, l2, l3 = inst.lambdas
    s1, s2, s3 = inst.scales
    E = inst.E
    rho = {}
    for i in range(N):
        U = quicksum(inst.D[i, t] * (1 - x[i, t]) * inst.dt for t in range(T))
        rho[i] = U * (1.0 / E[i]) if E[i] > 0 else 0
    f1 = quicksum(inst.c[i] * inst.D[i, t] * (1 - x[i, t]) * inst.dt for i in range(N) for t in range(T))
    f3 = quicksum(inst.sigma[i] * s for (i, _), s in sw.items())
    z = m.addVar(vtype="C", lb=0, name="fair")
    if inst.pairs:
        m.addCons(z >= quicksum(w * (rho[i] - rho[j]) * (rho[i] - rho[j]) for (i, j, w) in inst.pairs))
    m.setObjective(l1 / s1 * f1 + l2 / s2 * z + l3 / s3 * f3, "minimize")
    if hint is not None:
        sol = m.createSol()
        for i in range(N):
            for t in range(T):
                m.setSolVal(sol, x[i, t], float(hint[i, t]))
        m.addSol(sol, free=True)
    m.optimize()
    st = m.getStatus()
    out = dict(status=st, seconds=time.perf_counter() - t0, X=None, J=None)
    if m.getNSols() > 0:
        best = m.getBestSol()
        X = np.array([[int(round(m.getSolVal(best, x[i, t]))) for t in range(T)] for i in range(N)])
        out.update(X=X, J=float(inst.J(X)), bound_J=float(m.getDualbound()), gap=float(m.getGap()))
    return out
