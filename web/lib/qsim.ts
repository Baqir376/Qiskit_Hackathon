/**
 * In-browser 12-qubit statevector simulator for our exact Qiskit QAOA circuits.
 * A line-by-line port of floodqaoa/qaoa.py::build_qaoa_circuit (verified against Qiskit with
 * web/scripts/verify-qsim.ts — max |p_browser − p_qiskit| is printed there).
 * Basis index i, qubit k = bit k of i (Qiskit little-endian). Variable v = t*S + s.
 */

export type Scenario = {
  T: number; S: number;
  benefit: number[][]; travel: number[][]; corridor: string[][]; congestion: number;
  f1max: number; f2max: number;
};
export type Mixer = "x" | "xy";
export type Objective = "expectation" | "cvar";

export const N = 12;
export const DIM = 1 << N;

/** penalised scalarised cost of every basis state (equals Qiskit's Ising diagonal up to a constant) */
export function costDiagonal(sc: Scenario, lam: number, penalty: number, oneHot: boolean): Float64Array {
  const { T, S } = sc;
  const diag = new Float64Array(DIM);
  const pairs: [number, number][] = [];
  for (let t1 = 0; t1 < T; t1++) for (let t2 = t1 + 1; t2 < T; t2++)
    for (let s1 = 0; s1 < S; s1++) for (let s2 = 0; s2 < S; s2++)
      if (sc.corridor[t1][s1] === sc.corridor[t2][s2]) pairs.push([t1 * S + s1, t2 * S + s2]);
  for (let i = 0; i < DIM; i++) {
    let f1 = 0, f2 = 0;
    for (let v = 0; v < T * S; v++) if ((i >> v) & 1) { const t = (v / S) | 0, s = v % S; f1 += sc.benefit[t][s]; f2 += sc.travel[t][s]; }
    for (const [a, b] of pairs) if (((i >> a) & 1) && ((i >> b) & 1)) f2 += sc.congestion;
    let F = -(1 - lam) * f1 / sc.f1max + lam * f2 / sc.f2max;
    for (let s = 0; s < S; s++) { let n = 0; for (let t = 0; t < T; t++) n += (i >> (t * S + s)) & 1; F += penalty * n * (n - 1) / 2; }
    if (oneHot) for (let t = 0; t < T; t++) { let n = 0; for (let s = 0; s < S; s++) n += (i >> (t * S + s)) & 1; F += penalty * (n - 1) * (n - 1); }
    diag[i] = F;
  }
  return diag;
}

export function isFeasible(i: number, T = 3, S = 4) {
  for (let t = 0; t < T; t++) { let n = 0; for (let s = 0; s < S; s++) n += (i >> (t * S + s)) & 1; if (n !== 1) return false; }
  for (let s = 0; s < S; s++) { let n = 0; for (let t = 0; t < T; t++) n += (i >> (t * S + s)) & 1; if (n > 1) return false; }
  return true;
}

/** |psi(theta)|^2, theta = [gamma_0..gamma_{p-1}, beta_0..beta_{p-1}] (same layout as Qiskit run) */
export function qaoaProbabilities(diag: Float64Array, theta: number[], p: number, mixer: Mixer, T = 3, S = 4): Float64Array {
  const re = new Float64Array(DIM), im = new Float64Array(DIM);
  if (mixer === "x") {
    re.fill(1 / Math.sqrt(DIM));
  } else {
    const amp = Math.pow(1 / Math.sqrt(S), T);
    for (let i = 0; i < DIM; i++) {
      let ok = true;
      for (let t = 0; t < T && ok; t++) { let n = 0; for (let s = 0; s < S; s++) n += (i >> (t * S + s)) & 1; ok = n === 1; }
      if (ok) re[i] = amp;
    }
  }
  const ring: [number, number][] = [];
  for (let i = 0; i < S; i++) ring.push([i, (i + 1) % S]);
  const order: [number, number][] = [];
  for (const start of [0, 1]) for (let t = 0; t < T; t++)
    for (let k = start; k < ring.length; k += 2) order.push([t * S + ring[k][0], t * S + ring[k][1]]);

  for (let layer = 0; layer < p; layer++) {
    const g = theta[layer], b = theta[p + layer];
    // cost layer exp(-i g H)
    for (let i = 0; i < DIM; i++) {
      const ph = -g * diag[i], c = Math.cos(ph), s = Math.sin(ph);
      const r = re[i], m = im[i];
      re[i] = r * c - m * s; im[i] = r * s + m * c;
    }
    if (mixer === "x") {
      // RX(2b) = exp(-i b X) on every qubit
      const c = Math.cos(b), s = Math.sin(b);
      for (let q = 0; q < N; q++) {
        const bit = 1 << q;
        for (let i = 0; i < DIM; i++) if (!(i & bit)) {
          const j = i | bit;
          const ar = re[i], ai = im[i], br = re[j], bi = im[j];
          re[i] = c * ar + s * bi; im[i] = c * ai - s * br;
          re[j] = c * br + s * ai; im[j] = c * bi - s * ar;
        }
      }
    } else {
      // RXX(b) then RYY(b) on each ring edge: exp(-i b/2 XX), exp(-i b/2 YY)
      const c = Math.cos(b / 2), s = Math.sin(b / 2);
      for (const [qa, qb] of order) {
        const ba = 1 << qa, bb = 1 << qb, m = ba | bb;
        for (const yy of [false, true]) {
          // in-place on each pair (i, j = i ^ m) with i < j : new_i = c a_i - i s sg a_j ; new_j = c a_j - i s sg a_i
          for (let i = 0; i < DIM; i++) {
            const j = i ^ m;
            if (j < i) continue;
            const sg = yy ? ((((i & ba) !== 0) === ((i & bb) !== 0)) ? -1 : 1) : 1;
            const ar = re[i], ai = im[i], br = re[j], bi = im[j], k = s * sg;
            re[i] = c * ar + k * bi; im[i] = c * ai - k * br;
            re[j] = c * br + k * ai; im[j] = c * bi - k * ar;
          }
        }
      }
    }
  }
  const probs = new Float64Array(DIM);
  for (let i = 0; i < DIM; i++) probs[i] = re[i] * re[i] + im[i] * im[i];
  return probs;
}

