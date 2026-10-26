import asyncio
import sys

from fastapi.testclient import TestClient

from nigrani import core
from nigrani.api import app
from nigrani.features import FEATURES

c = TestClient(app)

def test_health(): assert c.get("/health").json()["ok"]
def test_alerts_and_explain():
    a = c.get("/alerts?limit=3").json(); assert a and a[0]["score"] >= a[-1]["score"]
    e = c.get(f"/alerts/{a[0]['alert_id']}").json(); assert e["alert"] and len(e["top_reasons"]) == 5
def test_score_validation(): assert c.post("/score", json={"features": {"n_trades": 1}}).status_code == 422
def test_score_roundtrip():
    r = core.scored().iloc[0]; out = c.post("/score", json={"features": {k: float(r[k]) for k in FEATURES}}).json()
    assert abs(out["score"] - r.score) < 1e-3
def test_unknown_alert(): assert c.get("/alerts/2020-01-01:1").status_code == 404
def test_metrics_beat_baseline():
    m = core.model_card()["models"]; assert m[core.model_card()["selected_model"]]["test"]["pr_auc"] > 5 * m["baseline_prior"]["test"]["pr_auc"]

def test_mcp_stdio_end_to_end():
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    async def run():
        p = StdioServerParameters(command=sys.executable, args=["-m", "nigrani.mcp_server"])
        async with stdio_client(p) as (r, w):
            async with ClientSession(r, w) as s:
                await s.initialize(); names = {t.name for t in (await s.list_tools()).tools}
                assert {"list_alerts", "explain_alert", "draft_case_note", "get_counterparty_network"} <= names
                res = await s.call_tool("list_alerts", {"limit": 2}); txt = res.content[0].text
                assert "alert_id" in txt
    asyncio.run(run())

def test_dashboard(): assert "Nigrani" in c.get("/dashboard").text
def test_graph_features_add_value():
    m = core.model_card()["models"]
    assert m["lightgbm_spw"]["test"]["pr_auc"] > m["ablation_lightgbm_no_graph_features"]["test"]["pr_auc"]

def test_feedback_and_drift(tmp_path, monkeypatch):
    monkeypatch.setattr(core, "FEEDBACK", str(tmp_path / "fb.csv"))
    a = core.list_alerts(1)[0]["alert_id"]; assert core.record_feedback(a, "true_positive")["feedback_rows"] == 1
    import pytest
    with pytest.raises(ValueError): core.record_feedback(a, "maybe")
    assert "psi" in core.drift_report() and core.experiments(3)
def test_threshold_is_alert_budget():
    assert abs(core.bundle()["threshold"] - core.model_card()["alert_budget"]["1.0%"]["threshold"]) < 1e-9
