"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { lamIndex, useData, VCOLOR, VSHORT, type VariantKey } from "@/lib/data";

const KEYS: VariantKey[] = ["A", "B", "C", "D"];

/** All four algorithms trained on the same problem, replayed side by side (recorded Qiskit runs). */
export default function RaceView({ lam }: { lam: number }) {
  const d = useData();
  const li = lamIndex(d, lam);
  const [f, setF] = useState(-1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxF = Math.max(...KEYS.map((k) => d.runs[k][li].frames.length));
  const start = () => {
    if (timer.current) clearInterval(timer.current);
    setF(0);
    let i = 0;
    timer.current = setInterval(() => { i++; setF(i); if (i > maxF && timer.current) clearInterval(timer.current); }, 120);
  };
  useEffect(() => { setF(-1); return () => { if (timer.current) clearInterval(timer.current); }; }, [li]);

  const rows = KEYS.map((k) => {
    const r = d.runs[k][li], n = r.frames.length;
    const probs = f < 0 ? null : f >= n ? r.final : r.frames[f];
    const pOpt = probs ? r.opt_index.reduce((a, j) => a + probs[j], 0) : (k === "A" || k === "B" ? 1 / 4096 : 1 / 64);
    const valid = probs ? probs.reduce((a, b) => a + b, 0) : (k === "A" || k === "B" ? 24 / 4096 : 24 / 64);
    return { k, pOpt, valid };
  });
  const done = f > maxF;
  const leader = rows.reduce((a, b) => (b.pOpt > a.pOpt ? b : a));

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="text-sm text-muted">Same problem, same λ = {d.meta.lams[li].toFixed(1)}. Only the mixer and training objective differ.</div>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} onClick={start} data-cursor="race"
          className="rounded-xl bg-flood px-4 py-2 text-sm font-bold text-ink shadow-[0_0_24px_rgba(232,176,75,0.45)]">
          {f < 0 ? "🏁 Start race" : done ? "↻ Again" : "racing…"}
        </motion.button>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-5">
        {rows.map((r) => (
          <div key={r.k}>
            <div className="mb-1.5 flex items-center gap-2 text-sm">
              <span className="rounded-md px-1.5 font-mono text-[10px] font-bold text-ink" style={{ background: VCOLOR[r.k] }}>{r.k}</span>
              <span className="font-semibold">{VSHORT[r.k]}</span>
              <AnimatePresence>{done && leader.k === r.k && <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} className="text-lg">🏆</motion.span>}</AnimatePresence>
              <span className="ml-auto font-mono text-xs text-muted">valid {(r.valid * 100).toFixed(0)}%</span>
              <span className="w-16 text-right font-mono text-sm tabular-nums" style={{ color: VCOLOR[r.k] }}>{r.pOpt.toFixed(3)}</span>
            </div>
            <div className="relative h-4 overflow-hidden rounded-full bg-white/5">
              <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: `linear-gradient(90deg, ${VCOLOR[r.k]}33, ${VCOLOR[r.k]})`, boxShadow: `0 0 16px ${VCOLOR[r.k]}88` }}
                animate={{ width: `${Math.min(100, (r.pOpt / 0.11) * 100)}%` }} transition={{ type: "spring", stiffness: 90, damping: 16 }} />
              <motion.div className="absolute inset-y-0 w-[2px] bg-white" animate={{ left: `${Math.min(100, (r.pOpt / 0.11) * 100)}%` }} transition={{ type: "spring", stiffness: 90, damping: 16 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 font-mono text-[10px] text-muted">bar = probability of sampling the exact optimal plan · replay of recorded Qiskit 2.6 training</div>
    </div>
  );
}