export function evaluate(probs: Float64Array, diag: Float64Array, objective: Objective, order: Uint32Array | null, alpha = 0.1) {
  if (objective === "expectation") { let e = 0; for (let i = 0; i < DIM; i++) e += probs[i] * diag[i]; return e; }
  const ord = order!;
  let cum = 0, acc = 0;
  for (let k = 0; k < DIM; k++) {
    const i = ord[k], pk = probs[i];
    if (cum + pk >= alpha) { acc += (alpha - cum) * diag[i]; return acc / alpha; }
    acc += pk * diag[i]; cum += pk;
  }
  return acc / alpha;
}

export function sortedOrder(diag: Float64Array) {
  const idx = new Uint32Array(DIM);
  for (let i = 0; i < DIM; i++) idx[i] = i;
  return idx.sort((a, b) => diag[a] - diag[b]);
}

/** Nelder–Mead as a generator: yields after every function evaluation (for live animation). */
export function* nelderMead(f: (x: number[]) => number, x0: number[], maxEval = 220, step = 0.4) {
  const n = x0.length;
  let simplex: { x: number[]; v: number }[] = [{ x: x0.slice(), v: f(x0) }];
  yield simplex[0];
  for (let k = 0; k < n; k++) {
    const x = x0.slice(); x[k] += step;
    const pt = { x, v: f(x) }; simplex.push(pt); yield pt;
  }
  let evals = n + 1;
  const ev = (x: number[]) => { evals++; return { x, v: f(x) }; };
  while (evals < maxEval) {
    simplex.sort((a, b) => a.v - b.v);
    const best = simplex[0], worst = simplex[n], second = simplex[n - 1];
    const cen = new Array(n).fill(0);
    for (let k = 0; k < n; k++) for (let d = 0; d < n; d++) cen[d] += simplex[k].x[d] / n;
    const lerp = (a: number[], b: number[], t: number) => a.map((ai, d) => ai + t * (b[d] - ai));
    const r = ev(lerp(cen, worst.x, -1)); yield r;
    if (r.v < best.v) {
      const e = ev(lerp(cen, worst.x, -2)); yield e;
      simplex[n] = e.v < r.v ? e : r;
    } else if (r.v < second.v) {
      simplex[n] = r;
    } else {
      const c = ev(lerp(cen, worst.x, 0.5)); yield c;
      if (c.v < worst.v) simplex[n] = c;
      else {
        simplex = simplex.map((p, k) => (k === 0 ? p : ev(lerp(best.x, p.x, 0.5))));
        for (let k = 1; k <= n; k++) yield simplex[k];
      }
    }
  }
  simplex.sort((a, b) => a.v - b.v);
  return simplex[0];
}

/** seeded multinomial sampling of measurement shots */
export function sampleShots(probs: Float64Array, shots: number, seed = 7) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const cdf = new Float64Array(DIM);
  let acc = 0;
  for (let i = 0; i < DIM; i++) { acc += probs[i]; cdf[i] = acc; }
  const counts = new Map<number, number>();
  for (let k = 0; k < shots; k++) {
    const u = rnd() * acc;
    let lo = 0, hi = DIM - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
    counts.set(lo, (counts.get(lo) ?? 0) + 1);
  }
  return counts;
}

/** Multi-start optimisation (linear-ramp start + seeded random starts), like the Python pipeline. */
export function* multiStart(f: (x: number[]) => number, p: number, starts = 4, maxEvalEach = 160, seed = 3) {
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const ramp = [...Array(p)].map((_, k) => 0.1 + (0.7 * k) / Math.max(1, p - 1))
    .concat([...Array(p)].map((_, k) => 0.6 * (0.8 - (0.7 * k) / Math.max(1, p - 1))));
  const inits = [ramp];
  for (let k = 1; k < starts; k++) inits.push([...Array(p)].map(() => rnd() * Math.PI).concat([...Array(p)].map(() => rnd() * Math.PI / 2)));
  for (const x0 of inits) yield* nelderMead(f, x0, maxEvalEach);
}
