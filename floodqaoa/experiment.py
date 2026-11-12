"""Full evaluation pipeline. Writes results/results.json (all numbers in the report come from here)."""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np

from .baseline import (enumerate_feasible, greedy_dispatch, hypervolume, normalisers, pareto_mask,
                       scalarised, supported_mask)
from .formulation import penalty_program, to_ising
from .qaoa import VARIANTS, run_variant
from .scenario import all_bitstrings, load_scenario


def metrics_for(sc, res, lam, f1max, f2max, X_all, feas_all):
    idx, Xf, f1, f2 = enumerate_feasible(sc)
    F = scalarised(f1, f2, lam, f1max, f2max)
    Fopt, Fworst = F.min(), F.max()
    opt_set = set(idx[np.isclose(F, Fopt, atol=1e-12)].tolist())
    shots = sum(res.counts.values())
    feas_shots = {k: c for k, c in res.counts.items() if feas_all[k]}
    p_opt_shots = sum(c for k, c in res.counts.items() if k in opt_set) / shots
    # decode: best-objective feasible sample (standard QAOA read-out)
    if feas_shots:
        Xs = X_all[list(feas_shots)]
        Fs = scalarised(sc.f1(Xs), sc.f2(Xs), lam, f1max, f2max)
        best_k = list(feas_shots)[int(np.argmin(Fs))]
        best_F = float(Fs.min())
        gap = (best_F - Fopt) / (Fworst - Fopt)
        # mean quality of feasible samples (1 = always optimal, 0 = always worst feasible)
        w = np.array(list(feas_shots.values()), float)
        mean_quality = float(1 - np.average((Fs - Fopt) / (Fworst - Fopt), weights=w))
    else:
        best_k, best_F, gap, mean_quality = None, None, None, None
    uniform_space = 2 ** sc.n if VARIANTS[res.variant]["mixer"] == "x" else sc.S ** sc.T
    return dict(
        variant=res.variant, lam=float(lam), p=res.p,
        p_opt_exact=float(sum(res.probs[k] for k in opt_set)),
        p_opt_shots=p_opt_shots,
        feasible_ratio_exact=float(res.probs[feas_all].sum()),
        feasible_ratio_shots=sum(feas_shots.values()) / shots,
        uniform_p_opt=len(opt_set) / uniform_space,
        uniform_p_opt_global=len(opt_set) / 2 ** sc.n,
        found_optimum=bool(best_k in opt_set),
        best_gap=gap, mean_feasible_quality=mean_quality,
        best_index=best_k, best_plan=sc.decode(X_all[best_k]) if best_k is not None else None,
        n_evals=res.n_evals, seconds=res.seconds, final_objective=res.final_objective,
        theta=res.theta.tolist(), shots=shots,
    )


