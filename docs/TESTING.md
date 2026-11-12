# Testing strategy

Every type of test below runs locally and in CI (`.github/workflows/tests.yml`) on every push.

| Type | Tool | What it proves | Where |
|---|---|---|---|
| **Unit** | pytest | Ising energies equal the hand-written objective for all 4,096 states; penalty ground state = constrained optimum for every λ; haversine, Pareto mask, hypervolume, greedy feasibility | `tests/test_formulation.py`, `tests/test_baseline_and_regression.py` |
| **Property-based** | Hypothesis | The QUBO→Ising mapping is correct for *randomly generated* scenarios (2–3 teams, 2–4 sites, random corridors); XY mixer never leaves the one-hot subspace for random angles; statevector stays normalised; CVaR₁ = expectation | `tests/test_properties.py` |
| **Cross-implementation** | qiskit-optimization, Vitest | Our penalties agree with `QuadraticProgramToQubo`; the browser simulator reproduces Qiskit probabilities for all 44 trained runs (max |Δp| = 5·10⁻⁶) | `tests/test_formulation.py`, `web/tests/unit/qsim.test.ts` |
| **Regression** | pytest | Headline numbers in the report/README/website (variant ordering, 11/11 optima, greedy 5/11) cannot drift silently | `tests/test_baseline_and_regression.py` |
| **Reproducibility** | pytest | Re-running the pipeline with the committed seed reproduces the committed P(optimal) to 1e-9; same seed gives identical shots | `tests/test_baseline_and_regression.py` |
| **Integration / smoke** | Streamlit AppTest, nbclient | The dashboard renders and runs a live QAOA job headlessly; the demo notebook executes end to end | `tests/test_smoke_app.py`, `demo.ipynb` |
| **End-to-end (E2E)** | Playwright | Landing page loads with no JS errors; λ slider changes the plan; CTA opens `/app`; Qiskit replay and live in-browser QAOA both finish with a verdict against the exact optimum | `web/tests/e2e/site.spec.ts` |
| **Accessibility** | axe-core | No critical/serious WCAG 2 A/AA violations on `/` and `/app` (this caught and fixed 18 contrast issues) | `web/tests/e2e/site.spec.ts` |
| **Performance budget** | Playwright | DOMContentLoaded < 3 s; JavaScript < 1.5 MB | `web/tests/e2e/site.spec.ts` |
| **Responsive** | Playwright | No horizontal overflow at 390 px on both pages | `web/tests/e2e/site.spec.ts` |
| **Static analysis** | ruff, eslint, tsc | Lint and type errors | CI |
| **Security** | pip-audit, npm audit | Known-vulnerable dependencies. Upgraded Next.js 15.5.4 → 15.5.29 (fixed a critical RCE advisory) | CI |

## Results (12 Nov 2026)

- pytest: **58 passed**. Coverage: formulation 100%, scenario 100%, baseline 98%, qaoa 96%, overall 50% (the plotting and export scripts are checked through their outputs).
- Vitest: **11 passed**.
- Playwright: **10 passed** (E2E, accessibility, performance, responsive).
- ruff / eslint / tsc: **clean**.
- pip-audit: **no known vulnerabilities**.
- npm audit (prod): 3 remaining advisories in `postcss`/`sharp`, which are build-time image tooling inside Next.js. The site is a static export with `images.unoptimized`, so sharp never runs and there is no server. Accepted and documented.

## Bugs the tests found

1. **CVaR edge case:** with α = 1, floating-point cumulative probability could fall just short of 1 and index past the array. Fixed in `qaoa.py`. Production runs used α = 0.1, and the regression tests confirm no committed number changed.
2. **Precision drift:** the web export rounded the scenario to 2 decimals, giving a 1e-3 relative error against Qiskit. Fixed by exporting full precision.
3. **Accessibility:** 18 colour-contrast failures (dimmed scrollytelling text, 60–70% opacity footnotes). Fixed.

## Run

```bash
pytest -q --cov=floodqaoa
cd web && npm test && npm run build && npx playwright test
```
