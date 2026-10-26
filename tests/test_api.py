from __future__ import annotations

import pytest

from tests.conftest import ADMIN, ANALYST


def feats(svc, hi=True):
    r = svc.scored[svc.scored.score > .9].iloc[0] if hi else svc.scored.iloc[0]; return {f: float(r[f]) for f in svc.features}


def test_public_ops(client):
    assert client.get("/health").json()["status"] == "ok"
    r = client.get("/ready"); assert r.status_code == 200 and r.json()["ready"]
    assert "Nigrani" in client.get("/dashboard").text and "Nigrani" in client.get("/").text
    assert client.get("/dashboard/queue/2026-06-08:452").status_code == 200 and "Nigrani" in client.get("/dashboard/legacy").text
    client.get("/v1/alerts", headers=ANALYST)
    m = client.get("/metrics").text
    assert "nigrani_http_requests_total" in m and 'nigrani_alerts{status="open"}' in m and "nigrani_model_info" in m and "_bucket" in m


def test_ready_503_without_model(client, monkeypatch, svc):
    monkeypatch.setattr(type(svc), "ready", lambda self: {"model": "error: none", "ready": False})
    assert client.get("/ready").status_code == 503


@pytest.mark.parametrize("method,path", [("get", "/v1/alerts"), ("get", "/v1/model/card"), ("post", "/v1/score"), ("get", "/v1/cases")])
def test_auth_required(client, method, path):
    r = getattr(client, method)(path); assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"
    assert getattr(client, method)(path, headers={"X-API-Key": "wrong"}).status_code == 401


def test_admin_only(client):
    for p, body in [("/v1/alerts/sync", {}), ("/v1/model/promote", {"version": "v1"}), ("/v1/model/retrain", {})]:
        assert client.post(p, json=body, headers=ANALYST).status_code == 403
    assert client.post("/v1/alerts/sync", json={"budget": "2.0%"}, headers=ADMIN).json()["created"] > 0
    assert client.post("/v1/alerts/sync", json={"budget": "7%"}, headers=ADMIN).status_code == 422


def test_custom_keys(client, monkeypatch):
    monkeypatch.setenv("NIGRANI_API_KEYS", "k1=priya:analyst")
    assert client.get("/v1/me", headers={"X-API-Key": "k1"}).json() == {"user": "priya", "role": "analyst"}
    assert client.get("/v1/me", headers=ANALYST).status_code == 401


def test_request_id_and_error_envelope(client):
    r = client.get("/v1/alerts/2020-01-01:1", headers={**ANALYST, "X-Request-ID": "abc123"})
    assert r.status_code == 404 and r.headers["x-request-id"] == "abc123" and r.json()["error"]["request_id"] == "abc123"
    assert client.get("/v1/alerts?page_size=999", headers=ANALYST).json()["error"]["code"] == "validation_error"
    assert client.get("/v1/alerts?sort=bad", headers=ANALYST).json()["error"]["code"] == "invalid_request"


def test_score_explain_batch(client, svc):
    r = client.post("/v1/score", json={"features": feats(svc)}, headers=ANALYST).json(); assert r["alert"] and r["model_version"] == svc.version
    e = client.post("/v1/explain?top_k=3", json={"features": feats(svc)}, headers=ANALYST).json(); assert len(e["top_reasons"]) == 3
    b = client.post("/v1/score/batch", json={"rows": [feats(svc), feats(svc, False)]}, headers=ANALYST).json()
    assert b["n"] == 2 and b["n_alerts"] >= 1
    assert client.post("/v1/score", json={"features": {"x": 1}}, headers=ANALYST).status_code == 422
    assert client.post("/v1/score/batch", json={"rows": []}, headers=ANALYST).status_code == 422


def test_alert_queue_and_detail(client, alert_id):
    q = client.get("/v1/alerts?page=1&page_size=5&status=open&min_score=0.05", headers=ANALYST).json()
    assert len(q["items"]) == 5 and q["total"] > 5
    d = client.get(f"/v1/alerts/{alert_id}", headers=ANALYST).json(); assert d["events"][0]["action"] == "created" and d["explanation"]["top_reasons"]
    assert client.get("/v1/alerts/stats", headers=ANALYST).json()["alerts_by_status"]["open"] == q["total"]


