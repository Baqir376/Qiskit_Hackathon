"""Figures for the report / video. Reads results/results.json (+ noise_study.json if present)."""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

from .qaoa import VARIANTS

COL = {"A": "#9aa0a6", "B": "#f29900", "C": "#1a73e8", "D": "#188038"}
FIG = Path("results/figures")


def _load():
    R = json.loads(Path("results/results.json").read_text())
    nz = Path("results/noise_study.json")
    return R, (json.loads(nz.read_text()) if nz.exists() else None)


def pareto(R, ax=None, highlight=None):
    E = R["exact"]
    f1, f2 = np.array(E["f1"]), np.array(E["f2"])
    pm, sm = np.array(E["pareto"]), np.array(E["supported"])
    own = ax is None
    if own:
        fig, ax = plt.subplots(figsize=(7, 5))
    ax.scatter(f2, f1, c="#d0d0d0", s=40, label="all 24 feasible plans (brute force)", zorder=1)
    order = np.argsort(f2[pm])
    ax.plot(f2[pm][order], f1[pm][order], "k--", lw=1, zorder=2)
    ax.scatter(f2[pm & sm], f1[pm & sm], facecolors="none", edgecolors="k", s=160, lw=1.5,
               label="exact Pareto front (supported)", zorder=3)
    ax.scatter(f2[pm & ~sm], f1[pm & ~sm], marker="s", facecolors="none", edgecolors="red", s=170, lw=1.5,
               label="Pareto-optimal but UNSUPPORTED\n(no weighted sum can reach it)", zorder=3)
    pos = {k: j for j, k in enumerate(E["feasible_index"])}
    variants = [highlight] if highlight else list(VARIANTS)
    for v in variants:
        pts = R["pareto_recovery"][v]["sample_pool"]["points"]
        j = [pos[k] for k in pts]
        ax.scatter(f2[j], f1[j], c=COL[v], s=35, marker="x" if v in "AB" else "o",
                   label=f"{v}: {VARIANTS[v]['label']} (sample pool)", zorder=4)
    ax.set_xlabel("f2  response burden  [team-hours, incl. corridor congestion]  (lower better)")
    ax.set_ylabel("f1  relief impact  [k people-equiv.]  (higher better)")
    ax.set_title("Impact vs. response time: exact Pareto front and QAOA recovery")
    ax.legend(fontsize=7, loc="lower right")
    ax.grid(alpha=0.3)
    if own:
        fig.tight_layout()
        fig.savefig(FIG / "pareto.png", dpi=160)
        plt.close(fig)


def sweep_metrics(R):
    fig, axs = plt.subplots(1, 2, figsize=(11, 4))
    for v in VARIANTS:
        rows = [m for m in R["sweep"] if m["variant"] == v]
        lam = [m["lam"] for m in rows]
        axs[0].plot(lam, [m["p_opt_exact"] for m in rows], "-o", c=COL[v], ms=4, label=v + ": " + VARIANTS[v]["label"])
        axs[1].plot(lam, [m["feasible_ratio_exact"] for m in rows], "-o", c=COL[v], ms=4, label=v)
    uni = [m for m in R["sweep"] if m["variant"] == "A"]
    axs[0].plot([m["lam"] for m in uni], [m["uniform_p_opt_global"] for m in uni], "k:", label="uniform random guess (1/4096)")
    axs[0].set_yscale("log")
    axs[0].set_title("Probability of sampling the exact optimum")
    axs[1].axhline(24 / 4096, c="k", ls=":", label="uniform random (24/4096)")
    axs[1].set_title("Probability mass on feasible dispatch plans")
    for ax in axs:
        ax.set_xlabel("λ  (0 = maximise impact only, 1 = minimise time only)")
        ax.grid(alpha=0.3)
    axs[0].legend(fontsize=7)
    axs[1].legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(FIG / "sweep_metrics.png", dpi=160)
    plt.close(fig)


def depth(R):
    fig, ax = plt.subplots(figsize=(6, 4))
    for v in VARIANTS:
        ps = sorted({d["p"] for d in R["depth"] if d["variant"] == v})
        mu = [np.mean([d["p_opt_exact"] for d in R["depth"] if d["variant"] == v and d["p"] == p]) for p in ps]
        sd = [np.std([d["p_opt_exact"] for d in R["depth"] if d["variant"] == v and d["p"] == p]) for p in ps]
        ax.errorbar(ps, mu, yerr=sd, c=COL[v], marker="o", capsize=3, label=v + ": " + VARIANTS[v]["label"])
    ax.set_xlabel("QAOA depth p")
    ax.set_ylabel("P(optimal plan)  (mean ± sd, 3 seeds)")
    ax.set_title("Depth study at λ = 0.5")
    ax.set_yscale("log")
    ax.grid(alpha=0.3)
    ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(FIG / "depth.png", dpi=160)
    plt.close(fig)


