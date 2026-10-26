"""Nigrani MCP server: lets Claude Desktop / Cursor act as a surveillance analyst's copilot.
Run: python -m nigrani.mcp_server  (stdio transport)"""
from mcp.server.mcpserver import MCPServer

from nigrani import core

mcp = MCPServer("nigrani-surveillance", instructions="Tools for reviewing trade-surveillance alerts. Scores are model output, not findings of fact.")

@mcp.tool()
def list_alerts(limit: int = 20) -> list[dict]:
    """Top surveillance alerts (account-days) above the model threshold, highest score first."""
    return core.list_alerts(limit)
@mcp.tool()
def explain_alert(alert_id: str) -> dict:
    """SHAP explanation for an alert id like '2026-06-01:123': score and top feature drivers."""
    return core.explain_alert(alert_id)
@mcp.tool()
def get_account_trades(account: int, date: str, limit: int = 50) -> list[dict]:
    """Raw trades for one account on one date (YYYY-MM-DD)."""
    return core.account_trades(account, date, limit)
@mcp.tool()
def get_counterparty_network(account: int, date: str) -> dict:
    """Internal counterparty edges touching the account that day — use to spot wash / circular rings."""
    return core.counterparty_network(account, date)
@mcp.tool()
def score_features(features: dict[str, float]) -> dict:
    """Score an arbitrary account-day feature vector and explain it."""
    return core.explain(features)
@mcp.tool()
def draft_case_note(alert_id: str) -> str:
    """Draft an analyst case note for an alert (draft only, human must review)."""
    return core.draft_case_note(alert_id)
@mcp.tool()
def get_model_card() -> dict:
    """Evaluation metrics, split, threshold and global SHAP importance of the deployed model."""
    return core.model_card()

@mcp.tool()
def list_experiments(top: int = 20) -> list[dict]:
    """Experiment log: every model / imbalance strategy tried, with validation and test metrics."""
    return core.experiments(top)
@mcp.tool()
def get_drift_report(top: int = 10) -> dict:
    """Population Stability Index of each feature, training period vs latest period."""
    return core.drift_report(top)
@mcp.tool()
def record_analyst_feedback(alert_id: str, verdict: str, note: str = "") -> dict:
    """Store the analyst's verdict on an alert (true_positive | false_positive | needs_more_info) for retraining."""
    return core.record_feedback(alert_id, verdict, note)

if __name__ == "__main__": mcp.run("stdio")
