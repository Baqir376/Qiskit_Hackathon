import { readFileSync } from "node:fs";
import { costDiagonal, qaoaProbabilities, evaluate, sortedOrder, multiStart, type Scenario } from "../lib/qsim.ts";
const d = JSON.parse(readFileSync(new URL("../public/data/flood.json", import.meta.url), "utf8"));
const sc: Scenario = { T: 3, S: 4, benefit: d.benefit, travel: d.travel_h, corridor: d.corridor, congestion: d.congestion_h, f1max: d.meta.f1max, f2max: d.meta.f2max };
for (const [v, mixer, obj] of [["A","x","expectation"],["B","x","cvar"],["C","xy","expectation"],["D","xy","cvar"]] as const) {
  const diag = costDiagonal(sc, 0.5, 2, mixer === "x"); const order = obj === "cvar" ? sortedOrder(diag) : null;
  const f = (th: number[]) => evaluate(qaoaProbabilities(diag, th, 2, mixer), diag, obj, order);
  const t0 = performance.now(); const g = multiStart(f, 2); let r = g.next(); let best = r.value as { x: number[]; v: number }; let n = 0;
  while (!r.done) { n++; if (r.value.v < best.v) best = r.value; r = g.next(); }
  const ms = (performance.now() - t0) / n;
  const probs = qaoaProbabilities(diag, best.x, 2, mixer);
  const run = d.runs[v][5]; const popt = run.opt_index.reduce((a: number, j: number) => a + probs[d.feasible_index[j]], 0);
  console.log(v, `${ms.toFixed(1)} ms/eval`, `live P(opt)=${popt.toFixed(3)}  qiskit=${run.p_opt.toFixed(3)}`);
}