def main(out="results", p=2, penalty=2.0, shots=1024, seed=7, lams=np.linspace(0, 1, 11)):
    t_start = time.perf_counter()
    out = Path(out)
    out.mkdir(exist_ok=True)
    sc = load_scenario("data/sindh_2022.json")
    f1max, f2max = normalisers(sc)
    X_all = all_bitstrings(sc.n)
    feas_all = sc.is_feasible(X_all)
    idx, Xf, f1, f2 = enumerate_feasible(sc)
    pm = pareto_mask(f1, f2)
    sm = supported_mask(f1, f2, f1max, f2max)
    ref = (0.0, 1.1 * f2max)
    hv_exact = hypervolume(f1[pm], f2[pm], *ref)

    R = dict(meta=dict(p=p, penalty=penalty, shots=shots, seed=seed, n_qubits=sc.n,
                       n_feasible=int(len(idx)), lams=[float(l) for l in lams],
                       f1max=f1max, f2max=f2max, hv_ref=ref),
             scenario=dict(teams=sc.teams, sites=sc.sites, benefit=sc.benefit.tolist(),
                           travel_h=sc.travel_h.tolist(), corridor=sc.corridor,
                           congestion_h=sc.congestion_h, data_note=sc.raw["data_note"]),
             exact=dict(feasible_index=idx.tolist(), f1=f1.tolist(), f2=f2.tolist(),
                        pareto=pm.tolist(), supported=sm.tolist(), hypervolume=hv_exact,
                        plans=[sc.decode(x) for x in Xf]),
             sweep=[], greedy=[], depth=[], penalty_study=[], pareto_recovery={}, histories={})

    # ---- classical greedy dispatcher reference
    for lam in lams:
        xg = greedy_dispatch(sc, lam, f1max, f2max)
        Fg = scalarised(sc.f1(xg), sc.f2(xg), lam, f1max, f2max)
        F = scalarised(f1, f2, lam, f1max, f2max)
        R["greedy"].append(dict(lam=float(lam), plan=sc.decode(xg), f1=float(sc.f1(xg)), f2=float(sc.f2(xg)),
                                gap=float((Fg - F.min()) / (F.max() - F.min())), optimal=bool(np.isclose(Fg, F.min()))))

    # ---- main lambda sweep, all variants, with parameter transfer between neighbouring lambdas
    for v in VARIANTS:
        warm = None
        for i, lam in enumerate(lams):
            op, off = to_ising(penalty_program(sc, lam, f1max, f2max, penalty, VARIANTS[v]["mixer"] == "x"))
            res, _ = run_variant(v, op, off, sc.T, sc.S, p, lam, shots=shots, seed=seed + i,
                                 n_random=2, warm=warm)
            warm = res.theta
            m = metrics_for(sc, res, lam, f1max, f2max, X_all, feas_all)
            m["sample_counts"] = {str(k): c for k, c in res.counts.items() if feas_all[k]}
            R["sweep"].append(m)
            if np.isclose(lam, 0.5):
                R["histories"][v] = res.history
                np.save(out / f"probs_{v}_lam0.5.npy", res.probs)
            print(f"[sweep] {v} lam={lam:.1f} P(opt)={m['p_opt_exact']:.3f} feas={m['feasible_ratio_exact']:.3f} "
                  f"found={m['found_optimum']} ({res.seconds:.1f}s)", flush=True)

    # ---- Pareto-front recovery: (i) argmin per lambda only, (ii) whole pool of feasible samples
    fi = {int(k): j for j, k in enumerate(idx)}
    for v in VARIANTS:
        rows = [m for m in R["sweep"] if m["variant"] == v]
        argmin_pts = {m["best_index"] for m in rows if m["best_index"] is not None}
        pool = set()
        for m in rows:
            pool |= {int(k) for k in m["sample_counts"]}
        out_v = {}
        for name, pts in (("argmin", argmin_pts), ("sample_pool", pool)):
            pts = sorted(pts)
            a, b = np.array([f1[fi[k]] for k in pts]), np.array([f2[fi[k]] for k in pts])
            nd = pareto_mask(a, b) if len(pts) else np.array([], bool)
            found = {pts[j] for j in np.flatnonzero(nd)}
            exact_front = set(idx[pm].tolist())
            out_v[name] = dict(points=sorted(found), recovered=len(found & exact_front),
                               of=len(exact_front), hypervolume=hypervolume(a[nd], b[nd], *ref) if len(pts) else 0.0,
                               hv_ratio=(hypervolume(a[nd], b[nd], *ref) / hv_exact) if len(pts) else 0.0)
        R["pareto_recovery"][v] = out_v
        print(f"[pareto] {v} argmin {out_v['argmin']['recovered']}/{out_v['argmin']['of']}  "
              f"pool {out_v['sample_pool']['recovered']}/{out_v['sample_pool']['of']}")

    # ---- depth study at lambda = 0.5, 3 seeds
    lam = 0.5
    for v in VARIANTS:
        op, off = to_ising(penalty_program(sc, lam, f1max, f2max, penalty, VARIANTS[v]["mixer"] == "x"))
        for pp in (1, 2, 3, 4):
            for s in range(3):
                res, _ = run_variant(v, op, off, sc.T, sc.S, pp, lam, shots=shots, seed=100 + s, n_random=2)
                m = metrics_for(sc, res, lam, f1max, f2max, X_all, feas_all)
                R["depth"].append({k: m[k] for k in ("variant", "p", "p_opt_exact", "feasible_ratio_exact",
                                                     "found_optimum", "n_evals", "seconds", "uniform_p_opt")}
                                  | {"seed": 100 + s})
            print(f"[depth] {v} p={pp} P(opt) mean="
                  f"{np.mean([d['p_opt_exact'] for d in R['depth'] if d['variant']==v and d['p']==pp]):.3f}", flush=True)

    # ---- penalty-weight study for standard QAOA (A): validity of ground state + trainability
    F = scalarised(f1, f2, lam, f1max, f2max)
    for P in (0.25, 0.5, 1.0, 2.0, 4.0, 8.0):
        op, off = to_ising(penalty_program(sc, lam, f1max, f2max, P, True))
        from .qaoa import ising_diagonal
        diag = ising_diagonal(op, off)
        g = int(np.argmin(diag))
        valid = bool(feas_all[g] and np.isclose(diag[g], F.min()))
        res, _ = run_variant("A", op, off, sc.T, sc.S, p, lam, shots=shots, seed=200, n_random=2)
        m = metrics_for(sc, res, lam, f1max, f2max, X_all, feas_all)
        R["penalty_study"].append(dict(P=P, ground_state_valid=valid, p_opt_exact=m["p_opt_exact"],
                                       feasible_ratio_exact=m["feasible_ratio_exact"]))
        print(f"[penalty] P={P} valid={valid} P(opt)={m['p_opt_exact']:.3f} feas={m['feasible_ratio_exact']:.3f}")

    R["meta"]["total_seconds"] = time.perf_counter() - t_start
    (out / "results.json").write_text(json.dumps(R, indent=1, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o)))
    print(f"done in {R['meta']['total_seconds']:.0f}s -> {out/'results.json'}")
    return R


if __name__ == "__main__":
    main()