def test_lifecycle_endpoints(client, alert_id):
    u = f"/v1/alerts/{alert_id}"
    assert client.post(u + "/assign", json={"assignee": "ria"}, headers=ANALYST).json()["assignee"] == "ria"
    assert client.post(u + "/escalate", json={"reason": "abc"}, headers=ANALYST).status_code == 422
    assert client.post(u + "/escalate", json={"reason": "linked pump ring"}, headers=ANALYST).json()["status"] == "escalated"
    assert client.post(u + "/feedback", json={"verdict": "needs_more_info"}, headers=ANALYST).json()["saved"]
    assert client.post(u + "/close", json={"disposition": "true_positive", "note": "ok"}, headers=ANALYST).json()["status"] == "closed"
    r = client.post(u + "/close", json={"disposition": "true_positive"}, headers=ANALYST); assert r.status_code == 409
    assert r.json()["error"]["code"] == "invalid_transition"
    assert client.post(u + "/reopen", json={"reason": "new evidence"}, headers=ANALYST).json()["status"] == "assigned"
    ev = client.get(u, headers=ANALYST).json()["events"]; assert all(e["actor"] == "analyst1" for e in ev[1:])
    assert client.get("/v1/feedback/stats", headers=ANALYST).json()["by_verdict"]["true_positive"] == 1
    assert "DRAFT" in client.get(u + "/case-note-draft", headers=ANALYST).json()["draft"]
    assert client.get(u + "/network?window=3", headers=ANALYST).json()["window_days"].__len__() == 3


def test_account_endpoints(client, svc, alert_id):
    a = svc.get_alert(alert_id, False); acct, d = a["account"], a["date"]
    assert client.get(f"/v1/accounts/{acct}", headers=ANALYST).json()["account"] == acct
    assert "linked" in client.get(f"/v1/accounts/{acct}/linked", headers=ANALYST).json()
    assert client.get(f"/v1/accounts/{acct}/timeline?end={d}&days=7", headers=ANALYST).json()["days"][-1]["date"] == d
    assert client.get(f"/v1/accounts/{acct}/network?date={d}", headers=ANALYST).json()["nodes"]
    assert isinstance(client.get(f"/v1/accounts/{acct}/trades?date={d}", headers=ANALYST).json(), list)
    assert client.get("/v1/accounts/99999999", headers=ANALYST).status_code == 404
    assert client.get(f"/v1/accounts/{acct}/network", headers=ANALYST).status_code == 422


def test_case_endpoints(client, alert_id, svc):
    other = svc.list_alerts(page=2, page_size=1)["items"][0]["alert_id"]
    r = client.post("/v1/cases", json={"title": "Pump ring SYM1", "alert_ids": [alert_id]}, headers=ANALYST); assert r.status_code == 201
    cid = r.json()["case_id"]
    assert client.post("/v1/cases", json={"title": "x", "alert_ids": []}, headers=ANALYST).status_code == 422
    assert client.post("/v1/cases", json={"title": "abc", "alert_ids": ["2020-01-01:1"]}, headers=ANALYST).status_code == 404
    assert len(client.post(f"/v1/cases/{cid}/alerts", json={"alert_id": other}, headers=ANALYST).json()["alert_ids"]) == 2
    assert len(client.post(f"/v1/cases/{cid}/notes", json={"body": "KYC checked"}, headers=ANALYST).json()["notes"]) == 2
    assert client.patch(f"/v1/cases/{cid}", json={"status": "under_review"}, headers=ANALYST).json()["status"] == "under_review"
    assert client.patch(f"/v1/cases/{cid}", json={"status": "bogus"}, headers=ANALYST).status_code == 422
    assert client.get("/v1/cases?status=under_review", headers=ANALYST).json()["total"] == 1
    assert client.get(f"/v1/cases/{cid}", headers=ANALYST).json()["title"] == "Pump ring SYM1"
    assert "DRAFT" in client.get(f"/v1/cases/{cid}/summary-draft", headers=ANALYST).json()["draft"]
    assert client.get("/v1/cases/9999", headers=ANALYST).status_code == 404


def test_model_endpoints(client, svc):
    assert client.get("/v1/model/card", headers=ANALYST).json()["version"] == svc.version
    assert client.get("/v1/model/versions", headers=ANALYST).json()["production"] == svc.version
    assert "psi" in client.get("/v1/monitoring/drift?recent_days=5", headers=ANALYST).json()
    assert client.post("/v1/model/promote", json={"version": "v999"}, headers=ADMIN).status_code == 404
    assert client.post("/v1/model/promote", json={"version": svc.version}, headers=ADMIN).json()["production"] == svc.version
    assert client.post("/v1/model/retrain", json={}, headers=ADMIN).status_code == 422  # no labelled feedback yet


def test_retrain_endpoint(client, svc):
    parent = svc.version
    for a in svc.list_alerts(page_size=3)["items"]:
        client.post(f"/v1/alerts/{a['alert_id']}/close", json={"disposition": "true_positive"}, headers=ANALYST)
    r = client.post("/v1/model/retrain", json={"promote": False}, headers=ADMIN).json()
    assert r["promoted"] is False and r["parent"] == parent and svc.version == parent
    assert r["version"] in {v["version"] for v in client.get("/v1/model/versions", headers=ANALYST).json()["versions"]}


def test_unhandled_error_is_500_envelope(client, svc, monkeypatch):
    monkeypatch.setattr(type(svc), "queue_stats", lambda self: 1 / 0)
    r = client.get("/v1/alerts/stats", headers=ANALYST); assert r.status_code == 500 and r.json()["error"]["code"] == "internal_error"
