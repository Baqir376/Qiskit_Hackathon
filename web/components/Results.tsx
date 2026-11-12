"use client";
import { motion } from "motion/react";
import { useData, VCOLOR, VSHORT, type VariantKey } from "@/lib/data";
import Backdrop from "./Backdrop";
import { CountUp, Reveal, SectionHeader, TiltCard } from "./ui";

const KEYS: VariantKey[] = ["A", "B", "C", "D"];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export default function Results() {
  const d = useData();
  const pOpt = Object.fromEntries(KEYS.map((k) => [k, mean(d.runs[k].map((r) => r.p_opt))])) as Record<VariantKey, number>;
  const feas = Object.fromEntries(KEYS.map((k) => [k, mean(d.runs[k].map((r) => r.feasible))])) as Record<VariantKey, number>;
  const found = Object.fromEntries(KEYS.map((k) => [k, d.runs[k].filter((r) => r.found_optimum).length])) as Record<VariantKey, number>;
  const greedyOpt = d.greedy.filter((g) => g.optimal).length;
  const inSpace = pOpt.D / (1 / 64);
  const noiseD = d.noise.rows.find((r) => r.variant === "D")!;

  return (
    <section className="relative isolate overflow-clip px-5 py-32 md:px-8">
      <Backdrop layers={["aurora", "contours"]} tone="cool" />
      <SectionHeader id="results" kicker="05 · Results" title={<>Measured, not <span className="font-serif font-normal italic text-signal">imagined</span></>}
        sub={<>Every number is averaged over 11 priority settings and checked against exact brute force over all 4,096 states. Simulated with Qiskit 2.6 (p = {d.meta.p}, {d.meta.shots} shots).</>} />

      <div className="mx-auto mt-14 grid max-w-6xl auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-6">
        <Reveal className="md:col-span-3 md:row-span-2">
          <TiltCard className="h-full p-7">
            <div className="font-mono text-xs uppercase tracking-widest text-muted">Best variant · XY mixer + CVaR</div>
            <div className="mt-6 font-mono text-7xl font-semibold tracking-tight text-win md:text-8xl"><CountUp to={pOpt.D * 4096} suffix="×" /></div>
            <div className="mt-2 text-lg">more likely to sample the optimal plan than a random guess</div>
            <div className="mt-8 space-y-3">
              {KEYS.map((k, i) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-28 font-mono text-xs text-muted">{k} · {VSHORT[k]}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
                    <motion.div className="h-full rounded-full" style={{ background: VCOLOR[k] }} initial={{ width: 0 }} whileInView={{ width: `${(pOpt[k] / pOpt.D) * 100}%` }}
                      viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                  <span className="w-12 text-right font-mono text-xs">{pOpt[k].toFixed(3)}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs leading-relaxed text-muted">
              Honest footnote: C/D only search the 64 valid-shaped states. Within that space the training itself adds ~{inSpace.toFixed(0)}× (D). The rest of the gain comes from the constraint-preserving encoding.
            </p>
          </TiltCard>
        </Reveal>

        <Reveal className="md:col-span-3" delay={0.05}>
          <TiltCard className="h-full p-6">
            <div className="font-mono text-xs uppercase tracking-widest text-muted">Valid plans in the output</div>
            <div className="mt-4 flex items-end gap-6">
              {KEYS.map((k) => (
                <div key={k} className="flex flex-1 flex-col items-center">
                  <div className="flex h-24 w-full items-end overflow-hidden rounded-xl bg-white/[0.03]">
                    <motion.div className="w-full rounded-xl" style={{ background: VCOLOR[k] }} initial={{ height: 0 }} whileInView={{ height: `${feas[k] * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                  <div className="mt-2 font-mono text-sm">{(feas[k] * 100).toFixed(0)}%</div>
                  <div className="font-mono text-[10px] text-muted">{k}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted">Uniform random: 0.6%. The XY mixer keeps 98% of probability on valid plans.</div>
          </TiltCard>
        </Reveal>

        <Reveal className="md:col-span-2" delay={0.1}>
          <TiltCard className="h-full p-6">
            <div className="font-mono text-xs uppercase tracking-widest text-muted">Exact optimum found</div>
            <div className="mt-3 font-mono text-5xl font-semibold text-flood"><CountUp to={found.D} />/11</div>
            <div className="mt-2 text-sm text-muted">priority settings (B, C, D). Standard QAOA: {found.A}/11.</div>
          </TiltCard>
        </Reveal>
        <Reveal className="md:col-span-1" delay={0.15}>
          <TiltCard className="h-full p-6">
            <div className="font-mono text-xs uppercase tracking-widest text-muted">Greedy rule</div>
            <div className="mt-3 font-mono text-5xl font-semibold text-danger">{greedyOpt}/11</div>
            <div className="mt-2 text-xs text-muted">A dispatcher’s rule of thumb misses the optimum most of the time.</div>
          </TiltCard>
        </Reveal>

        <Reveal className="md:col-span-3" delay={0.05}>
          <TiltCard className="h-full p-6">
            <div className="font-mono text-xs uppercase tracking-widest text-muted">Under real-device noise · {d.noise.backend} model</div>
            <div className="mt-4 space-y-2">
              {d.noise.rows.map((r) => (
                <div key={r.variant} className="flex items-center gap-3 text-xs">
                  <span className="w-6 font-mono" style={{ color: VCOLOR[r.variant] }}>{r.variant}</span>
                  <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <motion.div className="absolute h-full rounded-full opacity-30" style={{ background: VCOLOR[r.variant] }} initial={{ width: 0 }} whileInView={{ width: `${(r.ideal_p_opt / 0.1) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1 }} />
                    <motion.div className="absolute h-full rounded-full" style={{ background: VCOLOR[r.variant] }} initial={{ width: 0 }} whileInView={{ width: `${(r.noisy_p_opt / 0.1) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.4 }} />
                  </div>
                  <span className="w-28 text-right font-mono text-muted">{r.ideal_p_opt.toFixed(3)} → {r.noisy_p_opt.toFixed(3)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted">~{noiseD.two_qubit_gates} CZ gates after routing. Noise erases most of the gain, though D still beats random by ~{Math.round(noiseD.noisy_p_opt * 4096)}×.</div>
          </TiltCard>
        </Reveal>

        <Reveal className="md:col-span-3" delay={0.1}>
          <TiltCard className="h-full p-6">
            <div className="font-mono text-xs uppercase tracking-widest text-muted">Penalty weight sweep (variant A)</div>
            <div className="mt-4 flex h-32 items-end gap-3">
              {d.penalty_study.map((p) => (
                <div key={p.P} className="flex h-full flex-1 flex-col items-center justify-end">
                  <div className="mb-1 font-mono text-[10px] text-text/80">{(p.feasible_ratio_exact * 100).toFixed(0)}%</div>
                  <motion.div className="w-full rounded-lg bg-signal/80" initial={{ height: 0 }} whileInView={{ height: `${Math.max(3, (p.feasible_ratio_exact / 0.4) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} />
                  <div className="mt-1 font-mono text-[10px] text-muted">P={p.P}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted">Valid-plan share after training. Too-large penalties flatten the landscape; at P = 4 training collapsed. Below P ≈ 0.25 the ground state stops being the true optimum.</div>
          </TiltCard>
        </Reveal>
      </div>
    </section>
  );
}
