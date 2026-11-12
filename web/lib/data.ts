"use client";
import { createContext, useContext } from "react";

export type Team = { id: string; name: string; base: string; lat: number; lon: number; capability: number[] };
export type Site = { id: string; name: string; lat: number; lon: number; people_k: number; needs: number[]; access_factor: number };
export type Run = {
  lam: number;
  frames: number[][];
  frame_eval: number[];
  frame_infeasible: number[];
  energy: number[];
  final: number[];
  p_opt: number;
  feasible: number;
  best_plan: [string, string][];
  found_optimum: boolean;
  n_evals: number;
  opt_index: number[];
};
export type VariantKey = "A" | "B" | "C" | "D";
export type FloodData = {
  meta: { n_qubits: number; n_feasible: number; p: number; shots: number; penalty: number; lams: number[]; f1max: number; f2max: number };
  teams: Team[];
  sites: Site[];
  data_note: string;
  benefit: number[][];
  travel_h: number[][];
  corridor: string[][];
  congestion_h: number;
  plans: string[][];
  feasible_index: number[];
  f1: number[];
  f2: number[];
  pareto: boolean[];
  supported: boolean[];
  variants: Record<VariantKey, string>;
  runs: Record<VariantKey, Run[]>;
  greedy: { lam: number; plan: [string, string][]; f1: number; f2: number; gap: number; optimal: boolean }[];
  depth: { variant: VariantKey; p: number; p_opt_exact: number; feasible_ratio_exact: number; seed: number; uniform_p_opt: number }[];
  penalty_study: { P: number; ground_state_valid: boolean; p_opt_exact: number; feasible_ratio_exact: number }[];
  pareto_recovery: Record<VariantKey, Record<"argmin" | "sample_pool", { points: number[]; recovered: number; of: number; hv_ratio: number }>>;
  noise: { backend: string; shots: number; rows: { variant: VariantKey; depth: number; two_qubit_gates: number; ideal_p_opt: number; noisy_p_opt: number; ideal_feasible: number; noisy_feasible: number; uniform_p_opt: number }[] };
};

export const VCOLOR: Record<VariantKey, string> = { A: "#94a3b8", B: "#fbbf24", C: "#38bdf8", D: "#34d399" };
export const VSHORT: Record<VariantKey, string> = {
  A: "Standard QAOA",
  B: "CVaR-QAOA",
  C: "XY-QAOA",
  D: "XY + CVaR",
};

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const DataCtx = createContext<FloodData | null>(null);
export const useData = () => {
  const d = useContext(DataCtx);
  if (!d) throw new Error("data not loaded");
  return d;
};

export const scal = (d: FloodData, j: number, lam: number) =>
  -(1 - lam) * (d.f1[j] / d.meta.f1max) + lam * (d.f2[j] / d.meta.f2max);

export const optimumIndex = (d: FloodData, lam: number) => {
  let best = 0;
  for (let j = 1; j < d.f1.length; j++) if (scal(d, j, lam) < scal(d, best, lam)) best = j;
  return best;
};

export const orderByObjective = (d: FloodData, lam: number) =>
  d.f1.map((_, j) => j).sort((a, b) => scal(d, a, lam) - scal(d, b, lam));

export const lamIndex = (d: FloodData, lam: number) =>
  d.meta.lams.reduce((bi, l, i) => (Math.abs(l - lam) < Math.abs(d.meta.lams[bi] - lam) ? i : bi), 0);

/** project lon/lat into an SVG box */
export const project = (lon: number, lat: number, w: number, h: number) => {
  const lon0 = 66.85, lon1 = 69.35, lat0 = 25.1, lat1 = 28.55;
  return [((lon - lon0) / (lon1 - lon0)) * w, h - ((lat - lat0) / (lat1 - lat0)) * h] as const;
};
