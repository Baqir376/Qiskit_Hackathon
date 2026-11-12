"""Hardware-realism check: re-run the trained lambda=0.5 circuits on a noisy simulator built from
IBM's FakeTorino (133-qubit Heron r1) calibration snapshot. No real hardware is used."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from qiskit import transpile
from qiskit_aer import AerSimulator
from qiskit_ibm_runtime.fake_provider import FakeTorino

from .baseline import enumerate_feasible, scalarised
from .formulation import penalty_program, to_ising
from .qaoa import VARIANTS, QAOARunner
from .scenario import all_bitstrings, load_scenario


def main(results="results/results.json", shots=4096):
    R = json.loads(Path(results).read_text())
    sc = load_scenario("data/sindh_2022.json")
    meta = R["meta"]
    f1max, f2max, P, p, lam = meta["f1max"], meta["f2max"], meta["penalty"], meta["p"], 0.5
    X_all = all_bitstrings(sc.n)
    feas = sc.is_feasible(X_all)
    idx, _, f1, f2 = enumerate_feasible(sc)
    F = scalarised(f1, f2, lam, f1max, f2max)
    opt = set(idx[np.isclose(F, F.min())].tolist())
    backend = FakeTorino()
    sim = AerSimulator.from_backend(backend)
    out = []
    for v, cfg in VARIANTS.items():
        row = next(m for m in R["sweep"] if m["variant"] == v and np.isclose(m["lam"], lam))
        op, off = to_ising(penalty_program(sc, lam, f1max, f2max, P, cfg["mixer"] == "x"))
        runner = QAOARunner(op, off, sc.T, sc.S, p, cfg["mixer"], cfg["objective"])
        qc = runner._bind(np.array(row["theta"])).copy()
        qc.measure_all()
        tqc = transpile(qc, backend, optimization_level=3, seed_transpiler=11)
        counts = sim.run(tqc, shots=shots, seed_simulator=11).result().get_counts()
        counts = {int(b.replace(" ", ""), 2): c for b, c in counts.items()}
        p_opt = sum(c for k, c in counts.items() if k in opt) / shots
        p_feas = sum(c for k, c in counts.items() if feas[k]) / shots
        ops = tqc.count_ops()
        res = dict(variant=v, label=cfg["label"], depth=tqc.depth(), two_qubit_gates=int(ops.get("cz", 0)),
                   ideal_p_opt=row["p_opt_exact"], noisy_p_opt=p_opt,
                   ideal_feasible=row["feasible_ratio_exact"], noisy_feasible=p_feas,
                   uniform_p_opt=row["uniform_p_opt_global"])
        out.append(res)
        print(f"{v}: depth={res['depth']} CZ={res['two_qubit_gates']} P(opt) ideal={res['ideal_p_opt']:.3f} "
              f"noisy={p_opt:.3f} | feasible ideal={res['ideal_feasible']:.3f} noisy={p_feas:.3f}")
    Path("results/noise_study.json").write_text(json.dumps(dict(backend="FakeTorino", shots=shots, lam=lam, rows=out), indent=1))


if __name__ == "__main__":
    main()
