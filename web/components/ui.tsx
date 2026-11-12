"use client";
import { animate, motion, useInView, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const ease = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, y = 24, className = "" }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

export function CountUp({ to, decimals = 0, suffix = "", prefix = "", duration = 1.8, className = "" }: {
  to: number; decimals?: number; suffix?: string; prefix?: string; duration?: number; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration, ease, onUpdate: setVal });
    return () => c.stop();
  }, [inView, to, duration]);
  return (
    <span ref={ref} className={className}>
      {prefix}
      {val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export function SectionHeader({ kicker, title, sub, id }: { kicker: string; title: ReactNode; sub?: ReactNode; id?: string }) {
  return (
    <div id={id} className="mx-auto max-w-3xl scroll-mt-28 text-center">
      <Reveal>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-flood">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-flood" />
          {kicker}
        </div>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">{title}</h2>
      </Reveal>
      {sub && (
        <Reveal delay={0.16}>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted md:text-lg">{sub}</p>
        </Reveal>
      )}
    </div>
  );
}

/** card that tilts toward the pointer with spring physics and shows a spotlight */
export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [5, -5]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-5, 5]), { stiffness: 200, damping: 20 });
  const bg = useTransform([mx, my] as never, ([x, y]: number[]) =>
    `radial-gradient(420px circle at ${x * 100}% ${y * 100}%, rgba(34,211,238,0.10), transparent 60%)`);
  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={`glass relative overflow-hidden rounded-3xl ${className}`}
    >
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: bg }} />
      <div className="relative h-full">{children}</div>
    </motion.div>
  );
}

export function MagneticButton({ children, href, primary = false, onClick }: { children: ReactNode; href?: string; primary?: boolean; onClick?: () => void }) {
  const x = useSpring(0, { stiffness: 300, damping: 18 });
  const y = useSpring(0, { stiffness: 300, damping: 18 });
  const ref = useRef<HTMLAnchorElement>(null);
  const cls = primary
    ? "bg-white text-ink shadow-[0_0_40px_rgba(34,211,238,0.35)] hover:shadow-[0_0_60px_rgba(34,211,238,0.6)]"
    : "glass text-text hover:bg-white/10";
  return (
    <motion.a
      ref={ref}
      href={href}
      onClick={onClick}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      style={{ x, y }}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.25);
        y.set((e.clientY - r.top - r.height / 2) * 0.35);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
      whileTap={{ scale: 0.95 }}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-shadow ${cls}`}
    >
      {children}
    </motion.a>
  );
}

export function Pill({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-2.5 py-0.5 font-mono text-[11px] text-muted">
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </span>
  );
}
