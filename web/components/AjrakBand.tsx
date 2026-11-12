"use client";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

/** A woven Ajrak ribbon between chapters. It slides sideways as you scroll (block-print reveal). */
function Motif({ i }: { i: number }) {
  return (
    <svg width="72" height="40" viewBox="0 0 72 40" className="shrink-0" aria-hidden>
      <rect width="72" height="40" fill={i % 2 ? "#1B2147" : "#141936"} />
      <path d="M36 6 L40 16 L50 20 L40 24 L36 34 L32 24 L22 20 L32 16 Z" fill="#E0533D" />
      <rect x="31" y="15" width="10" height="10" transform="rotate(45 36 20)" fill="none" stroke="#F3ECDD" strokeOpacity=".7" />
      <circle cx="36" cy="20" r="2" fill="#E8B04B" />
      <circle cx="6" cy="20" r="3" fill="none" stroke="#F3ECDD" strokeOpacity=".5" />
      <circle cx="66" cy="20" r="3" fill="none" stroke="#F3ECDD" strokeOpacity=".5" />
      <path d="M0 2 H72 M0 38 H72" stroke="#E8B04B" strokeOpacity=".5" strokeDasharray="2 4" />
    </svg>
  );
}

export default function AjrakBand({ reverse = false }: { reverse?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], reverse ? ["-30%", "0%"] : ["0%", "-30%"]);
  return (
    <div ref={ref} className="relative overflow-hidden border-y border-line py-0 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <motion.div style={{ x }} className="flex w-[300%]">
        {Array.from({ length: 80 }).map((_, i) => <Motif key={i} i={i} />)}
      </motion.div>
    </div>
  );
}
