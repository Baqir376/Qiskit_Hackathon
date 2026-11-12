"use client";
import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useData } from "@/lib/data";
import { TEAM_COL, TEAM_ICON } from "./SindhMap";
import { SectionHeader } from "./ui";

const STEPS: { title: string; body: ReactNode; tag: string }[] = [
  {
    tag: "VARIABLES",
    title: "Every possible decision becomes a qubit",
    body: <>x<sub>t,s</sub> = 1 means “team t goes to site s”. Three teams × four sites gives <b className="text-text">12 qubits</b>, and the register holds all <b className="text-text">4,096</b> plans at once.</>,
  },
  {
    tag: "CONSTRAINTS",
    title: "Rules become energy penalties",
    body: <>Each team goes to exactly one site (rows). Each site takes at most one team (columns). Breaking a rule raises the energy by P·(Σx−1)², so <b className="text-text">bad plans become high-energy states</b>.</>,
  },
  {
    tag: "COUPLINGS",
    title: "Congested highways become ZZ couplings",
    body: <>Two teams on the same washed-out corridor (N-55, N-65) cost extra hours. That quadratic term becomes a <b className="text-text">Z⊗Z interaction</b> between their qubits. The objective weighs people reached against those hours.</>,
  },
  {
    tag: "XY MIXER",
    title: "Our mixer can't break the rules",
    body: <>Standard QAOA flips single qubits and wastes most of its probability on impossible plans. Our <b className="text-text">XY mixer</b> only <i>swaps</i> an excitation along a team’s row, starting from a W-state, so every team is always in exactly one place: <b className="text-win">4,096 → 64 states</b>.</>,
  },
];

