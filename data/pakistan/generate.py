"""Generate the GridQ 'City X' instance in a Pakistan summer load-shedding setting (CSV, spec §18).

SYNTHETIC DATA. The feeder set, peak loads and operating windows follow the team's City X design
(hospital 8 MW, residential A 12 / B 10, textile factory 20 (08-20), manufacturing 18 (08-18),
commercial A 15 (09-22) / B 12 (10-21), street lighting 5 (18-06)). Hourly demand shapes, AT&C loss
percentages and switching costs are illustrative assumptions modelled on public descriptions of Pakistani
DISCO operations. No real utility data are used.

Supply scenarios (discussion §24.1): normal 100, reduced 85, severe 70, emergency 55 MW.
The default instance uses the SEVERE (70 MW) scenario with a 2 MW reserve.
Units: integer MW (documented QUBO unit; no quantisation error).
Priority multipliers p_i follow the spec table (hospital 10, essential 9, essential manufacturing 7,
residential 6, ordinary factory 5, commercial 3); v_i = 1 (no value-of-lost-load survey data), so c_i = p_i.
Street lighting is treated as essential public-safety load (p = 7, assumption).
"""
import csv
import json
from pathlib import Path

import numpy as np

OUT = Path(__file__).parent
H = np.arange(24)                       # hour index 0..23 = clock hour 00:00..23:00
SCENARIOS = {"normal": 100, "reduced": 85, "severe": 70, "emergency": 55}
DEFAULT = "severe"
RESERVE = 2


def window(start, end):
    """availability mask for clock hours [start, end), wrapping past midnight."""
    return ((H >= start) & (H < end)) if start < end else ((H >= start) | (H < end))


def shape(peak, base_frac, peaks):
    """smooth daily profile: base + gaussian bumps at (hour, width, weight); normalised to `peak`."""
    prof = np.full(24, base_frac)
    for c, w, a in peaks:
        d = np.minimum(np.abs(H - c), 24 - np.abs(H - c))
        prof = prof + a * np.exp(-0.5 * (d / w) ** 2)
    return np.round(peak * prof / prof.max()).astype(int)


#        id    name                         category        crit  p   min_on max_off sigma TR    AT&C%  window
FEEDERS = [
    ("HSP", "Hospital (critical)",          "hospital",      1, 10,  24,  0,  0.0, "T1",  4,  (0, 24)),
    ("RSA", "Residential A",                "residential",   0,  6,  16,  3,  2.0, "T1", 14,  (0, 24)),
    ("RSB", "Residential B",                "residential",   0,  6,  16,  3,  2.0, "T1", 38,  (0, 24)),
    ("TEX", "Textile factory",              "industrial",    0,  7,   8,  3,  5.0, "T2",  8,  (8, 20)),
    ("MFG", "Manufacturing plant",          "industrial",    0,  5,   6,  3,  5.0, "T2",  9,  (8, 18)),
    ("CMA", "Commercial A",                 "commercial",    0,  3,   8,  4,  1.5, "T3", 21,  (9, 22)),
    ("CMB", "Commercial B",                 "commercial",    0,  3,   6,  4,  1.5, "T3", 27,  (10, 21)),
    ("STL", "Street lighting",              "essential",     0,  7,   8,  2,  1.0, "T1",  5,  (18, 6)),
]
PROFILES = {
    "HSP": shape(8, 0.75, [(13, 3, 0.25)]),
    "RSA": shape(12, 0.45, [(14, 2.5, 0.25), (21, 2.0, 0.55)]),
    "RSB": shape(10, 0.45, [(14, 2.5, 0.25), (21, 2.0, 0.55)]),
    "TEX": shape(20, 0.85, [(14, 4, 0.15)]),
    "MFG": shape(18, 0.85, [(13, 3, 0.15)]),
    "CMA": shape(15, 0.45, [(19, 2.5, 0.55)]),
    "CMB": shape(12, 0.45, [(18, 2.5, 0.55)]),
    "STL": shape(5, 1.0, []),
}
TRANSFORMERS = {"T1": 34, "T2": 36, "T3": 26}
PAIRS = [("RSA", "RSB", 1.0), ("TEX", "MFG", 1.0), ("CMA", "CMB", 1.0)]

demand, avail = {}, {}
for fid, *_rest, win in FEEDERS:
    a = window(*win).astype(int)
    avail[fid] = a
    demand[fid] = PROFILES[fid] * a
total = sum(demand.values())

with open(OUT / "feeders.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["feeder_id", "name", "category", "critical", "impact_weight", "min_on_hours", "max_consecutive_off",
                "switching_cost", "transformer_id", "atc_loss_pct", "operating_window"])
    for fid, name, cat, crit, p, mon, moff, sig, tr, loss, win in FEEDERS:
        w.writerow([fid, name, cat, crit, p, mon, moff, sig, tr, loss, f"{win[0]:02d}:00-{win[1] % 24:02d}:00"])
with open(OUT / "demand_profiles.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["feeder_id", "hour", "demand_mw", "available"])
    for fid, *_ in FEEDERS:
        for t in range(24):
            w.writerow([fid, t + 1, int(demand[fid][t]), int(avail[fid][t])])
with open(OUT / "supply_profiles.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["hour", "available_supply_mw", "reserve_mw"])
    for t in range(24):
        w.writerow([t + 1, SCENARIOS[DEFAULT], RESERVE])
with open(OUT / "transformers.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["transformer_id", "capacity_mw"])
    for k, v in TRANSFORMERS.items():
        w.writerow([k, v])
with open(OUT / "fairness_pairs.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["feeder_i", "feeder_j", "weight"])
    for a, b, wt in PAIRS:
        w.writerow([a, b, wt])
(OUT / "config.json").write_text(json.dumps({
    "name": "City X, Pakistan summer load-shedding (synthetic)",
    "lambdas": [1.0, 1.0, 1.0],
    "scales": "from_atc_baseline",
    "scenarios_mw": SCENARIOS, "default_scenario": DEFAULT, "reserve_mw": RESERVE,
    "meta": {"data_note": "Synthetic data on the team's City X design; Pakistan framing; not real utility data.",
             "units": "integer MW", "horizon": "24 h, hourly"},
}, indent=2), encoding="utf-8")
print("peak demand", int(total.max()), "MW at", int(np.argmax(total)), ":00; hourly demand", total.tolist())
for name, mw in SCENARIOS.items():
    print(f"{name:9s} {mw} MW -> short in {int((total > mw - RESERVE).sum())} h, max shortfall {int(max(0, (total - (mw - RESERVE)).max()))} MW")
