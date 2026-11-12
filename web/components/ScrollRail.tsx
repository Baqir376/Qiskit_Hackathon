"use client";
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useState } from "react";

const CHAPTERS = [
  ["top", "Intro"],
  ["dilemma", "The dilemma"],
  ["qubits", "Flood → qubits"],
  ["lab", "Workspace"],
  ["pareto", "Trade-offs"],
  ["results", "Results"],
  ["honest", "Limits"],
] as const;

/** Vertical chapter rail on the left: fills with scroll, comet head glows, chapters light up. */
export default function ScrollRail({ show }: { show: boolean }) {
  const { scrollYProgress } = useScroll();
  const fill = useSpring(scrollYProgress, { stiffness: 90, damping: 22, mass: 0.4 });
  const headTop = useTransform(fill, (v) => `${v * 100}%`);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const els = CHAPTERS.map(([id]) => document.getElementById(id));
    const onScroll = () => {
      const mid = window.innerHeight * 0.45;
      let a = 0;
      els.forEach((el, i) => { if (el && el.getBoundingClientRect().top < mid) a = i; });
      setActive(a);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [show]);

  return (
    <motion.aside initial={{ opacity: 0, x: -30 }} animate={show ? { opacity: 1, x: 0 } : {}} transition={{ delay: 1.4, duration: 0.8 }}
      className="fixed left-6 top-1/2 z-40 hidden h-[62vh] -translate-y-1/2 lg:block" aria-label="Page chapters">
      <div className="relative h-full w-px bg-white/10">
        <motion.div className="absolute left-0 top-0 w-px origin-top bg-gradient-to-b from-river via-flood to-danger" style={{ scaleY: fill, height: "100%" }} />
        <motion.div className="absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flood" style={{ top: headTop, boxShadow: "0 0 16px 4px rgba(232,176,75,0.7)" }} />
        {CHAPTERS.map(([id, label], i) => {
          const top = `${(i / (CHAPTERS.length - 1)) * 100}%`;
          const on = i <= active, cur = i === active;
          return (
            <a key={id} href={`#${id}`} data-cursor="jump" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
              className="group absolute left-1/2 -translate-x-1/2 -translate-y-1/2 p-2" style={{ top }} aria-label={label}>
              <motion.span className="block rounded-full border"
                animate={{ width: cur ? 12 : 8, height: cur ? 12 : 8, backgroundColor: on ? "#E8B04B" : "#0C0F1E", borderColor: on ? "#E8B04B" : "rgba(243,236,221,0.35)" }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }} />
              <AnimatePresence>
                {(cur || hover === i) && (
                  <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                    className="absolute left-7 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-ink/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-text backdrop-blur">
                    <span className={hover === i ? "mr-1.5 text-flood" : "text-flood"}>0{i}</span>{hover === i ? label : ""}
                  </motion.span>
                )}
              </AnimatePresence>
            </a>
          );
        })}
      </div>
    </motion.aside>
  );
}
