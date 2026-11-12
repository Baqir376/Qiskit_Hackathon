"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useData } from "@/lib/data";
import Backdrop from "./Backdrop";
import { Reveal, SectionHeader } from "./ui";

export default function Pareto() {
  const d = useData();
  const [mode, setMode] = useState<"argmin" | "sample_pool">("argmin");
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 420, PAD = 56;
  const x0 = Math.min(...d.f2) - 1, x1 = Math.max(...d.f2) + 1;
  const y0 = Math.min(...d.f1) - 8, y1 = Math.max(...d.f1) + 8;
  const X = (v: number) => PAD + ((v - x0) / (x1 - x0)) * (W - PAD - 20);
  const Y = (v: number) => H - PAD - ((v - y0) / (y1 - y0)) * (H - PAD - 20);
  const front = d.f1.map((_, j) => j).filter((j) => d.pareto[j]).sort((a, b) => d.f2[a] - d.f2[b]);
  const rec = d.pareto_recovery.D[mode];
  // recovered points are basis-state indices -> map to positions in the feasible list
  const pos = new Map(d.feasible_index.map((k, j) => [k, j]));
  const foundSet = new Set(rec.points.map((k) => pos.get(k)!).filter((j) => d.pareto[j]));
  const foundCount = rec.recovered;
  const unsupported = front.filter((j) => !d.supported[j]);

  return (
    <section className="relative isolate overflow-clip px-5 py-32 md:px-8">
      <Backdrop layers={["aurora", "contours"]} tone="warm" />
      <SectionHeader
        id="pareto"
        kicker="04 · The trade-off curve"
        title={<>Not one answer: a <span className="font-serif font-normal italic text-flood">menu</span> of best answers</>}
        sub="Each dot is one of the 24 valid plans. The dashed line is the Pareto front: plans you can't improve on one goal without losing on the other. We found it exactly by brute force, then asked how much of it QAOA recovers."
      />
      <div className="mx-auto mt-14 grid max-w-6xl gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="glass relative rounded-3xl p-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {[0, 1, 2, 3, 4].map((i) => {
              const yv = y0 + ((y1 - y0) * i) / 4;
              return <g key={i}><line x1={PAD} x2={W - 20} y1={Y(yv)} y2={Y(yv)} stroke="rgba(243,236,221,0.08)" /><text x={PAD - 8} y={Y(yv) + 4} fontSize={10} textAnchor="end" fill="#A9A291" fontFamily="monospace">{yv.toFixed(0)}</text></g>;
            })}
            {[0, 1, 2, 3, 4].map((i) => {
              const xv = x0 + ((x1 - x0) * i) / 4;
              return <text key={i} x={X(xv)} y={H - PAD + 18} fontSize={10} textAnchor="middle" fill="#A9A291" fontFamily="monospace">{xv.toFixed(0)}h</text>;
            })}
            <text x={W / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="#A9A291">response burden (team-hours) → lower is better</text>
            <text x={14} y={H / 2} textAnchor="middle" fontSize={11} fill="#A9A291" transform={`rotate(-90 14 ${H / 2})`}>people reached (k) → higher is better</text>


            <motion.path d={front.map((j, i) => `${i ? "L" : "M"}${X(d.f2[j])},${Y(d.f1[j])}`).join(" ")} fill="none" stroke="#F3ECDD" strokeDasharray="5 5" strokeWidth={1.5}
              initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, delay: 0.8 }} />

            {d.f1.map((_, j) => {
              const onFront = d.pareto[j];
              return (
                <motion.circle key={j} cx={X(d.f2[j])} cy={Y(d.f1[j])} r={onFront ? 7 : 5}
                  fill={onFront ? "#F3ECDD" : "rgba(243,236,221,0.35)"}
                  initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                  transition={{ delay: 0.02 * j, type: "spring", stiffness: 300, damping: 15 }}
                  onPointerEnter={() => setHover(j)} onPointerLeave={() => setHover(null)} style={{ cursor: "pointer" }} />
              );
            })}
            {front.map((j) => (
              <AnimatePresence key={j}>
                {foundSet.has(j) && (
                  <motion.circle cx={X(d.f2[j])} cy={Y(d.f1[j])} fill="none" stroke="#9CCB7A" strokeWidth={2.5}
                    initial={{ r: 30, opacity: 0 }} animate={{ r: 13, opacity: 1 }} exit={{ r: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} />
                )}
              </AnimatePresence>
            ))}
            {unsupported.map((j) => (
              <g key={j}>
                <motion.rect x={X(d.f2[j]) - 12} y={Y(d.f1[j]) - 12} width={24} height={24} rx={4} fill="none" stroke="#E0533D" strokeWidth={2}
                  animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} />
                <text x={X(d.f2[j]) + 18} y={Y(d.f1[j]) + 26} fontSize={11} fill="#E0533D">unsupported: no weighted sum reaches it</text>
              </g>
            ))}
            {hover !== null && (
              <g pointerEvents="none">
                <rect x={Math.min(X(d.f2[hover]) + 12, W - 190)} y={Y(d.f1[hover]) - 60} width={176} height={58} rx={10} fill="#141936" stroke="rgba(243,236,221,0.25)" />
                {d.teams.map((t, ti) => (
                  <text key={t.id} x={Math.min(X(d.f2[hover]) + 22, W - 180)} y={Y(d.f1[hover]) - 42 + ti * 14} fontSize={10} fill="#F3ECDD" fontFamily="monospace">{t.id} → {d.plans[hover][ti]}</text>
                ))}
              </g>
            )}
          </svg>
        </Reveal>

        <div className="flex flex-col gap-4">
          <Reveal className="glass rounded-3xl p-6">
            <div className="font-mono text-xs uppercase tracking-widest text-muted">How do we read QAOA’s answer?</div>
            <div className="mt-4 flex rounded-2xl bg-white/[0.04] p-1">
              {(["argmin", "sample_pool"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className="relative flex-1 rounded-xl px-3 py-2 text-xs font-semibold">
                  {mode === m && <motion.span layoutId="ppill" className="absolute inset-0 rounded-xl bg-white/10" />}
                  <span className="relative">{m === "argmin" ? "Best sample per λ" : "Pool all samples"}</span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="mt-6 font-mono text-6xl font-semibold text-win">{foundCount}<span className="text-2xl text-muted">/{rec.of}</span></div>
                <div className="mt-1 text-sm text-muted">Pareto-optimal plans recovered (variant D; A, B and C give the same counts)</div>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  {mode === "argmin"
                    ? "Taking only the single best sample at each λ can never reach the unsupported plan (red square). That's a mathematical limit of weighted sums, not of the quantum computer."
                    : "QAOA outputs a whole distribution. Pooling every valid sample across the sweep recovers all four, including the unsupported plan. At 24 plans this is partly because the shots cover most of them, and we say so."}
                </p>
              </motion.div>
            </AnimatePresence>
          </Reveal>
          <Reveal className="glass rounded-3xl p-6 text-sm text-muted" delay={0.1}>
            <span className="text-text">Why a curve?</span> A commander doesn’t want “the optimum”. They want to see what each extra hour of response time buys in people reached, then choose.
          </Reveal>
        </div>
      </div>
    </section>
  );
}
