"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useData } from "@/lib/data";

/** Interactive geometry of the weighted-sum scalarisation.
 *  F_lambda is constant along straight lines in (hours, people) space; minimising F slides that line
 *  until it last touches a plan. Turning the dial rotates the line -> the plan it touches is the optimum.
 *  It also shows why an unsupported Pareto plan (inside the convex hull's dent) can never be touched. */
export default function TradeoffGeometry({ lam, optimal, livePlan }: { lam: number; optimal: number; livePlan: number | null }) {
  const d = useData();
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 380, L = 54, R = 18, T = 18, B = 46;
  const x0 = Math.min(...d.f2) - 1, x1 = Math.max(...d.f2) + 1, y0 = Math.min(...d.f1) - 8, y1 = Math.max(...d.f1) + 8;
  const X = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v: number) => H - B - ((v - y0) / (y1 - y0)) * (H - T - B);
  const front = d.f1.map((_, j) => j).filter((j) => d.pareto[j]).sort((a, b) => d.f2[a] - d.f2[b]);

  // iso-line through the optimum:  -(1-l) f1/f1max + l f2/f2max = const  ->  direction vector in data space
  const a = (1 - lam) / d.meta.f1max, b = lam / d.meta.f2max;           // F = -a f1 + b f2
  const px = d.f2[optimal], py = d.f1[optimal];
  // direction along the line: (df2, df1) with -a df1 + b df2 = 0  ->  (a, b) in (f2, f1) coords
  const dirx = a, diry = b, len = Math.hypot(X(px + dirx) - X(px), Y(py + diry) - Y(py)) || 1;
  const ux = (X(px + dirx) - X(px)) / len, uy = (Y(py + diry) - Y(py)) / len;
  const ext = 900;
  const line = { x1: X(px) - ux * ext, y1: Y(py) - uy * ext, x2: X(px) + ux * ext, y2: Y(py) + uy * ext };
  // normal pointing to "better" (lower F): gradient of -F = (−b, +a) in (f2, f1)
  const nx = X(px - b * 40) - X(px), ny = Y(py + a * 40) - Y(py), nl = Math.hypot(nx, ny) || 1;
  const spring = { type: "spring" as const, stiffness: 120, damping: 18 };

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
        <defs>
          <clipPath id="plot"><rect x={L} y={T} width={W - L - R} height={H - T - B} rx={8} /></clipPath>
          <linearGradient id="isoline" x1="0" x2="1"><stop offset="0%" stopColor="#E8B04B" stopOpacity="0" /><stop offset="50%" stopColor="#E8B04B" /><stop offset="100%" stopColor="#E8B04B" stopOpacity="0" /></linearGradient>
        </defs>
        <rect x={L} y={T} width={W - L - R} height={H - T - B} rx={8} fill="rgba(243,236,221,0.02)" stroke="rgba(243,236,221,0.08)" />
        {[0, 1, 2, 3, 4].map((i) => {
          const yv = y0 + ((y1 - y0) * i) / 4, xv = x0 + ((x1 - x0) * i) / 4;
          return (
            <g key={i}>
              <line x1={L} x2={W - R} y1={Y(yv)} y2={Y(yv)} stroke="rgba(243,236,221,0.05)" />
              <text x={L - 8} y={Y(yv) + 3} fontSize={9} textAnchor="end" fill="#A9A291" fontFamily="var(--font-jetbrains)">{yv.toFixed(0)}k</text>
              <text x={X(xv)} y={H - B + 16} fontSize={9} textAnchor="middle" fill="#A9A291" fontFamily="var(--font-jetbrains)">{xv.toFixed(0)}h</text>
            </g>
          );
        })}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#A9A291">response burden (team-hours) →</text>
        <text x={14} y={(T + H - B) / 2} textAnchor="middle" fontSize={10} fill="#A9A291" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>people reached →</text>

        <g clipPath="url(#plot)">
          {/* half-plane that is strictly better than the optimum: it must be empty */}
          <motion.path initial={false} animate={{ d: `M${line.x1},${line.y1} L${line.x2},${line.y2} L${line.x2 - (nx / nl) * 900},${line.y2 - (ny / nl) * 900} L${line.x1 - (nx / nl) * 900},${line.y1 - (ny / nl) * 900} Z` }}
            transition={spring} fill="rgba(232,176,75,0.05)" />
          <motion.line initial={false} animate={line} transition={spring} stroke="url(#isoline)" strokeWidth={2.5} />
          <motion.line initial={false} animate={line} transition={spring} stroke="#E8B04B" strokeWidth={8} strokeOpacity={0.08} />
          <path d={front.map((j, i) => `${i ? "L" : "M"}${X(d.f2[j])},${Y(d.f1[j])}`).join(" ")} fill="none" stroke="#F3ECDD" strokeOpacity={0.4} strokeDasharray="4 5" />
        </g>

        {d.f1.map((_, j) => {
          const isOpt = j === optimal, onF = d.pareto[j], uns = onF && !d.supported[j];
          return (
            <g key={j} onPointerEnter={() => setHover(j)} onPointerLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              {uns && <rect x={X(d.f2[j]) - 10} y={Y(d.f1[j]) - 10} width={20} height={20} rx={4} fill="none" stroke="#E0533D" strokeDasharray="3 3" />}
              <motion.circle cx={X(d.f2[j])} cy={Y(d.f1[j])} initial={false}
                animate={{ r: isOpt ? 9 : onF ? 6 : 4.5, fill: isOpt ? "#E8B04B" : onF ? "#F3ECDD" : "rgba(169,162,145,0.45)" }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }} style={{ filter: isOpt ? "drop-shadow(0 0 10px #E8B04B)" : undefined }} />
              {livePlan === j && <motion.circle cx={X(d.f2[j])} cy={Y(d.f1[j])} r={15} fill="none" stroke="#9CCB7A" strokeWidth={2}
                initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ transformOrigin: `${X(d.f2[j])}px ${Y(d.f1[j])}px` }} />}
            </g>
          );
        })}
        <motion.g initial={false} animate={{ x: X(px), y: Y(py) }} transition={spring}>
          <line x1={0} y1={0} x2={(nx / nl) * 34} y2={(ny / nl) * 34} stroke="#E8B04B" strokeWidth={1.5} markerEnd="" />
          <circle cx={(nx / nl) * 34} cy={(ny / nl) * 34} r={2.5} fill="#E8B04B" />
        </motion.g>
      </svg>

      <div className="pointer-events-none absolute bottom-16 right-6 max-w-[250px] rounded-xl border border-line bg-[rgba(12,15,30,0.78)] p-3 text-[11px] leading-relaxed text-muted backdrop-blur">
        <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-flood">How the optimiser “sees” it</div>
        Every plan on the golden line scores the same. QAOA looks for the last plan the line touches as it slides toward
        more people and fewer hours. Turn the dial: the line rotates. The <span className="text-danger">dashed-red</span> plan is
        Pareto-optimal, but no line can ever touch it first.
      </div>
      <AnimatePresence>
        {hover !== null && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute left-[70px] top-6 rounded-xl border border-line bg-[rgba(12,15,30,0.85)] px-3 py-2 font-mono text-[11px] text-text backdrop-blur">
            {d.teams.map((t, ti) => <div key={t.id}>{t.id} → {d.plans[hover][ti]}</div>)}
            <div className="mt-1 text-muted">{d.f1[hover].toFixed(0)}k people · {d.f2[hover].toFixed(1)} h</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
