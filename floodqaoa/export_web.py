"""Export real QAOA data for the web frontend -> web/public/data/flood.json

Re-runs the lambda sweep exactly as experiment.py does (same seeds, same warm-start chain), this time
recording the probability of each of the 24 feasible plans at every optimiser evaluation, so the
website can replay *actual* training dynamics. A consistency check asserts the final P(opt) values
match results/results.json, so the website can never drift from the report.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .baseline import enumerate_feasible, normalisers, scalarised
from .formulation import penalty_program, to_ising
from .qaoa import VARIANTS, run_variant
from .scenario import all_bitstrings, load_scenario

N_FRAMES = 40


def main(out="web/public/data/flood.json"):
    R = json.loads(Path("results/results.json").read_text())
    NZ = json.loads(Path("results/noise_study.json").read_text())
    M = R["meta"]
    sc = load_scenario("data/sindh_2022.json")
    f1max, f2max = normalisers(sc)
    X_all = all_bitstrings(sc.n)
    feas_all = sc.is_feasible(X_all)
    idx, Xf, f1, f2 = enumerate_feasible(sc)
    lams = M["lams"]
    runs = {}
    for v in VARIANTS:
        warm = None
        runs[v] = []
        for i, lam in enumerate(lams):
            op, off = to_ising(penalty_program(sc, lam, f1max, f2max, M["penalty"], VARIANTS[v]["mixer"] == "x"))
            res, runner = run_variant(v, op, off, sc.T, sc.S, M["p"], lam, shots=M["shots"], seed=M["seed"] + i,
                                      n_random=2, warm=warm, track_idx=idx)
            warm = res.theta
            ref = next(m for m in R["sweep"] if m["variant"] == v and np.isclose(m["lam"], lam))
            F = scalarised(f1, f2, lam, f1max, f2max)
            opt = np.flatnonzero(np.isclose(F, F.min()))
            p_opt = float(res.probs[idx[opt]].sum())
            assert np.isclose(p_opt, ref["p_opt_exact"], atol=1e-6), (v, lam, p_opt, ref["p_opt_exact"])
            snaps = np.array(runner.best_snaps)
            hist = np.array(res.history)
            assert len(hist) == len(snaps)
            # choose frames: dense at the start (where most change happens), sparse later
            k = len(snaps)
            frames = np.unique(np.round(np.geomspace(1, k, N_FRAMES)).astype(int) - 1)
            final = res.probs[idx]
            runs[v].append(dict(
                lam=lam,
                frames=[[round(float(x), 5) for x in snaps[j]] for j in frames],
                frame_eval=[int(j) for j in frames],
                frame_infeasible=[round(float(1 - snaps[j].sum()), 5) for j in frames],
                energy=[round(float(np.minimum.accumulate(hist)[j]), 5) for j in frames] if len(hist) else [],
                final=[round(float(x), 5) for x in final],
                p_opt=round(p_opt, 5),
                feasible=round(float(res.probs[feas_all].sum()), 5),
                best_plan=ref["best_plan"], found_optimum=ref["found_optimum"],
                n_evals=ref["n_evals"], opt_index=[int(o) for o in opt], theta=[float(x) for x in res.theta],
            ))
            print(f"{v} lam={lam:.1f} ok  P(opt)={p_opt:.3f} frames={len(frames)}", flush=True)

    plans = [[s for _, s in sc.decode(x)] for x in Xf]
    data = dict(
        meta=dict(n_qubits=sc.n, n_feasible=len(idx), p=M["p"], shots=M["shots"], penalty=M["penalty"], lams=lams,
                  f1max=f1max, f2max=f2max),
        teams=sc.teams, sites=sc.sites, data_note=sc.raw["data_note"],
        benefit=sc.benefit.tolist(), travel_h=sc.travel_h.tolist(),
        corridor=sc.corridor, congestion_h=sc.congestion_h,
        plans=plans, feasible_index=idx.tolist(), f1=np.round(f1, 2).tolist(), f2=np.round(f2, 2).tolist(),
        pareto=R["exact"]["pareto"], supported=R["exact"]["supported"],
        variants={v: VARIANTS[v]["label"] for v in VARIANTS},
        runs=runs, greedy=R["greedy"], depth=R["depth"], penalty_study=R["penalty_study"],
        pareto_recovery=R["pareto_recovery"], noise=NZ,
    )
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(data, separators=(",", ":")))
    print("wrote", out, f"{Path(out).stat().st_size/1024:.0f} KB")


if __name__ == "__main__":
    main()
