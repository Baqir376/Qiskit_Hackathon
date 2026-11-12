import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { costDiagonal, DIM, evaluate, isFeasible, multiStart, qaoaProbabilities, sampleShots, sortedOrder, type Scenario } from "../../lib/qsim";
import { lamIndex, optimumIndex, orderByObjective, project, scal, type FloodData } from "../../lib/data";

const d: FloodData = JSON.parse(readFileSync(new URL("../../public/data/flood.json", import.meta.url), "utf8"));
const sc: Scenario = { T: 3, S: 4, benefit: d.benefit, travel: d.travel_h, corridor: d.corridor, congestion: d.congestion_h, f1max: d.meta.f1max, f2max: d.meta.f2max };

describe("in-browser QAOA simulator", () => {
  it("reproduces Qiskit statevector probabilities for all 44 trained runs (cross-implementation test)", () => {
    let worst = 0;
    for (const v of ["A", "B", "C", "D"] as const) {
      const mixer = v === "A" || v === "B" ? "x" : "xy";
      for (const run of d.runs[v]) {
        const probs = qaoaProbabilities(costDiagonal(sc, run.lam, d.meta.penalty, mixer === "x"), run.theta, d.meta.p, mixer);
        d.feasible_index.forEach((k, j) => { worst = Math.max(worst, Math.abs(probs[k] - run.final[j])); });
      }
    }
    expect(worst).toBeLessThan(1e-5);
  });

  it("keeps the state normalised for arbitrary angles", () => {
    for (const mixer of ["x", "xy"] as const) {
      const p = qaoaProbabilities(costDiagonal(sc, 0.3, 2, mixer === "x"), [0.9, -1.3, 2.1, 0.4], 2, mixer);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    }
  });

  it("XY mixer never leaves the one-hot subspace", () => {
    const p = qaoaProbabilities(costDiagonal(sc, 0.5, 2, false), [1.1, 0.4, -0.7, 2.2], 2, "xy");
    let oneHot = 0;
    for (let i = 0; i < DIM; i++) {
      let ok = true;
      for (let t = 0; t < 3; t++) { let n = 0; for (let s = 0; s < 4; s++) n += (i >> (t * 4 + s)) & 1; ok &&= n === 1; }
      if (ok) oneHot += p[i];
    }
    expect(oneHot).toBeCloseTo(1, 10);
  });

  it("counts exactly 24 feasible plans and matches the exported list", () => {
    const feas = [...Array(DIM).keys()].filter((i) => isFeasible(i));
    expect(feas).toEqual(d.feasible_index);
  });

  it("penalised minimum is the exact constrained optimum for every lambda", () => {
    for (const lam of d.meta.lams) {
      const diag = costDiagonal(sc, lam, d.meta.penalty, true);
      let g = 0; for (let i = 1; i < DIM; i++) if (diag[i] < diag[g]) g = i;
      expect(d.feasible_index[optimumIndex(d, lam)]).toBe(g);
    }
  });

  it("CVaR with alpha=1 equals the expectation (analytical identity)", () => {
    const diag = costDiagonal(sc, 0.5, 2, true);
    const p = qaoaProbabilities(diag, [0.3, 0.7, 0.4, 0.2], 2, "x");
    expect(evaluate(p, diag, "cvar", sortedOrder(diag), 1)).toBeCloseTo(evaluate(p, diag, "expectation", null), 9);
  });

  it("seeded sampling is deterministic and sums to the shot count", () => {
    const p = qaoaProbabilities(costDiagonal(sc, 0.5, 2, false), [0.5, 0.5, 0.3, 0.3], 2, "xy");
    const a = sampleShots(p, 1024, 5), b = sampleShots(p, 1024, 5);
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect([...a.values()].reduce((x, y) => x + y, 0)).toBe(1024);
  });

  it("live optimiser improves on the uniform start (variant C)", () => {
    const diag = costDiagonal(sc, 0.5, 2, false);
    const f = (th: number[]) => evaluate(qaoaProbabilities(diag, th, 2, "xy"), diag, "expectation", null);
    const g = multiStart(f, 2, 2, 80);
    let best = Infinity, first = NaN, r = g.next();
    while (!r.done) { if (Number.isNaN(first)) first = r.value.v; best = Math.min(best, r.value.v); r = g.next(); }
    expect(best).toBeLessThan(first);
  });
});

describe("data helpers", () => {
  it("lamIndex snaps to the sweep grid", () => {
    expect(d.meta.lams[lamIndex(d, 0.52)]).toBeCloseTo(0.5);
  });
  it("orderByObjective puts the optimum first and is a permutation", () => {
    const o = orderByObjective(d, 0.5);
    expect(o[0]).toBe(optimumIndex(d, 0.5));
    expect([...o].sort((a, b) => a - b)).toEqual([...Array(24).keys()]);
    expect(scal(d, o[0], 0.5)).toBeLessThanOrEqual(scal(d, o[23], 0.5));
  });
  it("map projection keeps Sindh sites inside the viewbox", () => {
    for (const s of d.sites) {
      const [x, y] = project(s.lon, s.lat, 520, 640);
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(520); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(640);
    }
  });
});
