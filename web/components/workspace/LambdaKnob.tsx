"use client";
import { motion, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

const MIN_A = -135, MAX_A = 135; // degrees
const toAngle = (v: number) => MIN_A + v * (MAX_A - MIN_A);

/** Commander's dial: a tactile rotary knob for lambda with spring physics and 0.1 detents. */
export default function LambdaKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState(false);
  const angle = useSpring(toAngle(value), { stiffness: 260, damping: 18, mass: 0.6 });
  const rotate = useTransform(angle, (a) => `rotate(${a} 100 100)`);
  useEffect(() => { angle.set(toAngle(value)); }, [value, angle]);

  const fromPointer = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    let a = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = up, clockwise positive
    a = Math.max(MIN_A, Math.min(MAX_A, a));
    const v = Math.round(((a - MIN_A) / (MAX_A - MIN_A)) * 10) / 10;
    if (v !== value) { onChange(v); if (navigator.vibrate) navigator.vibrate(4); }
  };

  const ticks = Array.from({ length: 11 }, (_, i) => i / 10);
  const arc = (a0: number, a1: number, r: number) => {
    const p = (a: number) => [100 + r * Math.sin((a * Math.PI) / 180), 100 - r * Math.cos((a * Math.PI) / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}`;
  };
  const label = value < 0.25 ? "Max reach" : value > 0.75 ? "Fastest" : "Balanced";

  return (
    <div className="flex flex-col items-center">
      <svg ref={ref} viewBox="0 0 200 200" className="h-44 w-44 touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-flood/60" role="slider" aria-label="Commander priority lambda"
        aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} tabIndex={0} data-cursor="turn"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(1, Math.round((value + 0.1) * 10) / 10)); }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(0, Math.round((value - 0.1) * 10) / 10)); }
        }}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(true); fromPointer(e); }}
        onPointerMove={(e) => drag && fromPointer(e)}
        onPointerUp={() => setDrag(false)}>
        <defs>
          <linearGradient id="knobarc" x1="0" x2="1">
            <stop offset="0%" stopColor="#6FC3B2" /><stop offset="50%" stopColor="#E8B04B" /><stop offset="100%" stopColor="#E0533D" />
          </linearGradient>
          <radialGradient id="knobface" cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#2A3166" /><stop offset="100%" stopColor="#0E1230" />
          </radialGradient>
        </defs>
        <path d={arc(MIN_A, MAX_A, 86)} fill="none" stroke="rgba(243,236,221,0.08)" strokeWidth={8} strokeLinecap="round" />
        <path d={arc(MIN_A, Math.max(MIN_A + 0.1, toAngle(value)), 86)} fill="none" stroke="url(#knobarc)" strokeWidth={8} strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px rgba(232,176,75,0.6))" }} />
        {ticks.map((t) => {
          const a = (toAngle(t) * Math.PI) / 180, on = t <= value + 1e-9;
          return <line key={t} x1={100 + 70 * Math.sin(a)} y1={100 - 70 * Math.cos(a)} x2={100 + 76 * Math.sin(a)} y2={100 - 76 * Math.cos(a)}
            stroke={on ? "#E8B04B" : "rgba(243,236,221,0.25)"} strokeWidth={t === 0 || t === 0.5 || t === 1 ? 2.5 : 1.5} strokeLinecap="round" />;
        })}
        <motion.circle cx={100} cy={100} r={56} fill="url(#knobface)" stroke="rgba(243,236,221,0.15)" animate={{ scale: drag ? 0.97 : 1 }} style={{ transformOrigin: "100px 100px" }} />
        <circle cx={100} cy={100} r={56} fill="none" stroke="url(#knobarc)" strokeOpacity={0.25} />
        <motion.g transform={rotate as unknown as string}>
          <line x1={100} y1={52} x2={100} y2={66} stroke="#F3ECDD" strokeWidth={4} strokeLinecap="round" />
          <circle cx={100} cy={50} r={3} fill="#E8B04B" style={{ filter: "drop-shadow(0 0 4px #E8B04B)" }} />
        </motion.g>
        <text x={100} y={98} textAnchor="middle" fill="#F3ECDD" fontSize={26} fontFamily="var(--font-jetbrains)" fontWeight={600}>{value.toFixed(1)}</text>
        <text x={100} y={117} textAnchor="middle" fill="#A9A291" fontSize={10} fontFamily="var(--font-jetbrains)" letterSpacing={2}>λ</text>
        <text x={22} y={190} fill="#6FC3B2" fontSize={9} fontFamily="var(--font-jetbrains)">REACH</text>
        <text x={178} y={190} fill="#E0533D" fontSize={9} textAnchor="end" fontFamily="var(--font-jetbrains)">SPEED</text>
      </svg>
      <div className="-mt-1 text-sm font-semibold text-flood">{label}</div>
    </div>
  );
}
