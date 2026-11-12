# 3-minute pitch + demo script (≈ 420 spoken words)

**0:00–0:25 · Hook (face cam or the map figure)**
"August 2022. A third of Pakistan is under water. In Dadu, Sindh, a district control room has three
specialist teams (a boat-rescue unit, a mobile medical camp and a supply convoy) and four towns crying
for help. Send the boats to Johi, where the most people are stranded, and they lose hours on a broken
road. Send everyone up the one surviving highway and it jams. There is no single right answer, only
trade-offs. We built FloodQAOA to show the commander those trade-offs, computed by a quantum algorithm."

**0:25–1:00 · Formulation (show README table / report §2)**
"Each decision is a qubit: team t goes to site s. That gives 12 qubits. Objective one: relief impact, the people
reached, weighted by how well the team's skills match the site's needs. Objective two: response burden, the travel
hours plus a quadratic congestion term when two teams share a corridor. Constraints: every team goes
somewhere, and one team per site, so one town must wait. That's the real dilemma. We encode it as a
Qiskit QuadraticProgram and map it to an Ising Hamiltonian."

**1:00–1:40 · Quantum design (architecture figure)**
"Standard QAOA wastes most of its probability on impossible plans, so we ran a four-way ablation.
A is plain QAOA with penalties. B adds CVaR, which trains on the best tail of samples. C swaps the mixer
for an XY mixer that starts every team in a W state. It physically cannot send a team to two places,
so the search space shrinks from 4096 to 64 states. D combines both. We then sweep the priority
weight λ from 'maximum reach' to 'fastest response' to trace the Pareto front."

**1:40–2:30 · Demo (Streamlit: `streamlit run app.py`)**
- Move the λ slider. The exact brute-force optimum updates on the left.
- Pick variant D and press ▶ Run QAOA live. Show the convergence curve and the plan matching the exact optimum ✅.
- Read out the live numbers. Live runs vary by seed: P(optimal) is typically 0.05–0.10 (the sweep averages 0.096, about 6× better than guessing among 64 valid-shaped plans, about 390× better than 1/4096), feasible probability ≈ 0.8 vs 0.6% random. Greedy rule-of-thumb dispatcher: optimal at only 5 of 11 priority settings.
- Show the Pareto plot. Point to the red square: "this plan is Pareto-optimal, but no weighted sum can
  reach it. We say that openly."

**2:30–3:00 · Honesty + close (noise figure)**
"What didn't work: at 12 qubits brute force is instant, so there is no speedup here, and we don't claim one. Under a
realistic IBM Torino noise model every variant loses most of its edge: roughly 380 two-qubit gates is a lot of noise. And the
data is synthetic on real geography. What we deliver is a verified mapping, 26 correctness tests, and an
honest map of which QAOA design choices actually matter for constrained disaster dispatch.
FloodQAOA: decisions under pressure, with every trade-off visible."