def convergence(R):
    fig, ax = plt.subplots(figsize=(6, 4))
    for v, h in R["histories"].items():
        ax.plot(np.minimum.accumulate(h), c=COL[v], label=v + ": " + VARIANTS[v]["label"])
    ax.set_xlabel("COBYLA evaluation")
    ax.set_ylabel("best objective so far (energy or CVaR)")
    ax.set_title("Classical-optimiser convergence, λ = 0.5")
    ax.grid(alpha=0.3)
    ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(FIG / "convergence.png", dpi=160)
    plt.close(fig)


def distribution(R, v="D"):
    probs = np.load(f"results/probs_{v}_lam0.5.npy")
    E = R["exact"]
    lam = 0.5
    f1, f2 = np.array(E["f1"]), np.array(E["f2"])
    F = -(1 - lam) * f1 / R["meta"]["f1max"] + lam * f2 / R["meta"]["f2max"]
    order = np.argsort(F)
    fig, ax = plt.subplots(figsize=(9, 4))
    ks = [E["feasible_index"][j] for j in order]
    bars = [probs[k] for k in ks]
    labels = [" ".join(f"{t}>{s}" for t, s in E["plans"][j]) for j in order]
    ax.bar(range(len(ks)), bars, color=[COL[v] if i == 0 else "#9ecae1" for i in range(len(ks))])
    ax.axhline(1 / 64, c="k", ls=":", label="uniform over one-hot space (1/64)")
    ax.set_xticks(range(len(ks)))
    ax.set_xticklabels(labels, rotation=75, fontsize=6)
    ax.set_ylabel("probability")
    ax.set_title(f"Variant {v} output distribution over the 24 feasible plans (sorted best→worst, λ=0.5)")
    ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(FIG / f"distribution_{v}.png", dpi=160)
    plt.close(fig)


def dispatch_map(R, lam=0.5, v="D"):
    S = R["scenario"]
    row = next(m for m in R["sweep"] if m["variant"] == v and np.isclose(m["lam"], lam))
    plan = dict((t, s) for t, s in row["best_plan"])
    fig, ax = plt.subplots(figsize=(7, 6.5))
    offs = {"JOHI": (-95, -4), "DADU": (12, -14), "KNS": (-110, 2), "JCD": (10, -4)}
    for st in S["sites"]:
        ax.scatter(st["lon"], st["lat"], s=st["people_k"] * 8, c="#d93025", alpha=0.35)
        ax.annotate(f"{st['name']}\n{st['people_k']}k affected*", (st["lon"], st["lat"]), fontsize=7,
                    xytext=offs.get(st["id"], (5, -12)), textcoords="offset points")
    tm = {t["id"]: t for t in S["teams"]}
    sm = {s["id"]: s for s in S["sites"]}
    for t in S["teams"]:
        ax.scatter(t["lon"], t["lat"], marker="^", s=120, c="#1a73e8")
        ax.annotate(f"{t['name']}\n({t['base']})", (t["lon"], t["lat"]), fontsize=7, xytext=(6, 4),
                    textcoords="offset points", color="#1a73e8")
    for tid, sid in plan.items():
        a, b = tm[tid], sm[sid]
        ax.add_patch(FancyArrowPatch((a["lon"], a["lat"]), (b["lon"], b["lat"]), arrowstyle="-|>",
                                     mutation_scale=15, color="#188038", lw=2))
    served = set(plan.values())
    for st in S["sites"]:
        if st["id"] not in served:
            ax.annotate("UNSERVED (waits for 2nd wave)", (st["lon"], st["lat"]), fontsize=7, color="#d93025",
                        xytext=(-70, -24), textcoords="offset points", weight="bold")
    ax.set_xlabel("longitude")
    ax.set_ylabel("latitude")
    ax.set_title(f"Sindh 2022 scenario — QAOA dispatch plan (variant {v}, λ={lam})\n*synthetic figures, real places")
    ax.set_xlim(66.9, 69.3)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(FIG / "dispatch_map.png", dpi=160)
    plt.close(fig)


