# GridQ — verified review and build roadmap

GridQ: quantum-assisted, fairness-aware multi-period feeder scheduling (Energy & Smart Infrastructure).
Setting: Pakistan feeder-level load-shedding. All feeder data are synthetic and clearly labelled.

## 1. Verification of the specification (executed, Qiskit 2.6.2)

| Spec claim | Status |
|---|---|
| Mini QUBO expansion, `Q_matrix`, constant 12 | Verified for all 16 bitstrings |
| Optima `[0,1,1,0]`, `[1,0,0,1]`, cost 7.0; penalty 10 sufficient (best infeasible = 14.5) | Verified |
| QUBO→Ising coefficients (C₀, hᵢ, Jᵢⱼ) and `qubo_to_ising` incl. Pauli order | Verified, 0 mismatches |
| `qaoa_ansatz`, `StatevectorEstimator`, `StatevectorSampler` | Work in Qiskit 2.6.2, no deprecation warnings |
| QAOA on mini: P(optimal) | 0.40 (p=1), 0.77 (p=2), 0.94 (p=3) vs 0.125 random |

## 2. Corrections adopted (these override the spec)

1. **Multi-start parameter optimisation.** The spec's single start `[0.1, 0.1]` gets stuck at ⟨H⟩ = 11.23 (multi-start: 9.03). Use a linear-ramp start plus seeded random starts.
2. **Parameter order.** `qaoa_ansatz` orders parameters `[β…, γ…]` alphabetically, not (γ, β). Always bind by name.
3. **Exact solver = linearised MILP, not "MILP" on a quadratic objective.** Each product xₐx_b in the fairness term is replaced by y ≤ xₐ, y ≤ x_b, y ≥ xₐ + x_b − 1 (exact for binaries). |x_t − x_{t−1}| becomes two inequalities. Solved with HiGHS via `scipy.optimize.milp`. Cross-checked against exhaustive search.
4. **Switching limit stays out of the QUBO.** (Σ s + q − S)² with quadratic s is quartic. It is enforced only in the MILP and the feasibility checker.
5. **The rolling-horizon QAOA qubit claim is corrected.** A 3-hour window over N feeders needs 3N primary qubits plus slack, not "8–16". The full city runs classically; QAOA runs on feeder sub-problems sized at 20 qubits or fewer.
6. **Slack-free encodings where exact:** L = 1 outage windows use (1−x_t)(1−x_{t+1}); pairwise capacity uses products; critical and unavailable variables are fixed in preprocessing. Binary slack is used only where unavoidable, with documented bit bounds.
7. **One fairness definition everywhere:** w·(ρᵢ − ρⱼ)² with ρ = U/E. The mini example becomes w = 4 on ρ, numerically identical to the spec.
8. No `qiskit-algorithms` dependency. SPSA, if used, is implemented in-repo.

## 3. Build milestones (each gated by tests)

| # | Deliverable | Gate |
|---|---|---|
| M1 | `gridq/` data model, objectives f1–f3, feasibility checker, mini instance, Pakistan instances (CSV) | unit tests, hand-checked values |
| M2 | Exhaustive solver, linearised MILP (HiGHS), greedy (AT&C-style and priority), simulated annealing | MILP = exhaustive on random small instances |
| M3 | General QUBO builder (penalties, slack encoding, preprocessing) and Ising converter | QUBO = original + penalties on all 2ⁿ states (property tests) |
| M4 | QAOA solver: `qaoa_ansatz`, Estimator/Sampler, multi-start, optional CVaR, decode + feasibility | mini P(opt) reproducible, notebook PoC |
| M5 | Experiments: depth, penalty sweep, supply stress, fairness and switching sensitivity, scaling, rolling horizon, supply shock | `results/*.json`, figures |
| M6 | Report (.docx), README, judge Q&A, CI | all tests green |
| M7 | Website: landing and Grid Workspace (24h heatmap, supply/demand, solver comparison, live in-browser QAOA on sub-problems) | E2E + a11y tests |

## 4. Reconciliation with the team discussion document (12 Nov 2026)

Source precedence: the two specification files override the earlier discussion where they conflict.
Items the discussion adds are adopted below.

| Topic | Discussion | Decision |
|---|---|---|
| Objective | −λ₁·weighted served + λ₂·weighted unserved + λ₃·switching + λ₄·Σ\|ρᵢ−ρⱼ\| | **Spec version**: weighted unserved only (served is the same up to a constant), squared fairness (QUBO-compatible, as the discussion itself suggests) |
| City X feeders | Hospital 8, Residential A 12, Residential B 10, Textile 20 (08–20), Manufacturing 18 (08–18), Commercial A 15 (09–22), Commercial B 12 (10–21), Street lighting 5 (18–06) MW peak | **Adopted** as the 24-h instance (Pakistan framing; synthetic profiles) |
| Supply scenarios | Normal 100, reduced 85, severe 70, emergency 55 MW | **Adopted** (supply-stress experiment) |
| Demo shock | 25 % supply drop, re-optimise | **Adopted** (rolling re-optimisation with state carry-over) |
| Historical fairness | V_eff = V + η·H_i | **Adopted** as an optional extension (c_eff = c_i + η·H_i) |
| Feeder thermal limit | D_it x_it ≤ K_i | **Adopted** (fixed in preprocessing) |
| Worked instance | 5 feeders × 4 slots, supply 45/35/50/30 MW | **Adopted** as the Level-2 QAOA instance (weights defined explicitly) |
| Goal hierarchy | critical > feasibility > service > switching/fairness | **Adopted**: penalties are verified to preserve this order |
| Min up/down durations | optional | Future extension (not in baseline) |
