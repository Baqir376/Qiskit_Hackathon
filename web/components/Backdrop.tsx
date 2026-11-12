"use client";
import { motion } from "motion/react";
import { useMemo } from "react";

type Layer = "aurora" | "contours" | "grid" | "bubbles";
type Tone = "warm" | "cool" | "mixed";

const TONES: Record<Tone, [string, string, string]> = {
  warm: ["rgba(232,176,75,0.20)", "rgba(224,83,61,0.16)", "rgba(43,53,144,0.45)"],
  cool: ["rgba(111,195,178,0.18)", "rgba(143,156,255,0.20)", "rgba(43,53,144,0.45)"],
  mixed: ["rgba(232,176,75,0.16)", "rgba(143,156,255,0.18)", "rgba(111,195,178,0.14)"],
};

/** Living section background: slow aurora light, drifting flood contours, a perspective grid
 *  floor and rising bubbles. Pure CSS/SVG transforms -> cheap to render, no canvas. */
export default function Backdrop({ layers = ["aurora"], tone = "mixed", className = "" }: { layers?: Layer[]; tone?: Tone; className?: string }) {
  const [c1, c2, c3] = TONES[tone];
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      {layers.includes("aurora") && (
        <>
          <motion.div className="absolute -left-[10%] top-[5%] h-[55vmax] w-[55vmax] rounded-full blur-[110px]" style={{ background: c1 }}
            animate={{ x: [0, 120, -40, 0], y: [0, 60, 140, 0], scale: [1, 1.15, 0.95, 1] }} transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute -right-[15%] top-[30%] h-[50vmax] w-[50vmax] rounded-full blur-[120px]" style={{ background: c2 }}
            animate={{ x: [0, -140, 30, 0], y: [0, -80, 60, 0], scale: [1, 0.9, 1.2, 1] }} transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute bottom-[-20%] left-[30%] h-[45vmax] w-[45vmax] rounded-full blur-[120px]" style={{ background: c3 }}
            animate={{ x: [0, 80, -100, 0], y: [0, -60, 20, 0] }} transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }} />
        </>
      )}
      {layers.includes("contours") && <Contours />}
      {layers.includes("grid") && <GridFloor />}
      {layers.includes("bubbles") && <Bubbles />}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />
    </div>
  );
}

/** Topographic flood contours: concentric wobbly rings, like a depth map of floodwater. */
function Contours() {
  const rings = useMemo(() => {
    const out: string[] = [];
    for (let k = 1; k <= 14; k++) {
      const r = 40 + k * 34;
      let d = "";
      for (let a = 0; a <= 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        const w = r + Math.sin(t * 3 + k * 0.7) * (8 + k * 1.6) + Math.cos(t * 5 - k) * 6;
        const x = 500 + Math.cos(t) * w * 1.35, y = 500 + Math.sin(t) * w;
        d += `${a ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      }
      out.push(d + "Z");
    }
    return out;
  }, []);
  return (
    <motion.svg viewBox="0 0 1000 1000" className="absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.22]"
      animate={{ rotate: [0, 8, -4, 0], scale: [1, 1.05, 1] }} transition={{ duration: 60, repeat: Infinity, ease: "easeInOut" }}>
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={i % 4 === 0 ? "#6FC3B2" : "#F3ECDD"} strokeOpacity={i % 4 === 0 ? 0.55 : 0.18} strokeWidth={i % 4 === 0 ? 1.3 : 0.8}
          strokeDasharray={i % 3 === 0 ? "4 10" : undefined}>
          {i % 3 === 0 && <animate attributeName="stroke-dashoffset" from="0" to="-140" dur={`${18 + i}s`} repeatCount="indefinite" />}
        </path>
      ))}
    </motion.svg>
  );
}

function GridFloor() {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[55%] [perspective:600px]">
      <div className="absolute inset-0 origin-bottom [transform:rotateX(62deg)]"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(243,236,221,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(243,236,221,0.09) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "linear-gradient(to top, black 20%, transparent 90%)",
          animation: "grid-flow 6s linear infinite",
        }} />
    </div>
  );
}

function Bubbles() {
  const bubbles = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    left: (i * 37) % 100, size: 4 + ((i * 13) % 10), dur: 14 + ((i * 7) % 12), delay: (i * 1.3) % 10,
    color: ["#E8B04B", "#6FC3B2", "#8F9CFF", "#F3ECDD"][i % 4],
  })), []);
  return (
    <>
      {bubbles.map((b, i) => (
        <motion.span key={i} className="absolute bottom-[-20px] rounded-full"
          style={{ left: `${b.left}%`, width: b.size, height: b.size, background: b.color, boxShadow: `0 0 12px ${b.color}`, opacity: 0.35 }}
          animate={{ y: ["0vh", "-110vh"], x: [0, 20, -10, 0], opacity: [0, 0.5, 0.4, 0] }}
          transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: "linear" }} />
      ))}
    </>
  );
}
