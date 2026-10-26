from __future__ import annotations

import numpy as np
import pytest

from nigrani.service import InvalidTransition, NotFound, parse_alert_id, psi


def test_sync_is_idempotent(svc):
    n = svc.list_alerts()["total"]; assert n > 20
    assert svc.sync_alerts()["created"] == 0 and svc.list_alerts()["total"] == n


def test_alerts_respect_threshold_and_live_window(svc):
    items = svc.list_alerts(page_size=200)["items"]
    assert all(a["score"] >= svc.threshold - 1e-4 for a in items)
    assert all(a["date"] >= str(svc.live_start())[:10] for a in items)
    assert {a["pattern"] for a in items} <= {"pump", "network"} and {a["priority"] for a in items} <= {"high", "medium"}


def test_no_ground_truth_leaks(svc, alert_id):
    assert "label" not in svc.scored.columns and "typ" not in svc.scored.columns
    assert "label" not in str(svc.get_alert(alert_id)) and "typology" not in svc.trades.columns


def test_filters_sort_pagination(svc):
    p1, p2 = svc.list_alerts(page=1, page_size=5), svc.list_alerts(page=2, page_size=5)
    assert {a["alert_id"] for a in p1["items"]}.isdisjoint(a["alert_id"] for a in p2["items"])
    s = [a["score"] for a in p1["items"]]; assert s == sorted(s, reverse=True)
    asc = svc.list_alerts(sort="date", page_size=200)["items"]; assert [a["date"] for a in asc] == sorted(a["date"] for a in asc)
    acct = p1["items"][0]["account"]; assert all(a["account"] == acct for a in svc.list_alerts(account=acct)["items"])
    assert all(a["score"] >= .5 for a in svc.list_alerts(min_score=.5)["items"])
    d = p1["items"][0]["date"]; assert all(a["date"] == d for a in svc.list_alerts(date_from=d, date_to=d)["items"])
    assert all(a["pattern"] == "pump" for a in svc.list_alerts(pattern="pump")["items"])
    assert svc.list_alerts(priority="high")["total"] + svc.list_alerts(priority="medium")["total"] == p1["total"]
    for bad in ({"status": "nope"}, {"sort": "x"}, {"page": 0}, {"page_size": 999}):
        with pytest.raises(ValueError): svc.list_alerts(**bad)


def test_full_lifecycle_and_audit(svc, alert_id):
    assert svc.assign(alert_id, "ria", "lead")["status"] == "assigned"
    assert svc.list_alerts(assignee="ria")["total"] == 1
    with pytest.raises(ValueError): svc.escalate(alert_id, "no", "ria")
    e = svc.escalate(alert_id, "linked accounts co-trading", "ria"); assert e["status"] == "escalated" and e["priority"] == "high"
    with pytest.raises(InvalidTransition): svc.escalate(alert_id, "again please", "ria")
    with pytest.raises(ValueError): svc.close(alert_id, "maybe", "ria")
    c = svc.close(alert_id, "true_positive", "ria", "confirmed"); assert c["status"] == "closed" and c["closed_at"]
    with pytest.raises(InvalidTransition): svc.assign(alert_id, "x", "ria")
    assert svc.reopen(alert_id, "new info", "lead")["status"] == "assigned"
    with pytest.raises(InvalidTransition): svc.reopen(alert_id, "again", "lead")
    acts = [e["action"] for e in svc.get_alert(alert_id, False)["events"]]
    assert acts == ["created", "assign", "escalate", "close", "reopen"]
    assert svc.feedback_stats()["by_verdict"] == {"true_positive": 1}
    with pytest.raises(ValueError): svc.assign(alert_id, " ", "x")


def test_feedback_and_stats(svc, alert_id):
    svc.record_feedback(alert_id, "needs_more_info", "ria")
    assert svc.feedback_stats()["labelled_not_yet_trained_on"] == 0
    svc.close(alert_id, "false_positive", "ria")
    q = svc.queue_stats(); assert q["alerts_by_status"]["closed"] == 1 and q["analyst_precision"] == 0.0
    with pytest.raises(ValueError): svc.record_feedback(alert_id, "bogus", "ria")


def test_not_found(svc):
    for f in (lambda: svc.get_alert("2020-01-01:1"), lambda: svc.get_alert("garbage"), lambda: svc.get_case(999),
              lambda: svc.linked_accounts(10**9), lambda: svc.account_profile(10**9), lambda: svc.counterparty_network(1, "2020-01-01"),
              lambda: svc.explain_account_day("2020-01-01:1")):
        with pytest.raises(NotFound): f()
    with pytest.raises(NotFound): parse_alert_id("x")


