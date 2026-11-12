"use client";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lamIndex, orderByObjective, useData, VCOLOR, VSHORT, type VariantKey } from "@/lib/data";
import { SectionHeader, ease } from "./ui";

const KEYS: VariantKey[] = ["A", "B", "C", "D"];
const FRAME_MS = 110;

export default function Lab() {
  const d = useData();
  const [mode, setMode] = useState<"solo" | "race">("solo");
  const [v, setV] = useState<VariantKey>("D");
  const [lam, setLam] = useState(0.5);
  const [frame, setFrame] = useState(-1); // -1 = before start (uniform), >= frames -> final
  const [playing, setPlaying] = useState(false);
  const li = lamIndex(d, lam);
  const maxFrames = Math.max(...KEYS.map((k) => d.runs[k][li].frames.length));
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => { if (raf.current) clearInterval(raf.current); raf.current = null; setPlaying(false); };
  const play = useCallback(() => {
    stop();
    setFrame(-1);
    setPlaying(true);
    let f = -1;
    raf.current = setInterval(() => {
      f += 1;
      setFrame(f);
      if (f >= maxFrames) { if (raf.current) clearInterval(raf.current); raf.current = null; setPlaying(false); }
    }, FRAME_MS);
  }, [maxFrames]);
  useEffect(() => () => stop(), []);
  useEffect(() => { stop(); setFrame(-1); }, [v, lam, mode]);

  return (
    <section className="relative px-5 py-32 md:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.08),transparent_60%)]" />
      <SectionHeader
        id="lab"
        kicker="03 · The quantum lab"
        title={<>Watch QAOA <span className="font-serif font-normal italic text-gradient">think</span></>}
        sub={<>Every frame below is a <b className="text-text">real snapshot</b> of our Qiskit statevector during COBYLA training. Probability flows away from impossible plans and piles onto the best one.</>}
      />

      <div className="mx-auto mt-14 max-w-6xl">
        {/* controls */}
        <div className="glass flex flex-wrap items-center gap-4 rounded-3xl p-3">
          <div className="flex rounded-2xl bg-white/[0.04] p-1">
            {(["solo", "race"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className="relative rounded-xl px-4 py-2 text-sm font-semibold">
                {mode === m && <motion.span layoutId="modepill" className="absolute inset-0 rounded-xl bg-white/10" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                <span className="relative">{m === "solo" ? "Single run" : "🏁 Quantum race"}</span>
              </button>
            ))}
          </div>
          {mode === "solo" && (
            <div className="flex flex-wrap gap-1">
              {KEYS.map((k) => (
                <button key={k} onClick={() => setV(k)}
                  className={`relative rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${v === k ? "border-transparent text-ink" : "border-line text-muted hover:text-text"}`}>
                  {v === k && <motion.span layoutId="vpill" className="absolute inset-0 rounded-xl" style={{ background: VCOLOR[k] }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                  <span className="relative">{k} · {VSHORT[k]}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex min-w-[180px] flex-1 items-center gap-3 px-2">
            <span className="font-mono text-[11px] text-muted">λ {lam.toFixed(1)}</span>
            <input aria-label="lambda" className="slider w-full" type="range" min={0} max={1} step={0.1} value={lam} onChange={(e) => setLam(parseFloat(e.target.value))} />
          </div>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} onClick={play}
            className="rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-ink shadow-[0_0_30px_rgba(34,211,238,0.4)]">
            {playing ? "Running…" : frame >= 0 ? "↻ Replay" : "▶ Run QAOA"}
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "solo" ? (
            <motion.div key="solo" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5, ease }}>
              <Solo v={v} li={li} lam={lam} frame={frame} />
            </motion.div>
          ) : (
            <motion.div key="race" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5, ease }}>
              <Race li={li} frame={frame} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function useFrameState(v: VariantKey, li: number, frame: number) {
  const d = useData();
  const run = d.runs[v][li];
  const n = run.frames.length;
  const uniform = v === "A" || v === "B" ? 1 / 4096 : 1 / 64;
  if (frame < 0) {
    const probs = d.f1.map(() => uniform);
    return { run, probs, infeasible: 1 - uniform * d.f1.length, energy: null as number | null, evalNo: 0, done: false };
  }
  const k = Math.min(frame, n - 1);
  const done = frame >= n;
  return {
    run,
    probs: done ? run.final : run.frames[k],
    infeasible: done ? 1 - run.final.reduce((a, b) => a + b, 0) : run.frame_infeasible[k],
    energy: run.energy[k] ?? null,
    evalNo: done ? run.n_evals : run.frame_eval[k] + 1,
    done,
  };
}

function Solo({ v, li, lam, frame }: { v: VariantKey; li: number; lam: number; frame: number }) {
  const d = useData();
  const order = useMemo(() => orderByObjective(d, lam), [d, lam]);
  const st = useFrameState(v, li, frame);
  const optSet = new Set(st.run.opt_index);
  const pOpt = st.run.opt_index.reduce((a, j) => a + st.probs[j], 0);
  const maxP = Math.max(0.12, ...st.probs);
  const feasible = 1 - st.infeasible;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="glass relative overflow-hidden rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-mono text-xs uppercase tracking-widest text-muted">Probability of each of the 24 valid plans · best → worst</div>
          <div className="font-mono text-xs text-muted">eval <span className="text-text">{st.evalNo}</span></div>
        </div>
        <div className="flex h-72 items-end gap-[3px]">
          {/* infeasible mass bar */}
          <div className="mr-3 flex h-full w-14 flex-col items-center justify-end">
            <motion.div className="w-full rounded-t-lg bg-gradient-to-t from-danger/70 to-danger/20" animate={{ height: `${st.infeasible * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
            <div className="mt-2 text-center font-mono text-[9px] leading-tight text-danger">invalid<br />{(st.infeasible * 100).toFixed(0)}%</div>
          </div>
          {order.map((j, rank) => {
            const isOpt = optSet.has(j);
            return (
              <div key={j} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                {isOpt && st.done && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.5 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 12 }} className="mb-1 text-lg leading-none">👑</motion.div>
                )}
                <motion.div
                  className="w-full rounded-t-md"
                  style={{ background: isOpt ? VCOLOR[v] : `rgba(148,163,184,${0.55 - rank * 0.015})`, boxShadow: isOpt ? `0 0 24px ${VCOLOR[v]}` : "none" }}
                  animate={{ height: `${Math.max(0.6, (st.probs[j] / maxP) * 88)}%` }}
                  transition={{ type: "spring", stiffness: 140, damping: 18 }}
                />
                <div className="pointer-events-none absolute bottom-full mb-6 hidden w-40 rounded-xl border border-line bg-surface p-2 text-[10px] group-hover:block">
                  <div className="font-mono text-muted">#{rank + 1} · p = {st.probs[j].toFixed(4)}</div>
                  {d.teams.map((t, ti) => <div key={t.id}>{t.id} → {d.plans[j][ti]}</div>)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between pl-[68px] font-mono text-[10px] text-muted">
          <span>← optimal plan</span><span>worst valid plan →</span>
        </div>

        <AnimatePresence>
          {st.done && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-win/30 bg-win/[0.07] px-4 py-3 text-sm">
              <Burst color={VCOLOR[v]} />
              <span className="font-semibold text-win">{st.run.found_optimum ? "✓ Best sampled plan = exact brute-force optimum" : "✗ Missed the exact optimum"}</span>
              <span className="text-muted">· {st.run.best_plan.map(([t, s]) => `${t}→${s}`).join("  ")}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4">
        <Gauge label="P(optimal plan)" value={pOpt} max={0.15} color={VCOLOR[v]} fmt={(x) => x.toFixed(3)}
          foot={`random guess: ${v === "A" || v === "B" ? "1/4096" : "1/64 (within valid-shape space)"}`} />
        <Gauge label="P(valid plan)" value={feasible} max={1} color="#34d399" fmt={(x) => (x * 100).toFixed(1) + "%"} foot="uniform random: 0.6%" />
        <EnergyCard run={st.run} frame={frame} color={VCOLOR[v]} />
      </div>
    </div>
  );
}

function Gauge({ label, value, max, color, fmt, foot }: { label: string; value: number; max: number; color: string; fmt: (x: number) => string; foot: string }) {
  const pct = Math.min(1, value / max);
  return (
    <div className="glass rounded-3xl p-5">
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-2 font-mono text-4xl font-semibold" style={{ color }}>{fmt(value)}</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${pct * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>
      <div className="mt-2 text-[11px] text-muted">{foot}</div>
    </div>
  );
}

function EnergyCard({ run, frame, color }: { run: { energy: number[] }; frame: number; color: string }) {
  const e = run.energy;
  if (!e.length) return null;
  const n = e.length, lo = Math.min(...e), hi = Math.max(...e);
  const W = 260, H = 90;
  const pts = e.map((y, i) => `${(i / Math.max(1, n - 1)) * W},${H - ((y - lo) / (hi - lo || 1)) * (H - 10) - 5}`);
  const shown = frame < 0 ? 0 : Math.min(frame + 1, n);
  return (
    <div className="glass rounded-3xl p-5">
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted">Training objective ↓</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full">
        <polyline points={pts.join(" ")} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={2} />
        {shown > 1 && <polyline points={pts.slice(0, shown).join(" ")} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />}
        {shown > 0 && (() => { const [x, y] = pts[shown - 1].split(",").map(Number); return <circle cx={x} cy={y} r={4} fill="#fff" />; })()}
      </svg>
      <div className="mt-1 text-[11px] text-muted">best-so-far energy / CVaR (COBYLA)</div>
    </div>
  );
}

function Burst({ color }: { color: string }) {
  return (
    <span className="relative inline-block h-4 w-4">
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <motion.span key={i} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full" style={{ background: color }}
            initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(a) * 26, y: Math.sin(a) * 26, opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }} />
        );
      })}
    </span>
  );
}

function Race({ li, frame }: { li: number; frame: number }) {
  const d = useData();
  const results = KEYS.map((k) => {
    const st = frameStateFor(d, k, li, frame);
    return { k, ...st };
  });
  const finished = frame >= Math.max(...KEYS.map((k) => d.runs[k][li].frames.length));
  const winner = finished ? results.reduce((a, b) => (b.pOpt > a.pOpt ? b : a)) : null;
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {results.map((r) => (
        <motion.div key={r.k} layout className={`glass relative overflow-hidden rounded-3xl p-5 ${winner?.k === r.k ? "beam-border" : ""}`}>
          <div className="flex items-center justify-between">
            <span className="rounded-lg px-2 py-0.5 font-mono text-xs font-bold text-ink" style={{ background: VCOLOR[r.k] }}>{r.k}</span>
            {winner?.k === r.k && <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} className="text-xl">🏆</motion.span>}
          </div>
          <div className="mt-3 text-sm font-semibold">{VSHORT[r.k]}</div>
          <div className="font-mono text-[10px] text-muted">{r.k === "A" || r.k === "B" ? "X-mixer · penalties" : "XY-mixer · one-hot built in"}</div>
          <div className="mt-5 font-mono text-[10px] uppercase tracking-widest text-muted">P(optimal)</div>
          <div className="font-mono text-3xl font-semibold" style={{ color: VCOLOR[r.k] }}>{r.pOpt.toFixed(3)}</div>
          <div className="mt-2 h-24 overflow-hidden rounded-xl bg-white/[0.03]">
            <div className="flex h-full items-end">
              <motion.div className="w-full" style={{ background: `linear-gradient(to top, ${VCOLOR[r.k]}, transparent)` }} animate={{ height: `${Math.min(1, r.pOpt / 0.12) * 100}%` }} transition={{ type: "spring", stiffness: 100, damping: 18 }} />
            </div>
          </div>
          <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted">valid plans</div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
            <motion.div className="h-full rounded-full bg-win" animate={{ width: `${(1 - r.infeasible) * 100}%` }} />
          </div>
          <div className="mt-1 font-mono text-xs text-muted">{((1 - r.infeasible) * 100).toFixed(1)}%</div>
        </motion.div>
      ))}
      <p className="col-span-full text-center text-xs text-muted">Same problem, same λ, same budget. Only the mixer and the training objective differ. Numbers are exact statevector probabilities from our runs.</p>
    </div>
  );
}

function frameStateFor(d: ReturnType<typeof useData>, v: VariantKey, li: number, frame: number) {
  const run = d.runs[v][li];
  const n = run.frames.length;
  const uniform = v === "A" || v === "B" ? 1 / 4096 : 1 / 64;
  let probs: number[], infeasible: number;
  if (frame < 0) { probs = d.f1.map(() => uniform); infeasible = 1 - uniform * d.f1.length; }
  else if (frame >= n) { probs = run.final; infeasible = 1 - run.final.reduce((a, b) => a + b, 0); }
  else { probs = run.frames[frame]; infeasible = run.frame_infeasible[frame]; }
  return { pOpt: run.opt_index.reduce((a, j) => a + probs[j], 0), infeasible };
}
