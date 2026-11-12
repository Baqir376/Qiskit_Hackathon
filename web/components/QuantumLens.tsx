"use client";
import { useMemo } from "react";

/** The "quantum layer" revealed under the cursor lens: a field of the register's basis states.
 *  Static (no ambient motion); only the lens position changes, driven by --lx/--ly/--lr on the parent. */
const OPT = "0100·0010·0001";

function ket(i: number) {
  // deterministic pseudo-random one-hot-ish 12-bit labels, grouped per team
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const grp = (n: number) => { const p = Math.floor(r(n) * 4); return [0, 1, 2, 3].map((j) => (j === p ? "1" : "0")).join(""); };
  return `${grp(1)}·${grp(2)}·${grp(3)}`;
}

export default function QuantumLens() {
  const cells = useMemo(() => {
    const out: { k: string; a: string; opt: boolean }[] = [];
    for (let i = 0; i < 160; i++) {
      const opt = i === 47 || i === 93 || i === 131;
      const amp = opt ? 0.302 : 0.02 + (((Math.sin(i * 3.7) + 1) / 2) * 0.09);
      out.push({ k: opt ? OPT : ket(i), a: amp.toFixed(3), opt });
    }
    return out;
  }, []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        WebkitMaskImage: "radial-gradient(circle var(--lr, 0px) at var(--lx, 50%) var(--ly, 50%), black 55%, transparent 100%)",
        maskImage: "radial-gradient(circle var(--lr, 0px) at var(--lx, 50%) var(--ly, 50%), black 55%, transparent 100%)",
      }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(43,53,144,0.55),rgba(12,15,30,0.9))]" />
      <div className="absolute inset-0 grid grid-cols-4 content-center gap-x-6 gap-y-3 px-8 font-mono text-[12px] sm:grid-cols-6 lg:grid-cols-8">
        {cells.map((c, i) => (
          <div key={i} className={`whitespace-nowrap ${c.opt ? "text-flood [text-shadow:0_0_14px_rgba(232,176,75,0.9)]" : "text-text/35"}`}>
            <span className="text-quantum/70">{c.a}</span>|{c.k}⟩
          </div>
        ))}
      </div>
    </div>
  );
}
