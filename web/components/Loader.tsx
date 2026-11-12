"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ease } from "./ui";

const LOG = [
  "loading scenario · Sindh, Aug 2022",
  "3 teams × 4 flooded sites → 12 qubits",
  "building QUBO · to_ising() · Z + ZZ terms",
  "superposition over 4,096 dispatch plans",
  "replaying QAOA training traces",
  "measuring…",
];
const TEAMS = ["BOAT", "MED", "SUP"];
const SITES = ["JOHI", "KNS", "DADU", "JCD"];
// balanced (λ=0.5) optimum: BOAT→KNS, MED→DADU, SUP→JCD
const COLLAPSE = new Set(["0-1", "1-2", "2-3"]);

export default function Loader({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [line, setLine] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (line < LOG.length - 1) {
      const t = setTimeout(() => setLine((l) => l + 1), 330);
      return () => clearTimeout(t);
    }
  }, [line]);

  useEffect(() => {
    if (ready && line >= LOG.length - 1 && !collapsed) {
      const t = setTimeout(() => setCollapsed(true), 250);
      return () => clearTimeout(t);
    }
  }, [ready, line, collapsed]);

  useEffect(() => {
    if (!collapsed) return;
    const t = setTimeout(() => { setGone(true); onDone(); }, 1250);
    return () => clearTimeout(t);
  }, [collapsed, onDone]);

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          key="loader"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink"
          exit={{ clipPath: "circle(0% at 50% 45%)", transition: { duration: 0.9, ease } }}
          initial={{ clipPath: "circle(150% at 50% 45%)" }}
          onClick={() => ready && setCollapsed(true)}
        >
          <div className="grid-bg absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="mb-6 flex justify-between pl-14 pr-1 font-mono text-[10px] tracking-widest text-muted">
              {SITES.map((s) => <span key={s} className="w-12 text-center">{s}</span>)}
            </div>
            {TEAMS.map((t, ti) => (
              <div key={t} className="mb-4 flex items-center gap-2">
                <span className="w-12 font-mono text-[10px] tracking-widest text-muted">{t}</span>
                {SITES.map((s, si) => {
                  const on = COLLAPSE.has(`${ti}-${si}`);
                  return (
                    <div key={s} className="relative flex h-12 w-12 items-center justify-center">
                      <motion.div
                        className="absolute h-10 w-10 rounded-full"
                        style={{ background: "radial-gradient(circle at 35% 30%, #a5f3fc, #22d3ee 35%, #6d28d9 80%)" }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={
                          collapsed
                            ? on
                              ? { scale: 1.15, opacity: 1, boxShadow: "0 0 40px 8px rgba(52,211,153,0.6)", background: "radial-gradient(circle at 35% 30%, #d1fae5, #34d399 45%, #065f46 90%)" }
                              : { scale: 0.25, opacity: 0.15 }
                            : { scale: [0.55, 0.95, 0.55], opacity: [0.35, 1, 0.35] }
                        }
                        transition={
                          collapsed
                            ? { duration: 0.6, ease, delay: on ? 0.1 : (ti + si) * 0.03 }
                            : { duration: 1.2 + ((ti * 4 + si) % 5) * 0.17, repeat: Infinity, ease: "easeInOut", delay: (ti * 4 + si) * 0.07 }
                        }
                      />
                      <motion.span
                        className="relative font-mono text-[10px] font-bold text-ink"
                        animate={{ opacity: collapsed && on ? 1 : 0 }}
                      >
                        1
                      </motion.span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="relative mt-8 h-32 w-[min(420px,88vw)] font-mono text-xs">
            {LOG.slice(0, line + 1).map((l, i) => (
              <motion.div
                key={l}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: i === line ? 1 : 0.4, x: 0 }}
                className="flex gap-2 py-0.5"
              >
                <span className="text-flood">{i < line || (ready && collapsed) ? "✓" : "›"}</span>
                <span className="text-text/90">{l}</span>
              </motion.div>
            ))}
          </div>
          <AnimatePresence>
            {collapsed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative -mt-2 font-mono text-sm text-win"
              >
                |0100 0010 0001⟩ → Boat→KNS · Medical→Dadu · Convoy→Jacobabad
              </motion.div>
            )}
          </AnimatePresence>
          <div className="absolute bottom-8 font-mono text-[10px] tracking-widest text-muted/60">
            {ready ? "CLICK TO SKIP" : "LOADING REAL QAOA DATA…"}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
