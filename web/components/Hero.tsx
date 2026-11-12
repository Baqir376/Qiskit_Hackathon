"use client";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { useRef } from "react";
import FlowField from "./FlowField";
import { CountUp, MagneticButton, ease } from "./ui";

const words = ["When", "a", "third", "of", "a", "country", "floods,"];

export default function Hero({ start }: { start: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const op = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const mx = useMotionValue(-999), my = useMotionValue(-999);
  const sx = useSpring(mx, { stiffness: 120, damping: 20 }), sy = useSpring(my, { stiffness: 120, damping: 20 });
  const spot = useTransform([sx, sy] as never, ([x, y]: number[]) =>
    `radial-gradient(520px circle at ${x}px ${y}px, rgba(34,211,238,0.13), transparent 65%)`);

  const d = (i: number) => (start ? 0.15 + i * 0.07 : 99);

  return (
    <section
      ref={ref}
      id="top"
      onPointerMove={(e) => { const r = ref.current!.getBoundingClientRect(); mx.set(e.clientX - r.left); my.set(e.clientY - r.top); }}
      className="relative flex min-h-[100svh] items-center overflow-hidden"
    >
      <FlowField className="absolute inset-0 h-full w-full opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(167,139,250,0.12),transparent_50%)]" />
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: spot }} />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-ink" />

      <motion.div style={{ y, opacity: op }} className="relative mx-auto w-full max-w-6xl px-5 pb-20 pt-32 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={start ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease }}
          className="mb-8 inline-flex items-center gap-3 rounded-full border border-line bg-white/[0.04] px-4 py-1.5 text-xs text-muted backdrop-blur"
        >
          <span className="rounded-full bg-flood/15 px-2 py-0.5 font-mono text-[10px] text-flood">QISKIT FALL FEST 2026</span>
          Disaster Response · Quantum Optimization
        </motion.div>

        <h1 className="max-w-5xl text-[12vw] font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl md:text-7xl xl:text-[5.4rem]">
          {words.map((w, i) => (
            <motion.span
              key={i}
              className="mr-[0.22em] inline-block"
              initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
              animate={start ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
              transition={{ duration: 0.9, ease, delay: d(i) }}
            >
              {w}
            </motion.span>
          ))}
          <br />
          <motion.span
            className="font-serif text-[1.08em] font-normal italic text-gradient"
            initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
            animate={start ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{ duration: 1.1, ease, delay: d(words.length) }}
          >
            who goes where?
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={start ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease, delay: d(words.length + 2) }}
          className="mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-muted md:text-xl"
        >
          <span className="text-text">FloodQAOA</span> dispatches scarce rescue teams across Sindh’s 2022 flood zone
          with a <span className="text-flood">quantum algorithm</span>, and shows commanders the whole trade-off
          between <span className="text-text">reaching more people</span> and <span className="text-text">getting there faster</span>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={start ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease, delay: d(words.length + 3) }}
          className="mt-10 flex flex-wrap gap-3"
        >
          <MagneticButton primary href="#lab">▶ Watch QAOA think</MagneticButton>
          <MagneticButton href="#dilemma">See the dilemma ↓</MagneticButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={start ? { opacity: 1 } : {}}
          transition={{ duration: 1, delay: d(words.length + 5) }}
          className="mt-12 grid max-w-3xl grid-cols-2 gap-6 border-t border-line pt-8 md:grid-cols-4"
        >
          {[
            { n: 33, s: "M", l: "people affected (2022)" },
            { n: 12, s: "", l: "qubits · one per decision" },
            { n: 4096, s: "", l: "plans in superposition" },
            { n: 26, s: "", l: "correctness tests passing" },
          ].map((k) => (
            <div key={k.l}>
              <div className="font-mono text-3xl font-semibold text-text md:text-4xl">
                {start && <CountUp to={k.n} suffix={k.s} />}
              </div>
              <div className="mt-1 text-xs text-muted">{k.l}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

    </section>
  );
}
