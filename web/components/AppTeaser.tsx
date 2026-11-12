"use client";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { BASE_PATH } from "@/lib/data";
import { MagneticButton, SectionHeader } from "./ui";

/** Apple-style product reveal: the workspace screen tilts up into view as you scroll. */
export default function AppTeaser() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [32, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [80, 0]);
  const glow = useTransform(scrollYProgress, [0, 1], [0, 0.55]);

  return (
    <section className="relative px-5 py-32 md:px-8">
      <SectionHeader id="lab" kicker="03 · The Quantum Workspace"
        title={<>Run the quantum dispatcher <span className="font-serif font-normal italic text-gradient">yourself</span></>}
        sub="Pick a priority, pick an algorithm, press Run. A real 12-qubit QAOA simulation runs in your browser (our Qiskit circuit, verified to match Qiskit), and you watch the quantum state reshape in 3D until the best dispatch plan rises to the top." />
      <div ref={ref} className="mx-auto mt-16 max-w-6xl" style={{ perspective: 1400 }}>
        <motion.div style={{ rotateX, scale, y }} className="relative origin-bottom">
          <motion.div style={{ opacity: glow }} className="absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(232,176,75,0.35),transparent_65%)] blur-2xl" />
          <a href={`${BASE_PATH}/app/`} data-cursor="open" className="block overflow-hidden rounded-[2rem] border border-white/10 bg-surface p-2 shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-1.5 px-3 pb-2 pt-1">
              <span className="h-2.5 w-2.5 rounded-full bg-danger/70" /><span className="h-2.5 w-2.5 rounded-full bg-signal/70" /><span className="h-2.5 w-2.5 rounded-full bg-win/70" />
              <span className="ml-3 rounded-md bg-white/5 px-3 py-0.5 font-mono text-[10px] text-muted">floodqaoa / app</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE_PATH}/workspace.png`} alt="FloodQAOA Quantum Workspace" className="w-full rounded-[1.4rem]" />
          </a>
        </motion.div>
      </div>
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <MagneticButton primary href={`${BASE_PATH}/app/`} cursor="open">Open the Workspace →</MagneticButton>
      </div>
      <div className="mx-auto mt-10 grid max-w-4xl gap-3 text-center sm:grid-cols-4">
        {[["①", "Set priority", "reach ↔ speed"], ["②", "Pick algorithm", "4 QAOA variants"], ["③", "Run", "live statevector"], ["④", "Read the plan", "checked vs exact"]].map(([n, t, s]) => (
          <div key={t} className="glass rounded-2xl px-3 py-4">
            <div className="font-mono text-flood">{n}</div>
            <div className="mt-1 text-sm font-semibold">{t}</div>
            <div className="text-[11px] text-muted">{s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
