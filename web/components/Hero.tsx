"use client";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { BASE_PATH } from "@/lib/data";
import FlowField from "./FlowField";
import { CountUp, MagneticButton, ease } from "./ui";

const QubitRegister3D = dynamic(() => import("./three/QubitRegister3D"), { ssr: false });

const words = ["When", "a", "third", "of", "a", "country", "floods,"];

export default function Hero({ start }: { start: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [measured, setMeasured] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const op = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale3d = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
  const d = (i: number) => (start ? 0.15 + i * 0.07 : 99);

  return (
    <section ref={ref} id="top" className="relative flex min-h-[100svh] items-center overflow-hidden">
      <FlowField className="absolute inset-0 h-full w-full opacity-40" density={0.00025} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(167,139,250,0.10),transparent_50%)]" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-ink" />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-6 px-5 pb-16 pt-28 md:px-8 lg:grid-cols-[1.05fr_1fr]">
        <motion.div style={{ y, opacity: op }} className="relative z-10 order-2 lg:order-1">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={start ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, ease }}
            className="mb-7 inline-flex items-center gap-3 rounded-full border border-line bg-white/[0.04] px-4 py-1.5 text-xs text-muted backdrop-blur">
            <span className="rounded-full bg-flood/15 px-2 py-0.5 font-mono text-[10px] text-flood">QISKIT FALL FEST 2026</span>
            Disaster Response · Quantum Optimization
          </motion.div>

          <h1 className="text-[11vw] font-semibold leading-[0.95] tracking-[-0.045em] sm:text-6xl xl:text-[4.9rem]">
            {words.map((w, i) => (
              <motion.span key={i} className="mr-[0.22em] inline-block"
                initial={{ opacity: 0, y: 40, filter: "blur(12px)" }} animate={start ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.9, ease, delay: d(i) }}>{w}</motion.span>
            ))}
            <br />
            <motion.span className="font-serif text-[1.08em] font-normal italic text-gradient"
              initial={{ opacity: 0, y: 40, filter: "blur(12px)" }} animate={start ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
              transition={{ duration: 1.1, ease, delay: d(words.length) }}>who goes where?</motion.span>
          </h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={start ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.9, ease, delay: d(9) }}
            className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-muted">
            <span className="text-text">FloodQAOA</span> uses a <span className="text-flood">quantum algorithm</span> to dispatch scarce rescue
            teams across Sindh’s 2022 flood zone, and shows commanders the full trade-off between <span className="text-text">reaching more people</span> and <span className="text-text">getting there faster</span>.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={start ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.9, ease, delay: d(10) }}
            className="mt-9 flex flex-wrap gap-3">
            <MagneticButton primary href={`${BASE_PATH}/app/`} cursor="open">Launch the Quantum Workspace →</MagneticButton>
            <MagneticButton href="#dilemma" cursor="scroll">How it works ↓</MagneticButton>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={start ? { opacity: 1 } : {}} transition={{ duration: 1, delay: d(12) }}
            className="mt-12 grid max-w-xl grid-cols-2 gap-6 border-t border-line pt-7 sm:grid-cols-4">
            {[{ n: 33, s: "M", l: "people affected" }, { n: 12, s: "", l: "qubits" }, { n: 4096, s: "", l: "plans in superposition" }, { n: 26, s: "", l: "tests passing" }].map((k) => (
              <div key={k.l}>
                <div className="font-mono text-2xl font-semibold text-text md:text-3xl">{start && <CountUp to={k.n} suffix={k.s} />}</div>
                <div className="mt-1 text-[11px] text-muted">{k.l}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div style={{ scale: scale3d }} initial={{ opacity: 0, scale: 0.9 }} animate={start ? { opacity: 1 } : {}} transition={{ duration: 1.4, ease, delay: 0.2 }}
          className="relative order-1 h-[42vh] min-h-[320px] lg:order-2 lg:h-[72vh]">
          <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_78%)]">{start && <QubitRegister3D measured={measured} onToggle={() => setMeasured((m) => !m)} />}</div>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
            <AnimatePresence mode="wait">
              <motion.div key={String(measured)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="glass rounded-full px-4 py-2 font-mono text-[11px] text-muted">
                {measured
                  ? <><span className="text-win">|0100·0010·0001⟩</span> Boat→KNS · Medical→Dadu · Convoy→Jacobabad · click to reset</>
                  : <>12 qubits in superposition · <span className="text-text">move to tilt · hover to excite · click to measure</span></>}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
