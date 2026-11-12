"""FloodQAOA dashboard:  streamlit run app.py"""
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st

from floodqaoa.baseline import enumerate_feasible, normalisers, scalarised
from floodqaoa.formulation import penalty_program, to_ising
from floodqaoa.qaoa import VARIANTS, run_variant
from floodqaoa.scenario import all_bitstrings, load_scenario
from floodqaoa import plots

st.set_page_config(page_title="FloodQAOA", layout="wide")
st.title("FloodQAOA — quantum multi-objective flood-relief dispatch")
st.caption("Sindh, 2022 Pakistan floods · real places, synthetic needs data · Qiskit QAOA vs exact brute force")

R = json.loads(Path("results/results.json").read_text()) if Path("results/results.json").exists() else None
sc = load_scenario("data/sindh_2022.json")
f1max, f2max = normalisers(sc)
idx, Xf, f1, f2 = enumerate_feasible(sc)
X_all = all_bitstrings(sc.n)
feas_all = sc.is_feasible(X_all)

with st.sidebar:
    lam = st.slider("λ  (0 = maximise impact · 1 = minimise response time)", 0.0, 1.0, 0.5, 0.1)
    v = st.selectbox("QAOA variant", list(VARIANTS), index=3, format_func=lambda k: f"{k}: {VARIANTS[k]['label']}")
    p = st.slider("depth p", 1, 4, 2)
    live = st.button("▶ Run QAOA live (Qiskit statevector)")

F = scalarised(f1, f2, lam, f1max, f2max)
j = int(np.argmin(F))
c1, c2 = st.columns([1, 1])
with c1:
    st.subheader("Exact optimum (brute force over 4096 bit-strings)")
    st.table(pd.DataFrame(sc.decode(Xf[j]), columns=["team", "site"]))
    st.write(f"impact f1 = **{f1[j]:.1f}**, burden f2 = **{f2[j]:.2f} h**")

with c2:
    st.subheader(f"QAOA variant {v}")
    if live:
        with st.spinner("training QAOA…"):
            op, off = to_ising(penalty_program(sc, lam, f1max, f2max, 2.0, VARIANTS[v]["mixer"] == "x"))
            res, _ = run_variant(v, op, off, sc.T, sc.S, p, lam, shots=1024, seed=1)
        opt = idx[np.isclose(F, F.min())]
        feas_counts = {k: c for k, c in res.counts.items() if feas_all[k]}
        if feas_counts:
            ks = list(feas_counts)
            Fs = scalarised(sc.f1(X_all[ks]), sc.f2(X_all[ks]), lam, f1max, f2max)
            best = ks[int(np.argmin(Fs))]
            st.table(pd.DataFrame(sc.decode(X_all[best]), columns=["team", "site"]))
            st.write("matches exact optimum ✅" if best in opt else "differs from exact optimum ❌")
        st.metric("P(optimal plan)", f"{res.probs[opt].sum():.3f}",
                  help="uniform random: 1/4096 (X-mixer) or 1/64 (XY one-hot space)")
        st.metric("feasible probability", f"{res.probs[feas_all].sum():.3f}")
        st.caption(f"{res.n_evals} circuit evaluations · {res.seconds:.1f}s")
        fig, ax = plt.subplots(figsize=(5, 3))
        ax.plot(np.minimum.accumulate(res.history))
        ax.set_xlabel("evaluation"); ax.set_ylabel("best objective")
        st.pyplot(fig)
    elif R:
        row = next(m for m in R["sweep"] if m["variant"] == v and np.isclose(m["lam"], lam))
        st.table(pd.DataFrame(row["best_plan"], columns=["team", "site"]))
        st.write("matches exact optimum ✅" if row["found_optimum"] else "differs from exact optimum ❌")
        st.metric("P(optimal plan)", f"{row['p_opt_exact']:.3f}", help=f"uniform random: {row['uniform_p_opt']:.4f}")
        st.metric("feasible probability", f"{row['feasible_ratio_exact']:.3f}")
        st.caption("pre-computed (p=2) — press ▶ to run live")

if R:
    st.subheader("Pareto front: impact vs response time")
    fig, ax = plt.subplots(figsize=(8, 5))
    plots.pareto(R, ax=ax, highlight=v)
    ax.scatter([f2[j]], [f1[j]], marker="*", s=300, c="gold", edgecolors="k", zorder=5, label=f"optimum at λ={lam}")
    ax.legend(fontsize=7)
    st.pyplot(fig)
    st.info(R["scenario"]["data_note"])
