"use client";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

/** Premium cursor: exact dot + spring-lagged ring (difference blend). Grows + shows a label over
 *  interactive elements (`data-cursor="Run"`), and every click emits a small qubit burst. */
export default function Cursor() {
  const x = useMotionValue(-100), y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 350, damping: 28, mass: 0.6 });
  const ry = useSpring(y, { stiffness: 350, damping: 28, mass: 0.6 });
  const [hover, setHover] = useState<string | null>(null);
  const [down, setDown] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEnabled(fine);
    if (!fine) return;
    document.documentElement.classList.add("custom-cursor");
    const move = (e: PointerEvent) => {
      x.set(e.clientX); y.set(e.clientY);
      const el = (e.target as HTMLElement)?.closest?.("a,button,input,[data-cursor],canvas") as HTMLElement | null;
      setHover(el ? el.dataset.cursor ?? (el.tagName === "CANVAS" ? "drag" : el.tagName === "INPUT" ? "slide" : "") : null);
    };
    const dn = (e: PointerEvent) => {
      setDown(true);
      const id = Date.now() + Math.random();
      setBursts((b) => [...b.slice(-4), { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setBursts((b) => b.filter((q) => q.id !== id)), 900);
    };
    const up = () => setDown(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", dn);
    window.addEventListener("pointerup", up);
    return () => {
      document.documentElement.classList.remove("custom-cursor");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", dn);
      window.removeEventListener("pointerup", up);
    };
  }, [x, y]);

  if (!enabled) return null;
  const size = hover !== null ? (hover ? 76 : 52) : 34;
  return (
    <>
      <motion.div className="pointer-events-none fixed left-0 top-0 z-[200] rounded-full mix-blend-difference"
        style={{ x: rx, y: ry, translateX: "-50%", translateY: "-50%" }}
        animate={{ width: size, height: size, backgroundColor: hover ? "rgba(255,255,255,1)" : "rgba(255,255,255,0)", borderWidth: hover ? 0 : 1.5, scale: down ? 0.82 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        <div className="h-full w-full rounded-full border-white" style={{ borderWidth: "inherit", borderStyle: "solid", borderColor: "white" }} />
        <AnimatePresence>
          {hover && (
            <motion.span key={hover} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-widest text-black">
              {hover}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <motion.div className="pointer-events-none fixed left-0 top-0 z-[201] h-1.5 w-1.5 rounded-full bg-flood"
        style={{ x, y, translateX: "-50%", translateY: "-50%" }} animate={{ opacity: hover ? 0 : 1 }} />
      {bursts.map((b) => (
        <div key={b.id} className="pointer-events-none fixed z-[199]" style={{ left: b.x, top: b.y }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const col = ["#22d3ee", "#a78bfa", "#34d399"][i % 3];
            return (
              <motion.span key={i} className="absolute h-1.5 w-1.5 rounded-full" style={{ background: col, boxShadow: `0 0 8px ${col}` }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(a) * 46, y: Math.sin(a) * 46, opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }} />
            );
          })}
          <motion.span className="absolute -left-4 -top-4 h-8 w-8 rounded-full border border-flood" initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.7 }} />
        </div>
      ))}
    </>
  );
}
