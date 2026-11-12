"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { lamIndex, optimumIndex, useData } from "@/lib/data";
import SindhMap, { TEAM_COL, TEAM_ICON } from "./SindhMap";
import { Reveal, SectionHeader, ease } from "./ui";

export default function Dilemma() {
  const d = useData();
  const [lam, setLam] = useState(0.5);
  const j = optimumIndex(d, lam);
  const plan = d.teams.map((t, ti) => [t.id, d.plans[j][ti]] as [string, string]);
  const waiting = d.sites.find((s) => !d.plans[j].includes(s.id))!;
  const qaoa = d.runs.D[lamIndex(d, lam)];
  const label = lam < 0.25 ? "Maximise people reached" : lam > 0.75 ? "Fastest response" : "Balanced";

  return (
    <section className="relative px-5 py-32 md:px-8">
      <SectionHeader
        id="dilemma"
        kicker="01 · The dilemma"
        title={<>Three teams. Four drowning towns.<br /><span className="font-serif font-normal italic text-danger">Someone has to wait.</span></>}
        sub="A boat-rescue unit, a mobile medical camp and a supply convoy. Each town needs something different, the roads are washed out, and two teams on the same highway jam it. Drag the slider to change what the commander values most."
      />

      <div className="mx-auto mt-16 grid max-w-6xl items-stretch gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Reveal className="glass relative overflow-hidden rounded-3xl p-3">
          <div className="grid-bg absolute inset-0 opacity-40" />
          <div className="relative aspect-[520/640] w-full">
            <SindhMap plan={plan} />
          </div>
          <div className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-widest text-muted">Sindh · 2022 · real places, synthetic needs*</div>
        </Reveal>

        <div className="flex flex-col gap-6">
          <Reveal className="glass rounded-3xl p-6">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-xs uppercase tracking-widest text-muted">Commander priority</div>
              <AnimatePresence mode="wait">
                <motion.div key={label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-sm font-semibold text-flood">
                  {label}
                </motion.div>
              </AnimatePresence>
            </div>
            <input aria-label="priority weight lambda" className="slider mt-6 w-full" type="range" min={0} max={1} step={0.1} value={lam}
              onChange={(e) => setLam(parseFloat(e.target.value))} />
            <div className="mt-2 flex justify-between font-mono text-[11px] text-muted">
              <span>λ=0 · reach</span><span className="text-text">λ = {lam.toFixed(1)}</span><span>speed · λ=1</span>
            </div>
          </Reveal>

          <Reveal className="glass flex-1 rounded-3xl p-6" delay={0.1}>
            <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">Optimal dispatch plan</div>
            <div className="space-y-2">
              {plan.map(([tid, sid]) => {
                const t = d.teams.find((x) => x.id === tid)!;
                const s = d.sites.find((x) => x.id === sid)!;
                return (
                  <motion.div layout key={tid} className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.02] px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: `${TEAM_COL[tid]}22`, color: TEAM_COL[tid] }}>{TEAM_ICON[tid]}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="font-mono text-[11px] text-muted">from {t.base}</div>
                    </div>
                    <AnimatePresence mode="popLayout">
                      <motion.div key={sid} initial={{ opacity: 0, x: 20, filter: "blur(4px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.45, ease }} className="text-right text-sm font-semibold text-win">
                        → {s.name.replace(" (Dadu district)", "")}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={waiting.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="mt-4 rounded-2xl border border-danger/30 bg-danger/[0.07] px-4 py-3 text-sm">
                <span className="font-semibold text-danger">{waiting.name}</span>
                <span className="text-muted"> waits for the second wave ({waiting.people_k}k people*).</span>
              </motion.div>
            </AnimatePresence>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <Stat label="people-equiv. reached" value={d.f1[j].toFixed(0) + "k"} />
              <Stat label="team-hours (w/ jams)" value={d.f2[j].toFixed(1) + "h"} />
              <Stat label="QAOA agrees?" value={qaoa.found_optimum ? "✓ yes" : "✗ no"} accent={qaoa.found_optimum ? "text-win" : "text-danger"} />
            </div>
          </Reveal>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-6xl text-center text-xs text-muted/70">* {d.data_note}</p>
    </section>
  );
}

function Stat({ label, value, accent = "text-text" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] px-2 py-3">
      <AnimatePresence mode="wait">
        <motion.div key={value} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={`font-mono text-xl font-semibold ${accent}`}>
          {value}
        </motion.div>
      </AnimatePresence>
      <div className="mt-1 text-[10px] leading-tight text-muted">{label}</div>
    </div>
  );
}
