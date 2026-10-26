"""Nigrani MCP server: an analyst copilot over the same service layer as the REST API.

Run: python -m nigrani.mcp_server   (stdio). Env: NIGRANI_DB, NIGRANI_MCP_ACTOR (audit-trail name).
Scores are model output, not findings of fact; every state change is written to the alert audit trail.
"""
from __future__ import annotations

import json
import os
from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from nigrani.service import InvalidTransition, NotFound, get_service

ACTOR = os.environ.get("NIGRANI_MCP_ACTOR", "mcp-analyst")
DEMO = os.environ.get("NIGRANI_DEMO", "").lower() in {"1", "true", "yes"}


def _writable() -> None:
    if DEMO: raise PermissionError("read-only public demo (NIGRANI_DEMO=1): write tools are disabled")
mcp = MCPServer("nigrani-surveillance", instructions=(
    "Trade-surveillance copilot. Start with list_alerts, then explain_alert, get_account_timeline and "
    "get_counterparty_network before drafting a note. Scores are model output, not findings of fact; never "
    "close an alert as true_positive without the analyst's confirmation."))


class _Guarded:
    """Proxy over the service: domain errors become ToolErrors so the model sees the real reason."""

    def __getattr__(self, name: str) -> Any:
        fn = getattr(get_service(), name)

        def call(*a: Any, **k: Any) -> Any:
            try:
                return fn(*a, **k)
            except NotFound as e:
                raise ToolError(f"not_found: {e}") from e
            except InvalidTransition as e:
                raise ToolError(f"invalid_transition: {e}") from e
            except ValueError as e:
                raise ToolError(f"bad_request: {e}") from e
        return call


def svc() -> Any: return _Guarded()


# ---------------------------------------------------------------- alerts
@mcp.tool()
def list_alerts(status: str | None = None, pattern: str | None = None, assignee: str | None = None, min_score: float | None = None,
                account: int | None = None, page: int = 1, page_size: int = 20) -> dict[str, Any]:
    """Alert queue with filters (status open|assigned|escalated|closed, pattern pump|network) and pagination, highest score first."""
    return svc().list_alerts(status=status, pattern=pattern, assignee=assignee, min_score=min_score, account=account, page=page, page_size=page_size)


@mcp.tool()
def get_alert(alert_id: str) -> dict[str, Any]:
    """Full alert record (status, assignee, disposition, audit trail) plus SHAP explanation. Id format YYYY-MM-DD:account."""
    return svc().get_alert(alert_id)


@mcp.tool()
def explain_alert(alert_id: str, top_k: int = 8) -> dict[str, Any]:
    """SHAP drivers for an account-day: score, threshold, top features with values and log-odds contributions."""
    return svc().explain_account_day(alert_id, top_k)


@mcp.tool()
def assign_alert(alert_id: str, assignee: str) -> dict[str, Any]:
    """Assign an open/assigned/escalated alert to an analyst."""
    _writable()
    return svc().assign(alert_id, assignee, ACTOR)


@mcp.tool()
def escalate_alert(alert_id: str, reason: str) -> dict[str, Any]:
    """Escalate an alert to compliance with a written reason (min 5 chars). Raises priority to high."""
    _writable()
    return svc().escalate(alert_id, reason, ACTOR)


@mcp.tool()
def close_alert(alert_id: str, disposition: str, note: str = "") -> dict[str, Any]:
    """Close an alert with disposition true_positive | false_positive | benign_explained. The disposition becomes a training label."""
    _writable()
    return svc().close(alert_id, disposition, ACTOR, note)


@mcp.tool()
def record_feedback(alert_id: str, verdict: str, note: str = "") -> dict[str, Any]:
    """Record an analyst verdict without closing (true_positive | false_positive | benign_explained | needs_more_info)."""
    _writable()
    return svc().record_feedback(alert_id, verdict, ACTOR, note)


@mcp.tool()
def draft_case_note(alert_id: str) -> str:
    """Draft an investigation note from SHAP drivers, network and timeline. A draft for human review, never a filed STR."""
    return svc().draft_case_note(alert_id)


@mcp.tool()
def queue_stats() -> dict[str, Any]:
    """Alert counts by status, dispositions, cases by status and realised analyst precision."""
    return svc().queue_stats()


# ---------------------------------------------------------------- investigation
@mcp.tool()
def get_account_timeline(account: int, end: str | None = None, days: int = 30) -> dict[str, Any]:
    """Daily risk score, traded value, alert status and top symbols for an account over its last `days` trading days up to `end`."""
    return svc().account_timeline(account, end, days)


