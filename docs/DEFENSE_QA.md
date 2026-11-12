# Judge Q&A: prepared answers (rubric E: "answers to technical questions")

All numbers below come from `results/results.json` and `results/noise_study.json`.

**Q1. Why QAOA and not VQE or quantum annealing?**
The problem is a QUBO, so its Hamiltonian is diagonal (Z and ZZ terms only) and the ground state *is* the optimal plan.
QAOA is the gate-model algorithm designed for exactly that structure. Its cost layer is the problem itself (RZ/RZZ),
so the ansatz carries the problem's structure instead of being a generic hardware-efficient VQE.
The Quantum Alternating Operator Ansatz form also lets us choose a mixer that respects the constraints (XY), which VQE has no natural place for.
Annealing would need D-Wave hardware, which is outside the Qiskit brief.

**Q2. How exactly is the problem mapped to qubits?**
One qubit per decision x[t,s] (3 teams × 4 sites = 12). Objective: −(1−λ)·impact/max + λ·hours/max. Impact is linear (RZ terms).
The congestion of two teams on one corridor is quadratic (RZZ terms). "At most one team per site" is a slack-free pairwise
penalty P·x·x′ (also RZZ). "Each team exactly one site" is P(Σx−1)² for the X mixer, or is enforced *by construction* with the XY mixer.
`tests/test_formulation.py` checks the Ising energies against the hand-written objective for all 4,096 states.
`tests/test_properties.py` (Hypothesis) checks the same for randomly generated scenarios.

**Q3. Is there a quantum speed-up?**
No, and we don't claim one. 4,096 states brute-force in milliseconds. The contributions are a validated mapping, and an ablation
showing which design choices matter: the XY mixer lifts valid-plan probability from 12% to 98%, and XY + CVaR raises P(optimal)
13× over standard QAOA.

**Q4. Isn't "392× better than random" inflated?**
Partly, and we say so. Variants C and D only search the 64 valid-shaped states. Inside that space, training itself
adds about 6× (D). The rest of the gain comes from the encoding, which is still a genuine design win.

**Q5. How did you choose the penalty weight P?**
We swept it. Below P ≈ 0.25 the ground state is no longer the true optimum (exhaustively checked). P = 0.5 trained best.
At P = 4, training collapsed. Our default P = 2 was conservative, and that hurt variants A/B. This is documented as a limitation.

**Q6. Why CVaR?**
QAOA's answer is read out as the *best sample*, not the average. CVaR_α optimises the mean of the best α-fraction (α = 0.1),
which matches that read-out (Barkoutsos et al., Quantum 2020). In our data it beat the plain expectation in both the X and XY families.

**Q7. How do you handle two objectives?**
A weighted-sum sweep over λ ∈ {0, 0.1, …, 1} traces the Pareto front. Weighted sums cannot reach *unsupported* Pareto points.
Our instance has one. Taking only the best sample per λ finds 3 of 4 Pareto plans. Pooling every QAOA sample across the sweep finds all 4, which is a benefit
of QAOA returning a distribution. At 24 plans, though, the shots cover most of them. ε-constraint would be the principled fix.

**Q8. What happens on real hardware?**
We re-ran the trained circuits on an Aer noise model of IBM Torino: about 370–394 CZ gates and depth about 510–545 after routing. Valid-plan
probability drops from 0.81–0.99 to about 0.13, and D still samples the optimum about 49× above random. Real hardware would need error mitigation
and a heavy-hex-aware XY layout. No real-hardware run was made.

**Q9. How does it scale?**
Qubits = teams × sites. A district plan of 20 × 30 needs 600 qubits. Routes forward: decomposition by corridor,
parameter transfer across instances (we already transfer between neighbouring λ, as in Kotil et al. 2025), and warm-start QAOA.

**Q10. How do we know the website isn't faking the quantum part?**
The landing page replays recorded Qiskit statevector snapshots. The `/app` workspace runs a TypeScript port of the exact circuit.
`web/tests/unit/qsim.test.ts` checks it against Qiskit's probabilities for all 44 trained runs (max |Δp| = 5·10⁻⁶, which is the rounding of the stored values).

**Q11. Is the data real?**
The geography is real: Sindh towns hit in 2022, with approximate coordinates. Population, need and access figures are synthetic and are labelled so everywhere.
This is a methods demonstration, not an operational tool.

**Q12. Classical baselines?**
Exact brute force (optimal by definition), the exact Pareto front with hypervolume, and a greedy "dispatcher's rule of thumb",
which is optimal at only 5 of 11 priority settings.
