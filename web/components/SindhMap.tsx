"use client";
import { AnimatePresence, motion } from "motion/react";
import { project, useData } from "@/lib/data";

const W = 520, H = 640;
// schematic Indus course through upper/central Sindh (approximate, for orientation only)
const INDUS: [number, number][] = [
  [69.32, 28.42], [69.05, 28.0], [68.86, 27.7], [68.55, 27.55], [68.3, 27.42], [68.15, 27.3],
  [68.03, 27.05], [67.97, 26.8], [67.93, 26.55], [67.95, 26.3], [68.12, 25.95], [68.28, 25.6], [68.33, 25.3], [68.25, 25.1],
];
const TEAM_ICON: Record<string, string> = { BOAT: "⛵", MED: "✚", SUP: "▣" };
const TEAM_COL: Record<string, string> = { BOAT: "#22d3ee", MED: "#fb7185", SUP: "#fbbf24" };

function curve(a: readonly [number, number], b: readonly [number, number]) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const cx = mx - dy * 0.18, cy = my + dx * 0.18;
  return { d: `M${a[0]},${a[1]} Q${cx},${cy} ${b[0]},${b[1]}`, c: [cx, cy] as const };
}

export default function SindhMap({ plan, pulse = true }: { plan: [string, string][]; pulse?: boolean }) {
  const d = useData();
  const P = (lon: number, lat: number) => project(lon, lat, W, H);
  const river = INDUS.map(([lo, la], i) => `${i ? "L" : "M"}${P(lo, la).join(",")}`).join(" ");
  const served = new Set(plan.map(([, s]) => s));
  const teamById = Object.fromEntries(d.teams.map((t) => [t.id, t]));
  const siteById = Object.fromEntries(d.sites.map((s) => [s.id, s]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Map of the Sindh scenario with team routes">
      <defs>
        <radialGradient id="flood" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* graticule */}
      {[67, 67.5, 68, 68.5, 69].map((lo) => {
        const [x] = P(lo, 26);
        return <line key={lo} x1={x} x2={x} y1={0} y2={H} stroke="rgba(148,163,184,0.07)" />;
      })}
      {[25.5, 26, 26.5, 27, 27.5, 28].map((la) => {
        const [, y] = P(67, la);
        return <g key={la}><line x1={0} x2={W} y1={y} y2={y} stroke="rgba(148,163,184,0.07)" /><text x={6} y={y - 4} fontSize={9} fill="rgba(139,154,176,0.6)" fontFamily="monospace">{la}°N</text></g>;
      })}

      {/* illustrative flood extent around Manchar / Dadu */}
      {[[67.72, 26.75, 120], [67.8, 27.05, 95], [67.65, 26.5, 80], [68.4, 28.2, 70]].map(([lo, la, r], i) => {
        const [x, y] = P(lo, la);
        return (
          <motion.circle key={i} cx={x} cy={y} r={r} fill="url(#flood)"
            animate={pulse ? { r: [r * 0.9, r * 1.08, r * 0.9] } : {}} transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut" }} />
        );
      })}

      {/* Indus */}
      <motion.path d={river} fill="none" stroke="url(#river)" strokeWidth={3.5} strokeLinecap="round" opacity={0.75}
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2.4, ease: "easeInOut" }} />
      <path d={river} fill="none" stroke="#7dd3fc" strokeWidth={1.2} strokeDasharray="2 10" opacity={0.8}>
        <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="1.6s" repeatCount="indefinite" />
      </path>
      <text {...(() => { const [x, y] = P(68.06, 26.95); return { x: x + 8, y }; })()} fontSize={10} fill="#7dd3fc" fontStyle="italic" opacity={0.8}>Indus (schematic)</text>

      {/* routes */}
      <AnimatePresence>
        {plan.map(([tid, sid]) => {
          const t = teamById[tid], s = siteById[sid];
          if (!t || !s) return null;
          const a = P(t.lon, t.lat), b = P(s.lon, s.lat);
          const { d: path } = curve(a, b);
          return (
            <g key={`${tid}-${sid}`}>
              <motion.path d={path} fill="none" stroke={TEAM_COL[tid]} strokeWidth={2.5} strokeLinecap="round" filter="url(#glow)"
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
              <circle r={4} fill="#fff">
                <animateMotion dur="2.2s" repeatCount="indefinite" path={path} />
              </circle>
            </g>
          );
        })}
      </AnimatePresence>

      {/* sites */}
      {d.sites.map((s) => {
        const [x, y] = P(s.lon, s.lat);
        const isServed = served.has(s.id);
        const r = 6 + s.people_k / 8;
        const left = s.id === "JOHI";
        return (
          <g key={s.id}>
            {!isServed && (
              <motion.circle cx={x} cy={y} r={r} fill="none" stroke="#fb7185" strokeWidth={2}
                animate={{ r: [r, r + 22], opacity: [0.9, 0] }} transition={{ duration: 1.4, repeat: Infinity }} />
            )}
            <motion.circle cx={x} cy={y} animate={{ r, fill: isServed ? "#34d399" : "#fb7185" }} fillOpacity={0.3}
              stroke={isServed ? "#34d399" : "#fb7185"} strokeWidth={1.5} transition={{ duration: 0.5 }} />
            <text x={left ? x - r - 6 : x + r + 6} y={y - 2} textAnchor={left ? "end" : "start"} fontSize={12} fill="#e6edf6" fontWeight={600}>{s.name.replace(" (Dadu district)", "")}</text>
            <text x={left ? x - r - 6 : x + r + 6} y={y + 12} textAnchor={left ? "end" : "start"} fontSize={10} fill={isServed ? "#34d399" : "#fb7185"} fontFamily="monospace">
              {s.people_k}k* · {isServed ? "served" : "WAITS"}
            </text>
          </g>
        );
      })}

      {/* team bases */}
      {d.teams.map((t) => {
        const [x, y] = P(t.lon, t.lat);
        return (
          <g key={t.id}>
            <rect x={x - 13} y={y - 13} width={26} height={26} rx={8} fill="#0a111d" stroke={TEAM_COL[t.id]} strokeWidth={1.5} />
            <text x={x} y={y + 5} fontSize={14} textAnchor="middle" fill={TEAM_COL[t.id]}>{TEAM_ICON[t.id]}</text>
            <text x={x + 18} y={y + 4} fontSize={10} fill={TEAM_COL[t.id]} fontFamily="monospace">{t.base}</text>
          </g>
        );
      })}
    </svg>
  );
}

export { TEAM_COL, TEAM_ICON };