def test_cases(svc, alert_id):
    other = svc.list_alerts(page=2, page_size=1)["items"][0]["alert_id"]
    c = svc.create_case("Pump ring", [alert_id], "ria", summary="s"); cid = c["case_id"]
    assert c["alert_ids"] == [alert_id] and len(c["notes"]) == 1 and svc.get_alert(alert_id, False)["case_id"] == cid
    assert svc.link_alert(cid, other, "ria")["alert_ids"] == sorted([alert_id, other]) or len(svc.get_case(cid)["alert_ids"]) == 2
    assert len(svc.add_case_note(cid, "checked KYC", "ria")["notes"]) == 2
    assert svc.update_case(cid, "ria", status="under_review", owner="lead")["owner"] == "lead"
    assert svc.list_cases(status="under_review")["total"] == 1 and svc.list_cases(owner="lead")["total"] == 1
    svc.update_case(cid, "ria", status="str_filed")
    with pytest.raises(InvalidTransition): svc.update_case(cid, "ria", status="open")
    with pytest.raises(ValueError): svc.update_case(cid, "ria", status="weird")
    with pytest.raises(ValueError): svc.create_case(" ", [], "ria")
    with pytest.raises(ValueError): svc.add_case_note(cid, " ", "ria")
    with pytest.raises(ValueError): svc.list_cases(page=0)
    assert "DRAFT case summary" in svc.draft_case_summary(cid)


def test_scoring_matches_stored_scores(svc):
    r = svc.scored[svc.scored.score > .9].iloc[0]
    out = svc.score({f: r[f] for f in svc.features}); assert abs(out["score"] - r.score) < 1e-3 and out["alert"]
    b = svc.score_batch([{f: r[f] for f in svc.features}] * 3); assert len(b) == 3
    assert svc.score_batch([]) == []
    with pytest.raises(ValueError): svc.score({"x": 1})
    with pytest.raises(ValueError): svc.score_batch([{}] * 5001)


def test_explanation_is_additive(svc, alert_id):
    e = svc.explain_account_day(alert_id, top_k=40)
    assert len(e["top_reasons"]) == len(svc.features)
    mags = [abs(r["shap"]) for r in e["top_reasons"]]; assert mags == sorted(mags, reverse=True)


def test_investigation_views(svc, alert_id):
    a = svc.get_alert(alert_id, False)
    tl = svc.account_timeline(a["account"], a["date"], 10); assert tl["days"][-1]["date"] == a["date"] and tl["days"][-1]["alert_status"] == "open"
    n = svc.counterparty_network(a["account"], a["date"]); ids = {x["id"] for x in n["nodes"]}
    assert a["account"] in ids and all(e["source"] in ids and e["target"] in ids for e in n["edges"]) and len(n["window_days"]) == 5
    assert sum(x["focus"] for x in n["nodes"]) == 1
    p = svc.account_profile(a["account"]); assert p["entity_id"] >= 0
    assert all(t["symbol"] for t in svc.account_trades(a["account"], a["date"]))
    note = svc.draft_case_note(alert_id); assert "DRAFT" in note and alert_id in note and "SHAP" in note


def test_network_shows_coordinated_pump(svc):
    pumps = svc.list_alerts(pattern="pump", page_size=200)["items"]
    assert any(svc.counterparty_network(a["account"], a["date"])["summary"]["co_trade"] > 0 for a in pumps[:10])


def test_linked_accounts_symmetry(svc):
    acc = svc.accounts; a = int(acc[acc.groupby("phone_id").account.transform("size") > 1].account.iloc[0])
    links = svc.linked_accounts(a)["linked"]; assert links
    b = links[0]["account"]; assert a in {x["account"] for x in svc.linked_accounts(b)["linked"]}


def test_psi():
    rng = np.random.default_rng(0); x = rng.normal(size=5000)
    assert psi(x, rng.normal(size=5000)) < .02 and psi(x, rng.normal(1, 1, 5000)) > .25 and psi(np.zeros(10), np.ones(10)) == 0


def test_drift_and_model_card(svc):
    d = svc.drift_report(); assert "score" in d["psi"] and d["reference"][1] < d["current"][0]
    assert svc.drift_report(recent_days=5)["current"][0] > d["current"][0]
    c = svc.model_card(); assert c["version"] == svc.version and c["test"]["selected"]["pr_auc"] > c["test"]["v2_baseline"]["pr_auc"]
    assert svc.model_versions()["production"] == svc.version
    r = svc.ready(); assert r["ready"]


def test_retrain_from_feedback_and_promote(svc):
    with pytest.raises(ValueError): svc.retrain("admin")
    items = svc.list_alerts(page_size=6)["items"]
    for a in items[:4]: svc.close(a["alert_id"], "true_positive", "ria")
    svc.close(items[4]["alert_id"], "false_positive", "ria")
    parent = svc.version; r = svc.retrain("admin")
    assert r["parent"] == parent and r["feedback_rows_used"] == 5 and 0 < r["candidate_pr_auc"] <= 1
    if r["promoted"]:
        assert svc.version == r["version"] and svc.feedback_stats()["labelled_not_yet_trained_on"] == 0
        assert svc.model_card()["retrain"]["parent"] == parent
    svc.promote(parent); assert svc.version == parent
    with pytest.raises(KeyError): svc.promote("v999")
