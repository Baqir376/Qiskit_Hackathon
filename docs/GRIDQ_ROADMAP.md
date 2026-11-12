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
