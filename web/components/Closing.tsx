"use client";
import { motion } from "motion/react";
import { useState } from "react";
import { BASE_PATH } from "@/lib/data";
import { MagneticButton, Reveal, SectionHeader } from "./ui";

const REPO = "https://github.com/Baqir376/Qiskit_Hackathon";

const HONEST = [
  { icon: "⚡", t: "No quantum speedup, and we don't claim one", b: "At 12 qubits, brute force over 4,096 states takes milliseconds. Our contribution is a validated mapping and evidence about which QAOA design choices matter." },
  { icon: "📡", t: "Noise erases most of the gain", b: "Re-running the trained circuits on an IBM Torino noise model (~380 two-qubit gates) drops valid-plan probability from 0.8–0.98 to about 0.13. Real hardware would need error mitigation." },
  { icon: "🎚️", t: "Penalty weights are fragile", b: "Too small and the ground state is wrong (below P ≈ 0.25). Too large and training collapses (P = 4). The XY mixer removes one penalty, but not the capacity one." },
  { icon: "🧭", t: "Weighted sums miss part of the front", b: "One Pareto-optimal plan is unreachable by any λ. Pooling samples recovers it, but ε-constraint methods would be the principled fix." },
  { icon: "📈", t: "Qubits grow as teams × sites", b: "A real district (20 teams × 30 sites) would need 600 qubits. Decomposition by corridor and parameter transfer are the path forward." },
  { icon: "🗺️", t: "Real places, synthetic needs", b: "Coordinates are real Sindh towns; population, need and access numbers are illustrative, not NDMA/PDMA data. Distances are straight-line × 1.3, not road routing." },
];

const PIPE = [
  { t: "Scenario", s: "Sindh 2022 JSON" },
  { t: "QUBO", s: "QuadraticProgram" },
  { t: "Ising", s: "12 qubits · Z, ZZ" },
  { t: "QAOA", s: "X / XY mixer" },
  { t: "Optimiser", s: "COBYLA · ⟨H⟩ / CVaR" },
  { t: "Validate", s: "brute force · Pareto" },
];

export default function Closing() {
  return (
    <>
      <section className="relative px-5 py-32 md:px-8">
        <SectionHeader id="honest" kicker="06 · What didn't work" title={<>The honest <span className="font-serif font-normal italic text-danger">scoreboard</span></>}
          sub="The brief says limitations count in our favour. Here's ours, measured, not hand-waved." />
        <div className="mx-auto mt-14 grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-3">
          {HONEST.map((h, i) => (
            <Reveal key={h.t} delay={i * 0.06}>
              <motion.div whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="glass h-full rounded-3xl p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-xl">{h.icon}</div>
                <h3 className="mt-4 text-lg font-semibold">{h.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{h.b}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative px-5 py-32 md:px-8">
        <SectionHeader id="architecture" kicker="07 · Architecture" title={<>Hybrid quantum–classical <span className="font-serif font-normal italic text-quantum">loop</span></>} />
        <Reveal className="mx-auto mt-14 max-w-6xl">
          <div className="glass relative overflow-hidden rounded-3xl p-8">
            <div className="relative grid grid-cols-2 gap-6 md:grid-cols-6">
              {PIPE.map((p, i) => (
                <motion.div key={p.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                  className={`relative rounded-2xl border border-line bg-surface-2 p-4 text-center ${i === 3 ? "beam-border" : ""}`}>
                  <div className="font-mono text-[10px] text-muted">0{i + 1}</div>
                  <div className="mt-1 font-semibold">{p.t}</div>
                  <div className="mt-1 font-mono text-[10px] text-muted">{p.s}</div>
                </motion.div>
              ))}
            </div>
            <svg className="pointer-events-none absolute inset-x-8 top-1/2 hidden h-8 -translate-y-1/2 md:block" preserveAspectRatio="none" viewBox="0 0 100 10" style={{ width: "calc(100% - 4rem)", zIndex: -1 }}>
              <line x1="0" y1="5" x2="100" y2="5" stroke="rgba(148,163,184,0.2)" strokeWidth="0.3" />
              <line x1="0" y1="5" x2="100" y2="5" stroke="#22d3ee" strokeWidth="0.6" strokeDasharray="6 94">
                <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2.5s" repeatCount="indefinite" />
              </line>
            </svg>
            <div className="mt-8 flex items-center justify-center gap-3 font-mono text-xs text-muted">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="inline-block text-flood">↻</motion.span>
              parameters γ, β fed back each iteration · warm-started across λ
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE_PATH}/architecture.png`} alt="Detailed architecture diagram" className="mt-8 w-full rounded-2xl border border-line bg-white" />
          </div>
        </Reveal>
      </section>

      <section className="relative overflow-hidden px-5 pb-16 pt-32 md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(34,211,238,0.12),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <Reveal>
            <h2 className="text-balance text-5xl font-semibold tracking-tight md:text-7xl">
              Decisions under pressure,<br /><span className="font-serif font-normal italic text-gradient">every trade-off visible.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <MagneticButton primary href={REPO}>★ GitHub repository</MagneticButton>
              <MagneticButton href={`${BASE_PATH}/FloodQAOA_Report.docx`}>⇩ Full report (.docx)</MagneticButton>
            </div>
          </Reveal>
          <Reveal delay={0.2}><RunIt /></Reveal>
        </div>
        <footer className="relative mx-auto mt-24 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-line pt-8 text-sm text-muted md:flex-row">
          <div>
            <span className="font-semibold text-text">FloodQAOA</span> · Qiskit Fall Fest 2026 · Disaster Response
          </div>
          <div>Team: <span className="text-text">Baqir Raza · M. Ali Reza · Balaaj Raza</span></div>
        </footer>
      </section>
    </>
  );
}

function RunIt() {
  const cmd = `git clone ${REPO}.git\ncd Qiskit_Hackathon && python -m venv .venv\n.venv\\Scripts\\activate && pip install -r requirements.txt\npytest && streamlit run app.py`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="glass mx-auto mt-10 max-w-2xl rounded-2xl text-left">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-danger/70" /><span className="h-2.5 w-2.5 rounded-full bg-signal/70" /><span className="h-2.5 w-2.5 rounded-full bg-win/70" /></div>
        <button onClick={() => { navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="font-mono text-xs text-muted hover:text-text">
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-text/90">{cmd}</pre>
    </div>
  );
}
