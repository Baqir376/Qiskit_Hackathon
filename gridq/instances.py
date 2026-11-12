"""Instance factories. Normalisation scales S1..S3 come from a baseline schedule (spec §5.4):
with scales taken from the AT&C (current-practice) schedule, J(current practice) = l1 + l2 + l3, so
J < that value means better than current practice on the weighted aggregate."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .classical import greedy_atc
from .model import Instance, load_instance

ROOT = Path(__file__).resolve().parents[1]


def pakistan_instance(scenario: str | None = None) -> Instance:
    """City X (Pakistan framing). `scenario` in {normal, reduced, severe, emergency} sets constant supply."""
    folder = ROOT / "data" / "pakistan"
    cfg = json.loads((folder / "config.json").read_text(encoding="utf-8"))
    inst = load_instance(folder)
    if scenario is not None:
        inst.P = np.full(inst.T, float(cfg["scenarios_mw"][scenario]))
        inst.R = np.full(inst.T, float(cfg["reserve_mw"]))
        inst.meta["scenario"] = scenario
    inst.x0 = (inst.avail[:, 0] == 1).astype(int)        # feeders ON before hour 1 where in service
    if cfg.get("scales") == "from_atc_baseline":
        inst.scales = (1.0, 1.0, 1.0)
        X = greedy_atc(inst)["X"]
        f = [inst.f1(X), inst.f2(X), inst.f3(X)]
        inst.scales = tuple(float(v) if v > 1e-12 else 1.0 for v in f)
        inst.meta["scales_source"] = "AT&C-loss-band greedy schedule"
    return inst
