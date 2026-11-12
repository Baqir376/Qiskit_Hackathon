"""Generate the synthetic 'Pakistan summer load-shedding' GridQ instance (CSV, spec §18).

SYNTHETIC DATA. Feeder types, demand shapes and the summer supply shortfall are modelled on the public
description of Pakistani DISCO operations (feeder-level load management by AT&C-loss bands, evening-peak
residential cooling load, grid-station allocation below demand). No real utility data are used; numbers
are illustrative and must not be read as measurements of any real feeder.
"""
import csv
import json
from pathlib import Path

import numpy as np

OUT = Path(__file__).parent
H = np.arange(24)


def bump(center, width, height):
    d = np.minimum(np.abs(H - center), 24 - np.abs(H - center))
    return height * np.exp(-0.5 * (d / width) ** 2)


def q(x):  # quantise to 0.5 MW (documented unit for QUBO coefficients)
    return np.round(np.asarray(x) * 2) / 2


FEEDERS = [
    # id, name, category, critical, c (=v*p), min_on, max_off, sigma, transformer, AT&C loss %
    ("HSP", "Hospital & emergency", "hospital", 1, 10.0, 24, 0, 0.0, "T1", 6),
    ("WTR", "Water pumping station", "essential", 0, 9.0, 16, 2, 2.0, "T1", 9),
    ("RSA", "Residential A (low-loss)", "residential", 0, 6.0, 14, 3, 2.0, "T1", 12),
    ("RSB", "Residential B (medium-loss)", "residential", 0, 6.0, 14, 3, 2.0, "T2", 31),
    ("RSC", "Residential C (high-loss)", "residential", 0, 6.0, 14, 3, 2.0, "T2", 55),
    ("IND", "Industrial estate", "industrial", 0, 5.0, 10, 6, 4.0, "T2", 10),
    ("COM", "Commercial market", "commercial", 0, 3.0, 8, 6, 1.5, "T1", 18),
    ("MIX", "Mixed bazaar & homes", "mixed", 0, 4.5, 12, 4, 1.5, "T1", 42),
]

demand = {
    "HSP": q(2.0 + 0 * H),
    "WTR": q(1.0 + bump(6, 2.0, 0.8) + bump(18, 2.0, 0.8)),
    "RSA": q(1.5 + bump(14, 2.5, 0.8) + bump(21.5, 2.0, 1.8)),
    "RSB": q(1.8 + bump(14, 2.5, 1.0) + bump(21.5, 2.0, 2.0)),
    "RSC": q(2.0 + bump(14, 2.5, 1.0) + bump(21.5, 2.0, 2.3)),
    "IND": q(np.where((H >= 8) & (H < 20), 4.0, 1.0)),
    "COM": q(np.where((H >= 10) & (H < 23), 2.0 + bump(19, 2.0, 0.8), 0.5)),
    "MIX": q(1.2 + bump(13, 3.0, 0.6) + bump(21, 2.0, 1.2)),
}
total = sum(demand.values())
# grid-station allocation: comfortable at night, ~25-30% short at the evening peak (summer shortfall)
alloc = q(np.minimum(total, 15.5 + bump(4, 3.0, 1.0)))
reserve = np.full(24, 0.5)

with open(OUT / "feeders.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["feeder_id", "name", "category", "critical", "impact_weight", "min_on_hours", "max_consecutive_off",
                "switching_cost", "transformer_id", "atc_loss_pct"])
    for r in FEEDERS:
        w.writerow(r)
with open(OUT / "demand_profiles.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["feeder_id", "hour", "demand_mw", "available"])
    for fid, *_ in FEEDERS:
        for t in range(24):
            w.writerow([fid, t + 1, float(demand[fid][t]), 1])
with open(OUT / "supply_profiles.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["hour", "available_supply_mw", "reserve_mw"])
    for t in range(24):
        w.writerow([t + 1, float(alloc[t] + reserve[t]), float(reserve[t])])
with open(OUT / "transformers.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["transformer_id", "capacity_mw"])
    w.writerow(["T1", 10.0]); w.writerow(["T2", 11.0])
with open(OUT / "fairness_pairs.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["feeder_i", "feeder_j", "weight"])
    for a, b in (("RSA", "RSB"), ("RSA", "RSC"), ("RSB", "RSC")):
        w.writerow([a, b, 1.0])
(OUT / "config.json").write_text(json.dumps({
    "name": "Pakistan summer load-shedding (synthetic)",
    "lambdas": [1.0, 1.0, 1.0],
    "scales": "from_atc_baseline",
    "meta": {"data_note": __doc__.strip().split("\n\n")[1].replace("\n", " "),
             "units": "MW quantised to 0.5 MW", "horizon": "24 h, hourly"},
}, indent=2), encoding="utf-8")
print("peak demand", float(total.max()), "MW; peak allocation", float(alloc[np.argmax(total)]), "MW; shortfall hours",
      int((total > alloc).sum()))
