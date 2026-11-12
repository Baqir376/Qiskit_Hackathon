"use client";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BASE_PATH, lamIndex, orderByObjective, useData, VCOLOR, VSHORT, type VariantKey } from "@/lib/data";
import { costDiagonal, DIM, evaluate, isFeasible, multiStart, qaoaProbabilities, sampleShots, sortedOrder, type Scenario } from "@/lib/qsim";
import SindhMap, { TEAM_COL, TEAM_ICON } from "../SindhMap";
import { ease, GlassPanel, Ticker } from "../ui";

const Skyline3D = dynamic(() => import("../three/Skyline3D"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center font-mono text-xs text-muted">loading 3D…</div> });

const KEYS: VariantKey[] = ["A", "B", "C", "D"];
const INFO: Record<VariantKey, { mixer: "x" | "xy"; obj: "expectation" | "cvar"; blurb: string }> = {
  A: { mixer: "x", obj: "expectation", blurb: "Textbook QAOA. Rules enforced only by penalties." },
  B: { mixer: "x", obj: "cvar", blurb: "Trains on the best 10% of outcomes (CVaR)." },
  C: { mixer: "xy", obj: "expectation", blurb: "XY mixer: a team can never be in two places." },
  D: { mixer: "xy", obj: "cvar", blurb: "XY mixer + CVaR. Our best performer." },
};
const PRESETS = [{ l: "Max reach", v: 0 }, { l: "Balanced", v: 0.5 }, { l: "Fastest", v: 1 }];
type Phase = "idle" | "running" | "done";
type Mode = "live" | "replay";

export default function Workspace() {
  const d = useData();
  const [lam, setLam] = useState(0.5);
  const [v, setV] = useState<VariantKey>("D");
  const [p, setP] = useState(2);
  const [mode, setMode] = useState<Mode>("live");
  const [phase, setPhase] = useState<Phase>("idle");
  const [probs, setProbs] = useState<number[]>(() => Array(24).fill(1 / 4096));
  const [invalid, setInvalid] = useState(1 - 24 / 4096);
  const [hist, setHist] = useState<number[]>([]);
  const [evalNo, setEvalNo] = useState(0);
  const [result, setResult] = useState<{ plan: [string, string][]; found: boolean; pOpt: number; pValid: number; shots: number; validShots: number } | null>(null);
  const cancel = useRef(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const sc: Scenario = useMemo(() => ({ T: 3, S: 4, benefit: d.benefit, travel: d.travel_h, corridor: d.corridor, congestion: d.congestion_h, f1max: d.meta.f1max, f2max: d.meta.f2max }), [d]);
  const rank = useMemo(() => orderByObjective(d, lam), [d, lam]);
  const optSet = useMemo(() => {
    const s = new Set<number>(); const best = rank[0];
    const sc0 = -(1 - lam) * d.f1[best] / d.meta.f1max + lam * d.f2[best] / d.meta.f2max;
    rank.forEach((j) => { const v2 = -(1 - lam) * d.f1[j] / d.meta.f1max + lam * d.f2[j] / d.meta.f2max; if (Math.abs(v2 - sc0) < 1e-9) s.add(j); });
    return s;
  }, [rank, lam, d]);
  const labels = useMemo(() => d.plans.map((pl) => pl.map((s, ti) => `${d.teams[ti].id}→${s}`).join(" ")), [d]);
  const ref = d.runs[v][lamIndex(d, lam)];
  const step = phase === "done" ? 4 : phase === "running" ? 3 : 1;

  const reset = useCallback((mixer: "x" | "xy") => {
    cancel.current = true;
    const u = mixer === "x" ? 1 / 4096 : 1 / 64;
    setProbs(Array(24).fill(u)); setInvalid(1 - 24 * u); setHist([]); setEvalNo(0); setResult(null); setPhase("idle");
  }, []);
  useEffect(() => { reset(INFO[v].mixer); }, [v, lam, p, mode, reset]);

  const finish = useCallback((full: Float64Array) => {
    const counts = sampleShots(full, d.meta.shots, 11);
    let best = -1, bestF = Infinity, validShots = 0;
    const fiPos = new Map(d.feasible_index.map((k, j) => [k, j]));
    counts.forEach((c, k) => {
      if (!isFeasible(k)) return;
      validShots += c;
      const j = fiPos.get(k)!;
      const F = -(1 - lam) * d.f1[j] / d.meta.f1max + lam * d.f2[j] / d.meta.f2max;
      if (F < bestF) { bestF = F; best = j; }
    });
    const pOpt = [...optSet].reduce((a, j) => a + full[d.feasible_index[j]], 0);
    let pValid = 0; d.feasible_index.forEach((k) => (pValid += full[k]));
    setResult({
      plan: best >= 0 ? d.teams.map((t, ti) => [t.id, d.plans[best][ti]] as [string, string]) : [],
      found: best >= 0 && optSet.has(best), pOpt, pValid, shots: d.meta.shots, validShots,
    });
    setPhase("done");
    const ok = best >= 0 && optSet.has(best);
    setToast({ ok, text: ok ? `Optimal plan found · P(opt) ${pOpt.toFixed(3)}` : "Run finished: plan differs from the exact optimum" });
    setTimeout(() => setToast(null), 4200);
  }, [d, lam, optSet]);

  const runLive = useCallback(() => {
    cancel.current = false;
    setPhase("running");
    const { mixer, obj } = INFO[v];
    const diag = costDiagonal(sc, lam, d.meta.penalty, mixer === "x");
    const order = obj === "cvar" ? sortedOrder(diag) : null;
    let last: Float64Array = new Float64Array(DIM);
    const f = (th: number[]) => { last = qaoaProbabilities(diag, th, p, mixer); return evaluate(last, diag, obj, order); };
    const gen = multiStart(f, p, 4, 140);
    let bestV = Infinity, bestX: number[] = [], n = 0;
    const h: number[] = [];
    const tick = () => {
      if (cancel.current) return;
      const t0 = performance.now();
      while (performance.now() - t0 < 14) {
        const r = gen.next();
        if (r.done) {
          const full = qaoaProbabilities(diag, bestX, p, mixer);
          setProbs(d.feasible_index.map((i) => full[i]));
          let s = 0; d.feasible_index.forEach((i) => (s += full[i])); setInvalid(1 - s);
          finish(full);
          return;
        }
        n++;
        if (r.value.v < bestV) { bestV = r.value.v; bestX = r.value.x; }
        h.push(bestV);
      }
      const fp = d.feasible_index.map((i) => last[i]);
      setProbs(fp); setInvalid(1 - fp.reduce((a, b) => a + b, 0)); setHist([...h]); setEvalNo(n);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [v, sc, lam, d, p, finish]);

  const runReplay = useCallback(() => {
    cancel.current = false;
    setPhase("running");
    const run = ref;
    let f = 0;
    const id = setInterval(() => {
      if (cancel.current) { clearInterval(id); return; }
      if (f >= run.frames.length) {
        clearInterval(id);
        const { mixer } = INFO[v];
        const full = qaoaProbabilities(costDiagonal(sc, lam, d.meta.penalty, mixer === "x"), run.theta, d.meta.p, mixer);
        setProbs(run.final); setInvalid(1 - run.final.reduce((a, b) => a + b, 0));
        finish(full);
        return;
      }
      setProbs(run.frames[f]); setInvalid(run.frame_infeasible[f]); setHist(run.energy.slice(0, f + 1)); setEvalNo(run.frame_eval[f] + 1);
      f++;
    }, 90);
  }, [ref, v, sc, lam, d, finish]);

  const run = () => (mode === "live" ? runLive() : runReplay());
  const runRef = useRef(run);
  runRef.current = run;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === "r" && phaseRef.current !== "running") runRef.current();
      else if (["1", "2", "3", "4"].includes(k)) setV(KEYS[+k - 1]);
      else if (k === "arrowleft") setLam((l) => Math.max(0, Math.round((l - 0.1) * 10) / 10));
      else if (k === "arrowright") setLam((l) => Math.min(1, Math.round((l + 0.1) * 10) / 10));
      else if (k === "m") setMode((m) => (m === "live" ? "replay" : "live"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const pOptNow = [...optSet].reduce((a, j) => a + probs[j], 0);
  const color = VCOLOR[v];

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-20 md:px-6">
      {/* step rail */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["Set priority", "Pick algorithm", "Run QAOA", "Read the plan"].map((s, i) => {
          const n = i + 1, active = n === step || (step === 1 && n === 2), doneStep = n < step;
          return (
            <div key={s} className="flex items-center gap-2">
              <motion.div animate={{ backgroundColor: active ? "rgba(232,176,75,0.15)" : "rgba(255,255,255,0.03)", borderColor: active ? "rgba(232,176,75,0.5)" : "rgba(243,236,221,0.12)" }}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] ${doneStep ? "bg-win text-ink" : active ? "bg-flood text-ink" : "bg-white/10 text-muted"}`}>{doneStep ? "✓" : n}</span>
                <span className={active || doneStep ? "text-text" : "text-muted"}>{s}</span>
              </motion.div>
              {i < 3 && <span className="text-muted/40">→</span>}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr_360px]">
        {/* controls */}
        <div className="flex flex-col gap-4">
          <Card title="① Commander priority">
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((pr) => (
                <button key={pr.l} data-cursor="set" onClick={() => setLam(pr.v)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${Math.abs(lam - pr.v) < 1e-9 ? "border-flood/60 bg-flood/10 text-flood" : "border-line text-muted hover:text-text"}`}>{pr.l}</button>
              ))}
            </div>
            <input aria-label="priority" className="slider mt-5 w-full" type="range" min={0} max={1} step={0.1} value={lam} onChange={(e) => setLam(parseFloat(e.target.value))} />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-muted"><span>reach people</span><span className="text-text">λ = {lam.toFixed(1)}</span><span>respond fast</span></div>
          </Card>

          <Card title="② Quantum algorithm">
            <div className="flex flex-col gap-1.5">
              {KEYS.map((k) => (
                <button key={k} data-cursor="pick" onClick={() => setV(k)}
                  className={`relative overflow-hidden rounded-2xl border p-3 text-left transition-colors ${v === k ? "border-transparent" : "border-line hover:border-white/20"}`}>
                  {v === k && <motion.span layoutId="algo" className="absolute inset-0 rounded-2xl" style={{ background: `${VCOLOR[k]}1f`, boxShadow: `inset 0 0 0 1px ${VCOLOR[k]}80` }} transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <div className="relative flex items-center gap-2">
                    <span className="rounded-md px-1.5 font-mono text-[10px] font-bold text-ink" style={{ background: VCOLOR[k] }}>{k}</span>
                    <span className="text-sm font-semibold">{VSHORT[k]}</span>
                    {k === "D" && <span className="ml-auto rounded-full bg-win/15 px-2 py-0.5 font-mono text-[9px] text-win">BEST</span>}
                  </div>
                  <div className="relative mt-1 text-[11px] leading-snug text-muted">{INFO[k].blurb}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card title="③ Run">
            <div className="flex rounded-xl bg-white/[0.04] p-1">
              {(["live", "replay"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className="relative flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold">
                  {mode === m && <motion.span layoutId="mode" className="absolute inset-0 rounded-lg bg-white/10" />}
                  <span className="relative">{m === "live" ? "⚡ Live in browser" : "⟲ Qiskit replay"}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>Circuit depth p</span>
              <div className="flex gap-1">
                {[1, 2, 3].map((k) => (
                  <button key={k} disabled={mode === "replay" && k !== 2} onClick={() => setP(k)}
                    className={`h-7 w-7 rounded-lg font-mono text-xs ${p === k ? "bg-white text-ink" : "bg-white/5 text-muted disabled:opacity-30"}`}>{k}</button>
                ))}
              </div>
            </div>
            <motion.button data-cursor="run" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={run} disabled={phase === "running"}
              className="relative mt-4 w-full overflow-hidden rounded-2xl py-3.5 text-sm font-bold text-ink disabled:opacity-70"
              style={{ background: `linear-gradient(90deg, ${color}, #ffffff)` }}>
              {phase === "running" && <motion.span className="absolute inset-0 bg-white/40" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1, repeat: Infinity }} />}
              <span className="relative">{phase === "running" ? "Optimising γ, β…" : phase === "done" ? "↻ Run again" : "▶ Run QAOA"}</span>
            </motion.button>
            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              {mode === "live"
                ? <>A 12-qubit statevector simulation running <b className="text-text">in your browser</b>: our exact Qiskit circuit, ported and verified to match Qiskit within 5·10⁻⁶, optimised with Nelder–Mead from 4 starts.</>
                : <>Replays the recorded Qiskit 2.6 run (COBYLA, p = 2) frame by frame.</>}
            </p>
          </Card>
        </div>

        {/* 3D */}
        <GlassPanel className="h-[min(78vh,720px)] min-h-[480px]" inner="flex flex-col">
          <div className="flex items-center justify-between px-5 pt-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">Quantum state · 24 valid dispatch plans</div>
              <div className="text-xs text-muted/80">column height = probability · glowing column = exact optimum · drag to orbit</div>
            </div>
            <div className="text-right font-mono text-[11px] text-muted">eval <span className="text-text">{evalNo}</span></div>
          </div>
          <div className="relative flex-1" data-cursor="orbit">
            <Skyline3D probs={probs} rank={rank} optimal={optSet} invalid={invalid} labels={labels} color={color} done={phase === "done"} />
          </div>
          <div className="grid grid-cols-3 gap-px border-t border-line bg-line">
            <Metric label="P(optimal plan)" value={pOptNow} format={(x) => x.toFixed(3)} color={color} />
            <Metric label="P(valid plan)" value={(1 - invalid) * 100} format={(x) => `${x.toFixed(1)}%`} color="#9CCB7A" />
            <div className="bg-[rgba(18,22,50,0.6)] px-4 py-3">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted">objective ↓</div>
              <Spark data={hist} color={color} />
            </div>
          </div>
        </GlassPanel>

        {/* result */}
        <div className="flex flex-col gap-4">
          <Card title="④ Recommended dispatch">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="r" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease }}>
                  <div className="space-y-1.5">
                    {result.plan.map(([t, s], i) => (
                      <motion.div key={t} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
                        className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2 text-sm">
                        <span style={{ color: TEAM_COL[t] }}>{TEAM_ICON[t]}</span>
                        <span className="font-semibold">{d.teams.find((x) => x.id === t)!.name}</span>
                        <span className="ml-auto font-mono text-xs text-win">→ {s}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${result.found ? "bg-win/10 text-win" : "bg-danger/10 text-danger"}`}>
                    {result.found ? "✓ Matches the exact brute-force optimum" : "✗ Differs from the exact optimum. Try variant D or p = 2"}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-muted">
                    <div className="rounded-xl bg-white/[0.03] p-2">valid shots<br /><span className="text-base text-text">{result.validShots}/{result.shots}</span></div>
                    <div className="rounded-xl bg-white/[0.03] p-2">Qiskit ref. P(opt)<br /><span className="text-base text-text">{ref.p_opt.toFixed(3)}</span></div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-6 text-center text-sm text-muted">
                  {phase === "running" ? "Measuring after training…" : <>Press <b className="text-text">▶ Run QAOA</b> to compute a plan.</>}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
          <GlassPanel inner="aspect-[520/640] p-2">
            <SindhMap plan={result?.plan ?? []} pulse={false} neutral={!result} />
          </GlassPanel>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 font-mono text-[10px] text-muted">
        {[["R", "run"], ["1–4", "algorithm"], ["← →", "priority"], ["M", "live / replay"]].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5"><kbd className="rounded-md border border-line bg-white/5 px-1.5 py-0.5 text-text shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]">{k}</kbd>{l}</span>
        ))}
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }} role="status"
            className="fixed right-6 top-20 z-[60] flex items-center gap-3 rounded-2xl border border-white/15 bg-[rgba(18,22,50,0.8)] px-4 py-3 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full" style={{ background: toast.ok ? "rgba(156,203,122,0.18)" : "rgba(224,83,61,0.18)" }}>
              {toast.ok ? "✓" : "!"}
              {toast.ok && Array.from({ length: 10 }).map((_, i) => {
                const a = (i / 10) * Math.PI * 2;
                return <motion.span key={i} className="absolute h-1.5 w-1.5 rounded-full" style={{ background: ["#E8B04B", "#9CCB7A", "#8F9CFF"][i % 3] }}
                  initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(a) * 28, y: Math.sin(a) * 28, opacity: 0 }} transition={{ duration: 0.8 }} />;
              })}
            </span>
            <span className={toast.ok ? "text-win" : "text-danger"}>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="mt-6 text-center text-[11px] text-muted">Real places in Sindh; population, need and access figures are synthetic. Not for operational use. <a className="underline" href={`${BASE_PATH}/`}>Back to overview</a></p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassPanel inner="p-4">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted">{title}</div>
      {children}
    </GlassPanel>
  );
}

function Metric({ label, value, color, format }: { label: string; value: number; color: string; format: (v: number) => string }) {
  return (
    <div className="bg-[rgba(18,22,50,0.6)] px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted">{label}</div>
      <div className="font-mono text-2xl font-semibold tabular-nums" style={{ color, textShadow: `0 0 18px ${color}66` }}><Ticker value={value} format={format} /></div>
    </div>
  );
}

function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-8 font-mono text-[10px] text-muted">waiting…</div>;
  const lo = Math.min(...data), hi = Math.max(...data), W = 140, H = 32;
  const pts = data.map((y, i) => `${(i / (data.length - 1)) * W},${H - ((y - lo) / (hi - lo || 1)) * (H - 4) - 2}`).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-full"><polyline points={pts} fill="none" stroke={color} strokeWidth={2} /></svg>;
}