def noise(NZ):
    if not NZ:
        return
    rows = NZ["rows"]
    fig, axs = plt.subplots(1, 2, figsize=(10, 4))
    x = np.arange(len(rows))
    for ax, key, title in ((axs[0], "p_opt", "P(optimal plan)"), (axs[1], "feasible", "feasible probability")):
        ax.bar(x - 0.2, [r["ideal_" + key] for r in rows], 0.4, label="ideal statevector", color="#1a73e8")
        ax.bar(x + 0.2, [r["noisy_" + key] for r in rows], 0.4, label=f"noisy ({NZ['backend']} model)", color="#f29900")
        ax.set_xticks(x)
        ax.set_xticklabels([f"{r['variant']}\n{r['two_qubit_gates']} CZ" for r in rows])
        ax.set_title(title)
        ax.grid(alpha=0.3, axis="y")
    axs[0].axhline(rows[0]["uniform_p_opt"], c="k", ls=":", label="uniform 1/4096")
    axs[0].legend(fontsize=7)
    fig.suptitle("Noise study, λ = 0.5, p = 2 (trained parameters re-run under a device noise model)")
    fig.tight_layout()
    fig.savefig(FIG / "noise.png", dpi=160)
    plt.close(fig)


def architecture():
    fig, ax = plt.subplots(figsize=(13, 5.2))
    ax.axis("off")
    ax.set_xlim(0, 13)
    ax.set_ylim(0, 5.2)

    def box(x, y, w, h, text, fc):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05", fc=fc, ec="#333", lw=1))
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=8)

    def arrow(x1, y1, x2, y2):
        ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=12, color="#333"))

    box(0.1, 3.6, 2.0, 1.2, "Scenario JSON\nSindh 2022 floods\nteams, sites, needs,\ncorridors", "#fde7e7")
    box(2.6, 3.6, 2.3, 1.2, "Objectives\nf1 relief impact (max)\nf2 response burden (min)\nweighted sum F_λ", "#fff4d6")
    box(5.4, 3.6, 2.4, 1.2, "QuadraticProgram\n(qiskit-optimization)\n+ slack-free penalties\n→ to_ising()", "#e8f0fe")
    box(8.3, 3.6, 2.2, 1.2, "Ising Hamiltonian\n12 qubits\nZ + ZZ terms", "#e8f0fe")
    box(5.0, 1.5, 2.6, 1.6, "Mixer choice\nA/B: X-mixer, |+>^12\nC/D: XY ring mixer,\nW-state per team\n(one-hot by construction)", "#e6f4ea")
    box(8.0, 1.5, 2.5, 1.6, "Parameterised QAOA\ncircuit (p layers)\nStatevectorSampler /\nAer + FakeTorino noise", "#e6f4ea")
    box(10.9, 1.5, 2.0, 1.6, "Classical optimiser\nCOBYLA\nobjective: <H> or\nCVaR_α (α=0.1)", "#f3e8fd")
    box(0.1, 0.2, 2.4, 1.2, "Exact baseline\nbrute force 4096 states\nexact Pareto front\n+ greedy dispatcher", "#fde7e7")
    box(1.4, 1.75, 3.1, 1.0, "λ sweep with parameter transfer\n(warm start from neighbouring λ)", "#fff4d6")
    box(10.9, 3.6, 2.0, 1.2, "Samples → decode\nbest feasible plan\nsample-pool Pareto", "#f3e8fd")
    box(6.3, 0.1, 6.6, 1.0, "Evaluation & UI: P(optimal), feasibility, hypervolume vs exact front, depth/penalty/noise studies\n→ results.json → figures, report, Streamlit dashboard", "#eeeeee")
    arrow(2.1, 4.2, 2.6, 4.2); arrow(4.9, 4.2, 5.4, 4.2); arrow(7.8, 4.2, 8.3, 4.2)
    arrow(9.4, 3.6, 9.3, 3.1); arrow(7.6, 2.3, 8.0, 2.3); arrow(10.5, 2.5, 10.9, 2.5)
    arrow(10.9, 2.0, 10.5, 2.0); arrow(11.9, 3.1, 11.9, 3.6); arrow(11.9, 1.5, 11.0, 1.1)
    arrow(2.5, 0.7, 6.3, 0.6); arrow(4.55, 2.25, 5.0, 2.25)
    ax.text(6.5, 5.05, "FloodQAOA — hybrid quantum-classical multi-objective dispatch pipeline", ha="center",
            fontsize=11, weight="bold")
    fig.savefig(FIG / "architecture.png", dpi=170, bbox_inches="tight")
    plt.close(fig)


def main():
    FIG.mkdir(parents=True, exist_ok=True)
    R, NZ = _load()
    pareto(R)
    sweep_metrics(R)
    depth(R)
    convergence(R)
    distribution(R, "D")
    dispatch_map(R)
    noise(NZ)
    architecture()
    print("figures ->", FIG)


if __name__ == "__main__":
    main()