@mcp.tool()
def get_counterparty_network(account: int, date: str, window: int = 5) -> dict[str, Any]:
    """Graph around an account-day: direct trades, same-side co-trading accounts over `window` days, and shared-KYC links."""
    return svc().counterparty_network(account, date, window)


@mcp.tool()
def get_linked_accounts(account: int) -> dict[str, Any]:
    """Accounts sharing address / phone / bank with this one, and its resolved entity."""
    return svc().linked_accounts(account)


@mcp.tool()
def get_account_trades(account: int, date: str, limit: int = 50) -> list[dict[str, Any]]:
    """Raw trades for one account on one date (YYYY-MM-DD)."""
    return svc().account_trades(account, date, limit)


# ---------------------------------------------------------------- cases
@mcp.tool()
def create_case(title: str, alert_ids: list[str], summary: str = "") -> dict[str, Any]:
    """Open an investigation case grouping one or more alerts."""
    _writable()
    return svc().create_case(title, alert_ids, ACTOR, summary=summary)


@mcp.tool()
def list_cases(status: str | None = None, page: int = 1, page_size: int = 20) -> dict[str, Any]:
    """Cases, newest first; status open | under_review | str_filed | closed_no_action."""
    return svc().list_cases(status=status, page=page, page_size=page_size)


@mcp.tool()
def get_case(case_id: int) -> dict[str, Any]:
    """One case with alerts and notes."""
    return svc().get_case(case_id)


@mcp.tool()
def add_case_note(case_id: int, body: str) -> dict[str, Any]:
    """Append a note to a case."""
    _writable()
    return svc().add_case_note(case_id, body, ACTOR)


@mcp.tool()
def update_case_status(case_id: int, status: str) -> dict[str, Any]:
    """Move a case to open | under_review | str_filed | closed_no_action (the last two are final)."""
    _writable()
    return svc().update_case(case_id, ACTOR, status=status)


# ---------------------------------------------------------------- model
@mcp.tool()
def score_account_day(features: dict[str, float]) -> dict[str, Any]:
    """Score one account-day from its feature vector (see model card for the feature list)."""
    return svc().score(features)


@mcp.tool()
def model_card() -> dict[str, Any]:
    """Production model version, CV and test metrics, alert budgets, label-noise and protocol notes."""
    return svc().model_card()


@mcp.tool()
def model_versions() -> dict[str, Any]:
    """Model registry: versions, creation time, git sha, artifact hash and which is in production."""
    return svc().model_versions()


@mcp.tool()
def drift_report(recent_days: int | None = None) -> dict[str, Any]:
    """Population stability (PSI) of each feature and the score, development period vs live period."""
    return svc().drift_report(recent_days)


@mcp.tool()
def sync_alerts(budget: str = "1.0%") -> dict[str, Any]:
    """Generate alerts from the production model's live-period scores at an alert budget (0.5% | 1.0% | 2.0%). Idempotent."""
    _writable()
    return svc().sync_alerts(budget)


# ---------------------------------------------------------------- resources + prompts
@mcp.resource("nigrani://model-card", mime_type="application/json", description="Production model card")
def model_card_resource() -> str: return json.dumps(svc().model_card(), default=str)


@mcp.resource("nigrani://alerts/{alert_id}", mime_type="application/json", description="One alert with explanation")
def alert_resource(alert_id: str) -> str: return json.dumps(svc().get_alert(alert_id), default=str)


@mcp.resource("nigrani://cases/{case_id}", mime_type="application/json", description="One case with notes")
def case_resource(case_id: str) -> str: return json.dumps(svc().get_case(int(case_id)), default=str)


@mcp.prompt(description="Step-by-step triage of one alert")
def triage_alert(alert_id: str) -> str:
    return (f"Triage surveillance alert {alert_id}. 1) get_alert and explain_alert: which features drive the score? "
            "2) get_account_timeline: is this a one-off or a build-up? 3) get_counterparty_network and get_linked_accounts: "
            "are there KYC-linked or co-trading accounts? 4) Classify the likely pattern (wash, circular, pump-and-dump, benign). "
            "5) draft_case_note and recommend assign / escalate / close with a disposition. Do not close without analyst approval.")


@mcp.prompt(description="Weekly surveillance summary for the compliance head")
def weekly_summary() -> str:
    return ("Write a weekly surveillance summary: use queue_stats, list_alerts(status='escalated'), list_cases and drift_report. "
            "Cover alert volume and realised precision, escalations, open cases, any drifting features (PSI > 0.1), and model version.")


if __name__ == "__main__":
    mcp.run()
