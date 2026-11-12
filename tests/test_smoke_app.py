"""Smoke / integration test of the Streamlit dashboard (headless) and the noise pipeline inputs."""
import json
from pathlib import Path

import pytest


def test_streamlit_app_renders_and_runs_live():
    from streamlit.testing.v1 import AppTest
    at = AppTest.from_file(str(Path(__file__).resolve().parents[1] / "app.py"), default_timeout=180).run()
    assert not at.exception
    at.button[0].click().run()          # "Run QAOA live"
    assert not at.exception
    labels = [m.label for m in at.metric]
    assert "P(optimal plan)" in labels and "feasible probability" in labels


def test_noise_study_artifact_is_consistent():
    nz = json.loads(Path("results/noise_study.json").read_text())
    assert nz["backend"] == "FakeTorino"
    for r in nz["rows"]:
        assert 0 <= r["noisy_p_opt"] <= r["ideal_p_opt"] + 1e-9     # noise must not create advantage
        assert r["two_qubit_gates"] > 0


@pytest.mark.parametrize("path", ["data/sindh_2022.json", "results/results.json", "web/public/data/flood.json"])
def test_json_artifacts_parse(path):
    json.loads(Path(path).read_text(encoding="utf-8"))
