"use client";
import { motion, useScroll, useSpring } from "motion/react";
import { useEffect, useState } from "react";

const LINKS = [
  ["dilemma", "Dilemma"],
  ["qubits", "Qubits"],
  ["lab", "Lab"],
  ["pareto", "Trade-offs"],
  ["results", "Results"],
  ["honest", "Limits"],
] as const;

export default function Nav({ show }: { show: boolean }) {
  const { scrollYProgress } = useScroll();
  const w = useSpring(scrollYProgress, { stiffness: 120, damping: 25 });
  const [active, setActive] = useState("");
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-40% 0px -55% 0px" });
    LINKS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [show]);
  return (
    <>
      <motion.div className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-flood via-quantum to-win" style={{ scaleX: w }} />
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={show ? { y: 0, opacity: 1 } : {}}
        transition={{ delay: 1.2, type: "spring", stiffness: 200, damping: 24 }}
        className="fixed left-1/2 top-4 z-50 -translate-x-1/2"
      >
        <div className="flex items-center gap-1 rounded-full border border-line bg-[#060a12]/90 px-2 py-1.5 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
          <a href="#top" className="mr-2 flex items-center gap-2 pl-2 text-sm font-bold">
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-flood/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-flood" />
            </span>
            <span className="hidden sm:inline">FloodQAOA</span>
          </a>
          {LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="relative hidden rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-text md:block">
              {active === id && <motion.span layoutId="navpill" className="absolute inset-0 rounded-full bg-white/10" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative">{label}</span>
            </a>
          ))}
          <a href="https://github.com/Baqir376/Qiskit_Hackathon" target="_blank" rel="noreferrer" className="ml-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink">GitHub</a>
        </div>
      </motion.nav>
    </>
  );
}
