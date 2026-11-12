"use client";
import { motion, MotionConfig } from "motion/react";
import Cursor from "@/components/Cursor";
import Backdrop from "@/components/Backdrop";
import Workspace from "@/components/workspace/Workspace";
import { BASE_PATH, DataCtx } from "@/lib/data";
import { useFlood } from "@/lib/useFlood";

export default function AppPage() {
  const { data, err } = useFlood();
  return (
    <MotionConfig reducedMotion="user">
      <Cursor />
      <div className="fixed inset-0 isolate"><Backdrop layers={["aurora", "contours", "grid"]} tone="mixed" /></div>
      <motion.header initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="fixed inset-x-0 top-0 z-50 border-b border-line bg-[#0C0F1E]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 md:px-6">
          <a href={`${BASE_PATH}/`} className="flex items-center gap-2 text-sm font-bold" data-cursor="home">
            <span className="relative flex h-5 w-5 items-center justify-center"><span className="absolute h-full w-full animate-ping rounded-full bg-flood/30" /><span className="h-2.5 w-2.5 rounded-full bg-flood" /></span>
            FloodQAOA
          </a>
          <span className="text-muted/40">/</span>
          <span className="text-sm text-text">Quantum Workspace</span>
          <span className="ml-auto hidden items-center gap-2 rounded-full border border-win/30 bg-win/10 px-3 py-1 font-mono text-[10px] text-win md:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-win" /> 12-qubit simulator ready · verified vs Qiskit
          </span>
          <a href="https://github.com/Baqir376/Qiskit_Hackathon" target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink">GitHub</a>
        </div>
      </motion.header>
      {err && <div className="p-24 text-danger">Failed to load data: {err}</div>}
      {!data && !err && <div className="flex h-screen items-center justify-center font-mono text-sm text-muted">initialising 12 qubits…</div>}
      {data && (
        <DataCtx.Provider value={data}>
          <motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative">
            <Workspace />
          </motion.main>
        </DataCtx.Provider>
      )}
    </MotionConfig>
  );
}
