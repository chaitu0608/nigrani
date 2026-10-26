from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parent.parent


def test_mcp_stdio_end_to_end(tmp_path: Path):
    reg = tmp_path / "registry"; shutil.copytree(ROOT / "artifacts" / "registry", reg)
    env = {**os.environ, "NIGRANI_DB": f"sqlite:///{tmp_path / 'mcp.db'}", "NIGRANI_REGISTRY": str(reg), "NIGRANI_MCP_ACTOR": "copilot"}

    async def run() -> None:
        p = StdioServerParameters(command=sys.executable, args=["-m", "nigrani.mcp_server"], env=env, cwd=str(ROOT))
        async with stdio_client(p) as (r, w), ClientSession(r, w) as s:
            await s.initialize()
            names = {t.name for t in (await s.list_tools()).tools}
            assert {"list_alerts", "get_alert", "explain_alert", "assign_alert", "escalate_alert", "close_alert", "record_feedback",
                    "draft_case_note", "get_account_timeline", "get_counterparty_network", "get_linked_accounts", "create_case",
                    "list_cases", "get_case", "add_case_note", "update_case_status", "score_account_day", "model_card",
                    "model_versions", "drift_report", "sync_alerts", "queue_stats", "get_account_trades"} <= names

            async def call(n: str, a: dict | None = None):
                res = await s.call_tool(n, a or {}); assert not res.is_error, res.content[0].text
                return res.structured_content if res.structured_content else json.loads(res.content[0].text)

            assert (await call("sync_alerts"))["created"] > 0
            q = await call("list_alerts", {"page_size": 2}); aid = q["items"][0]["alert_id"]; acct = q["items"][0]["account"]
            assert (await call("explain_alert", {"alert_id": aid}))["top_reasons"]
            assert (await call("assign_alert", {"alert_id": aid, "assignee": "ria"}))["status"] == "assigned"
            assert (await call("escalate_alert", {"alert_id": aid, "reason": "co-trading ring"}))["status"] == "escalated"
            assert (await call("get_counterparty_network", {"account": acct, "date": aid[:10]}))["nodes"]
            assert (await call("get_account_timeline", {"account": acct, "days": 5}))["days"]
            note = await s.call_tool("draft_case_note", {"alert_id": aid}); assert "DRAFT" in note.content[0].text
            c = await call("create_case", {"title": "ring", "alert_ids": [aid]})
            assert len((await call("add_case_note", {"case_id": c["case_id"], "body": "x"}))["notes"]) == 2
            assert (await call("close_alert", {"alert_id": aid, "disposition": "true_positive"}))["status"] == "closed"
            ev = (await call("get_alert", {"alert_id": aid}))["events"]; assert ev[-1]["actor"] == "copilot"
            assert (await call("model_card"))["version"] and "psi" in await call("drift_report")
            bad = await s.call_tool("get_alert", {"alert_id": "2020-01-01:1"}); assert bad.is_error and "not_found" in bad.content[0].text

            uris = {str(x.uri) for x in (await s.list_resources()).resources}; assert "nigrani://model-card" in uris
            tmpl = {x.uri_template for x in (await s.list_resource_templates()).resource_templates}
            assert {"nigrani://alerts/{alert_id}", "nigrani://cases/{case_id}"} <= tmpl
            rr = await s.read_resource(f"nigrani://alerts/{aid}"); assert json.loads(rr.contents[0].text)["alert_id"] == aid
            assert json.loads((await s.read_resource(f"nigrani://cases/{c['case_id']}")).contents[0].text)["title"] == "ring"
            assert {x.name for x in (await s.list_prompts()).prompts} == {"triage_alert", "weekly_summary"}
            pr = await s.get_prompt("triage_alert", {"alert_id": aid}); assert aid in pr.messages[0].content.text

    asyncio.run(asyncio.wait_for(run(), 120))


def test_mcp_tools_in_process(svc, alert_id):
    """Every tool function against the shared service (complements the stdio test, and counts toward coverage)."""
    from nigrani import mcp_server as m
    a = svc.get_alert(alert_id, False); acct, d = a["account"], a["date"]
    assert m.list_alerts(page_size=3)["items"] and m.get_alert(alert_id)["alert_id"] == alert_id
    assert m.explain_alert(alert_id, 3)["top_reasons"] and m.queue_stats()["alerts_by_status"]
    assert m.assign_alert(alert_id, "ria")["status"] == "assigned" and m.escalate_alert(alert_id, "linked ring")["status"] == "escalated"
    assert m.record_feedback(alert_id, "needs_more_info")["saved"] and m.close_alert(alert_id, "false_positive")["status"] == "closed"
    assert "DRAFT" in m.draft_case_note(alert_id) and m.get_account_timeline(acct, d, 5)["days"]
    assert m.get_counterparty_network(acct, d)["nodes"] and "linked" in m.get_linked_accounts(acct)
    assert isinstance(m.get_account_trades(acct, d), list)
    c = m.create_case("ring", [alert_id]); cid = c["case_id"]
    assert m.list_cases()["total"] == 1 and m.get_case(cid)["title"] == "ring" and len(m.add_case_note(cid, "x")["notes"]) == 2
    assert m.update_case_status(cid, "under_review")["status"] == "under_review"
    r = svc.scored.iloc[0]; assert 0 <= m.score_account_day({f: float(r[f]) for f in svc.features})["score"] <= 1
    assert m.model_card()["version"] and m.model_versions()["production"] and "psi" in m.drift_report()
    assert m.sync_alerts()["created"] == 0
    assert json.loads(m.model_card_resource())["version"] and json.loads(m.alert_resource(alert_id))["alert_id"] == alert_id
    assert json.loads(m.case_resource(str(cid)))["case_id"] == cid
    assert alert_id in m.triage_alert(alert_id) and "drift_report" in m.weekly_summary()
