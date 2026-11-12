"use client";
import { useEffect, useRef } from "react";

/** Lightweight canvas "flood current" — particles drifting along a smooth vector field. */
export default function FlowField({ className = "", density = 0.00055 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, t = 0, visible = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type P = { x: number; y: number; life: number; hue: number };
    let ps: P[] = [];
    let mx = -9999, my = -9999;
    const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; };
    window.addEventListener("pointermove", onMove);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.floor(w * h * density);
      ps = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, life: Math.random() * 200, hue: Math.random() }));
      ctx.fillStyle = "#04070d"; ctx.fillRect(0, 0, w, h);
    };
    const field = (x: number, y: number) => {
      const s = 0.0016;
      const a = Math.sin(x * s + t * 0.15) * 1.2 + Math.cos(y * s * 1.7 - t * 0.1) * 0.9 + Math.sin((x + y) * s * 0.6) * 0.6;
      return 0.25 + a * 0.55; // mostly flowing left→right and down, like the Indus toward the sea
    };
    const step = () => {
      t += 0.016;
      ctx.fillStyle = "rgba(4,7,13,0.085)";
      ctx.fillRect(0, 0, w, h);
      for (const p of ps) {
        const a = field(p.x, p.y);
        let nx = p.x + Math.cos(a) * 1.25, ny = p.y + Math.sin(a) * 1.25;
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
        if (d2 < 16000) { const k = (1 - d2 / 16000) * 3.2 / Math.sqrt(d2 + 1); nx += dx * k; ny += dy * k; }
        ctx.strokeStyle = p.hue < 0.82 ? `rgba(34,211,238,${0.22 + p.hue * 0.25})` : `rgba(167,139,250,0.45)`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
        p.x = nx; p.y = ny; p.life -= 1;
        if (p.life < 0 || p.x < -5 || p.x > w + 5 || p.y < -5 || p.y > h + 5) {
          p.x = Math.random() * w; p.y = Math.random() * h; p.life = 120 + Math.random() * 200;
        }
      }
    };
    const loop = () => { if (visible) step(); raf = requestAnimationFrame(loop); };
    resize();
    if (reduce) { for (let i = 0; i < 120; i++) step(); }
    else loop();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", onMove); };
  }, [density]);
  return <canvas ref={ref} className={className} aria-hidden />;
}