export default function Qubits() {
  const [step, setStep] = useState(0);
  return (
    <section className="relative px-5 py-32 md:px-8">
      <SectionHeader
        id="qubits"
        kicker="02 · From flood to qubits"
        title={<>Translating a crisis into <span className="font-serif font-normal italic text-quantum">physics</span></>}
        sub="QAOA finds low-energy states of a Hamiltonian. So we write the dispatch problem as one, where the lowest-energy state is the best plan."
      />
      <div className="mx-auto mt-20 grid max-w-6xl gap-10 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          {STEPS.map((s, i) => <StepText key={i} i={i} s={s} active={step === i} onActive={setStep} />)}
        </div>
        <div className="order-1 lg:order-2">
          <div className="sticky top-28">
            <QubitGrid step={step} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StepText({ i, s, active, onActive }: { i: number; s: (typeof STEPS)[number]; active: boolean; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => { if (inView) onActive(i); }, [inView, i, onActive]);
  return (
    <motion.div ref={ref} animate={{ opacity: active ? 1 : 0.78, scale: active ? 1 : 0.98 }} transition={{ duration: 0.4 }} className="flex min-h-[48vh] flex-col justify-center py-8 lg:min-h-[70vh]">
      <div className="font-mono text-xs tracking-[0.25em] text-flood">0{i + 1} · {s.tag}</div>
      <h3 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{s.title}</h3>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{s.body}</p>
    </motion.div>
  );
}

function QubitGrid({ step }: { step: number }) {
  const d = useData();
  const CELL = 76, GAP = 14, X0 = 90, Y0 = 60;
  const cx = (s: number) => X0 + s * (CELL + GAP) + CELL / 2;
  const cy = (t: number) => Y0 + t * (CELL + GAP) + CELL / 2;
  const W = X0 + 4 * (CELL + GAP) + 10, H = Y0 + 3 * (CELL + GAP) + 70;

  // congestion couplings from the scenario corridors
  const pairs: [number, number, number, number][] = [];
  for (let t1 = 0; t1 < 3; t1++) for (let t2 = t1 + 1; t2 < 3; t2++)
    for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++)
      if (d.corridor[t1][s1] === d.corridor[t2][s2]) pairs.push([t1, s1, t2, s2]);

  // XY-mixer excitation hop position per team
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (step !== 3) return;
    const id = setInterval(() => setTick((k) => k + 1), 700);
    return () => clearInterval(id);
  }, [step]);
  const hop = (t: number) => [(tick + t) % 4, (tick * 3 + t * 2 + 1) % 4, (tick + 2 * t + 2) % 4][t];

  return (
    <div className="glass beam-border rounded-3xl p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {d.sites.map((s, si) => (
          <text key={s.id} x={cx(si)} y={Y0 - 16} textAnchor="middle" fontSize={11} fill="#A9A291" fontFamily="monospace">{s.id}</text>
        ))}
        {d.teams.map((t, ti) => (
          <text key={t.id} x={X0 - 14} y={cy(ti) + 5} textAnchor="end" fontSize={13} fill={TEAM_COL[t.id]}>{TEAM_ICON[t.id]} {t.id}</text>
        ))}

        {/* constraint bands */}
        {step === 1 && [0, 1, 2].map((t) => (
          <motion.rect key={`r${t}`} x={X0 - 6} y={cy(t) - CELL / 2 - 6} width={4 * (CELL + GAP) - GAP + 12} height={CELL + 12} rx={18}
            fill="none" stroke="#6FC3B2" strokeDasharray="6 6" initial={{ opacity: 0 }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: t * 0.3 }} />
        ))}
        {step === 1 && [0, 1, 2, 3].map((s) => (
          <motion.rect key={`c${s}`} x={cx(s) - CELL / 2 - 4} y={Y0 - 4} width={CELL + 8} height={3 * (CELL + GAP) - GAP + 8} rx={16}
            fill="rgba(251,191,36,0.05)" stroke="#E8B04B" strokeOpacity={0.5} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + s * 0.1 }} />
        ))}

        {/* qubits */}
        {[0, 1, 2].map((t) => [0, 1, 2, 3].map((s) => {
          const lit = step === 3 ? hop(t) === s : step === 0 ? true : false;
          return (
            <g key={`${t}-${s}`}>
              <motion.rect x={cx(s) - CELL / 2} y={cy(t) - CELL / 2} width={CELL} height={CELL} rx={18}
                fill="#1B2147" stroke="rgba(243,236,221,0.18)"
                initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                transition={{ delay: (t * 4 + s) * 0.04, type: "spring", stiffness: 220, damping: 18 }} style={{ transformOrigin: `${cx(s)}px ${cy(t)}px` }} />
              <motion.circle cx={cx(s)} cy={cy(t)}
                animate={{
                  r: lit ? 22 : 14,
                  fill: step === 3 ? (lit ? "#9CCB7A" : "#2A2F55") : "#6FC3B2",
                  opacity: step === 3 ? 1 : step === 0 ? [0.4, 1, 0.4] : 0.55,
                }}
                transition={step === 0 ? { duration: 1.4 + ((t + s) % 3) * 0.3, repeat: Infinity } : { type: "spring", stiffness: 260, damping: 20 }}
                style={{ filter: lit && step === 3 ? "drop-shadow(0 0 12px #9CCB7A)" : "none" }} />
              <text x={cx(s)} y={cy(t) + CELL / 2 - 8} textAnchor="middle" fontSize={9} fill="#A9A291" fontFamily="monospace">q{t * 4 + s}</text>
            </g>
          );
        }))}

        {/* ZZ couplings */}
        {step === 2 && pairs.map(([t1, s1, t2, s2], k) => (
          <motion.path key={k} d={`M${cx(s1)},${cy(t1)} Q${(cx(s1) + cx(s2)) / 2 + 40},${(cy(t1) + cy(t2)) / 2} ${cx(s2)},${cy(t2)}`}
            fill="none" stroke="#8F9CFF" strokeWidth={1.3} strokeOpacity={0.75}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: k * 0.04 }} />
        ))}

        <text x={W / 2} y={H - 18} textAnchor="middle" fontSize={13} fill="#F3ECDD" fontFamily="monospace">
          {["|ψ⟩ = Σ over 4,096 plans", "H = F_λ(x) + P·Σ(Σx−1)² + P·Σ xx′", "H ∋ J·Z_a Z_b  (shared corridor)", "U_mix = Π exp(−iβ(XX+YY)/2) · W-state"][step]}
        </text>
      </svg>
    </div>
  );
}
