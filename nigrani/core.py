"""Shared scoring/explanation logic used by both FastAPI and the MCP server."""
import json
import os
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd
import shap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@lru_cache
def bundle():
    b = joblib.load(f"{ROOT}/artifacts/model.joblib"); b["explainer"] = shap.TreeExplainer(b["model"])
    # operate at the 1% alert budget chosen on validation (what an analyst team can actually review)
    b["threshold"] = float(model_card()["alert_budget"]["1.0%"]["threshold"]); return b
@lru_cache
def scored(): return pd.read_parquet(f"{ROOT}/artifacts/test_scored.parquet")
@lru_cache
def trades(): return pd.read_parquet(f"{ROOT}/data/trades.parquet")

def score(features: dict) -> dict:
    b = bundle(); x = np.array([[float(features[c]) for c in b["features"]]])
    p = float(b["model"].predict_proba(x)[0, 1])
    return {"score": round(p, 4), "alert": p >= b["threshold"], "threshold": round(b["threshold"], 4), "model": b["name"]}

def explain(features: dict, top_k: int = 5) -> dict:
    b = bundle(); x = np.array([[float(features[c]) for c in b["features"]]])
    sv = b["explainer"].shap_values(x); sv = sv[1] if isinstance(sv, list) else sv
    sv = sv[0, :, 1] if sv.ndim == 3 else sv[0]
    order = np.argsort(-np.abs(sv))[:top_k]
    return {**score(features), "top_reasons": [{"feature": b["features"][i], "value": round(float(x[0, i]), 4), "shap": round(float(sv[i]), 4)} for i in order]}

def list_alerts(limit: int = 20, min_score: float | None = None) -> list[dict]:
    s = scored(); thr = bundle()["threshold"] if min_score is None else min_score
    a = s[s.score >= thr].sort_values("score", ascending=False).head(limit)
    return [{"alert_id": f"{str(r.date)[:10]}:{int(r.account)}", "date": str(r.date)[:10], "account": int(r.account), "score": round(float(r.score), 4)} for r in a.itertuples()]

def _row(alert_id: str):
    d, a = alert_id.split(":"); s = scored(); r = s[(s.date == pd.Timestamp(d)) & (s.account == int(a))]
    if r.empty: raise KeyError(f"unknown alert_id {alert_id}")
    return r.iloc[0]

def explain_alert(alert_id: str) -> dict:
    r = _row(alert_id); return {"alert_id": alert_id, **explain({c: r[c] for c in bundle()["features"]})}

def account_trades(account: int, date: str, limit: int = 50) -> list[dict]:
    t = trades(); x = t[(t.account == account) & (t.date == pd.Timestamp(date))].head(limit)
    return [{"trade_id": int(r.trade_id), "symbol": r.symbol, "side": r.side, "qty": int(r.qty), "price": float(r.price), "counterparty": int(r.counterparty)} for r in x.itertuples()]

def counterparty_network(account: int, date: str) -> dict:
    t = trades(); x = t[(t.date == pd.Timestamp(date)) & (t.counterparty >= 0)]
    edges = x[(x.account == account) | (x.counterparty == account)].groupby(["account", "counterparty", "symbol"]).qty.sum().reset_index()
    return {"account": account, "date": date, "edges": [{"from": int(r.account), "to": int(r.counterparty), "symbol": r.symbol, "qty": int(r.qty)} for r in edges.itertuples()]}

def draft_case_note(alert_id: str) -> str:
    e = explain_alert(alert_id); d, a = alert_id.split(":")
    reasons = "\n".join(f"  - {r['feature']} = {r['value']} (SHAP {r['shap']:+})" for r in e["top_reasons"])
    return (f"DRAFT surveillance case note — for analyst review, not a filed report\nAlert: {alert_id}  Account: {a}  Date: {d}\n"
            f"Model: {e['model']}  Score: {e['score']} (threshold {e['threshold']})\nTop drivers:\n{reasons}\n"
            "Analyst to verify: beneficial ownership links, order-log intent, and whether a STR to FIU-IND is warranted.")

def model_card() -> dict: return json.load(open(f"{ROOT}/reports/metrics.json"))


def experiments(top: int = 20) -> list[dict]:
    d = json.load(open(f"{ROOT}/reports/experiments.json"))
    keep = ["experiment", "imbalance", "val_pr_auc", "test_pr_auc", "test_recall_at_1pct_alerts", "test_precision_at_100"]
    return [{k: e[k] for k in keep} for e in d["experiments"][:top]]

def drift_report(top: int = 10) -> dict:
    d = json.load(open(f"{ROOT}/reports/experiments.json"))["psi_train_vs_test"]
    items = list(d.items())[:top]
    return {"psi": dict(items), "rule": "PSI < 0.1 stable, 0.1-0.25 watch, > 0.25 investigate/retrain",
            "flagged": [k for k, v in items if v > 0.1]}

FEEDBACK = f"{ROOT}/artifacts/analyst_feedback.csv"
def record_feedback(alert_id: str, verdict: str, note: str = "") -> dict:
    if verdict not in {"true_positive", "false_positive", "needs_more_info"}: raise ValueError("verdict must be true_positive | false_positive | needs_more_info")
    _row(alert_id)
    new = not os.path.exists(FEEDBACK)
    with open(FEEDBACK, "a") as fh:
        if new: fh.write("alert_id,verdict,note\n")
        fh.write(f"{alert_id},{verdict},{note.replace(',', ';')}\n")
    n = sum(1 for _ in open(FEEDBACK)) - 1
    return {"saved": True, "feedback_rows": n, "used_for": "next retraining run (see feedback loop in experiments.py)"}
