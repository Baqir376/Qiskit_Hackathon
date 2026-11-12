// node scripts/verify-qsim.ts  — checks the browser simulator against Qiskit's statevector output
import { readFileSync } from "node:fs";
import { costDiagonal, qaoaProbabilities, type Scenario } from "../lib/qsim.ts";

const d = JSON.parse(readFileSync(new URL("../public/data/flood.json", import.meta.url), "utf8"));
const sc: Scenario = {
  T: 3, S: 4, benefit: d.benefit, travel: d.travel_h, corridor: d.corridor, congestion: d.congestion_h,
  f1max: d.meta.f1max, f2max: d.meta.f2max,
};
let worst = 0;
for (const v of ["A", "B", "C", "D"]) {
  const mixer = v === "A" || v === "B" ? "x" : "xy";
  for (const run of d.runs[v]) {
    const diag = costDiagonal(sc, run.lam, d.meta.penalty, mixer === "x");
    const probs = qaoaProbabilities(diag, run.theta, d.meta.p, mixer);
    let w = 0; d.feasible_index.forEach((k: number, j: number) => { w = Math.max(w, Math.abs(probs[k] - run.final[j]) / Math.max(1e-3, run.final[j])); worst = Math.max(worst, Math.abs(probs[k] - run.final[j])); });
    if (run.lam === 0.5) console.log(v, "rel err", w.toExponential(2));
  }
}
console.log(`max |p_browser - p_qiskit| over 44 runs x 24 plans = ${worst.toExponential(2)}`);
if (worst > 1e-4) { console.error("MISMATCH"); process.exit(1); }
console.log("OK: browser simulator reproduces Qiskit");
