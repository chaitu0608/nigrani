# Real MCP session against `nigrani.mcp_server` (stdio)


## tools/list
- `list_alerts` — Top surveillance alerts (account-days) above the model threshold, highest score first.
- `explain_alert` — SHAP explanation for an alert id like '2026-06-01:123': score and top feature drivers.
- `get_account_trades` — Raw trades for one account on one date (YYYY-MM-DD).
- `get_counterparty_network` — Internal counterparty edges touching the account that day — use to spot wash / circular rings.
- `score_features` — Score an arbitrary account-day feature vector and explain it.
- `draft_case_note` — Draft an analyst case note for an alert (draft only, human must review).
- `get_model_card` — Evaluation metrics, split, threshold and global SHAP importance of the deployed model.
- `list_experiments` — Experiment log: every model / imbalance strategy tried, with validation and test metrics.
- `get_drift_report` — Population Stability Index of each feature, training period vs latest period.
- `record_analyst_feedback` — Store the analyst's verdict on an alert (true_positive | false_positive | needs_more_info) for retraining.

## tools/call `list_alerts` {"limit": 3}
```
{
  "alert_id": "2026-05-29:1734",
  "date": "2026-05-29",
  "account": 1734,
  "score": 0.9893
}
```

## tools/call `explain_alert` {"alert_id": "2026-05-29:1734"}
```
{
  "alert_id": "2026-05-29:1734",
  "score": 0.9893,
  "alert": true,
  "threshold": 0.5058,
  "model": "catboost",
  "top_reasons": [
    {
      "feature": "illiquid_share",
      "value": 1.0,
      "shap": 2.4611
    },
    {
      "feature": "buy_sell_balance",
      "value": 0.0,
      "shap": 2.2212
    },
    {
      "feature": "in_cycle",
      "value": 1.0,
      "shap": 1.3313
    },
    {
      "feature": "gross_value",
      "value": 614953.32,
      "shap": 0.9608
    },
    {
      "feature": "co_trader_overlap",
      "value": 11.0,
      "shap": 0.7444
    }
  ]
}
```

## tools/call `get_counterparty_network` {"account": 1734, "date": "2026-05-29"}
```
{
  "account": 1734,
  "date": "2026-05-29",
  "edges": [
    {
      "from": 1436,
      "to": 1734,
      "symbol": "SYM032",
      "qty": 222
    },
    {
      "from": 1734,
      "to": 1436,
      "symbol": "SYM032",
      "qty": 222
    },
    {
      "from": 1734,
      "to": 1859,
      "symbol": "SYM032",
      "qty": 222
    },
    {
      "from": 1859,
      "to": 1734,
      "symbol": "SYM032",
      "qty": 222
    }
  ]
}
```

## tools/call `draft_case_note` {"alert_id": "2026-05-29:1734"}
```
DRAFT surveillance case note — for analyst review, not a filed report
Alert: 2026-05-29:1734  Account: 1734  Date: 2026-05-29
Model: catboost  Score: 0.9893 (threshold 0.5058)
Top drivers:
  - illiquid_share = 1.0 (SHAP +2.4611)
  - buy_sell_balance = 0.0 (SHAP +2.2212)
  - in_cycle = 1.0 (SHAP +1.3313)
  - gross_value = 614953.32 (SHAP +0.9608)
  - co_trader_overlap = 11.0 (SHAP +0.7444)
Analyst to verify: beneficial ownership links, order-log intent, and whether a STR to FIU-IND is warranted.
```

## tools/call `get_drift_report` {"top": 3}
```
{
  "psi": {
    "value_z_vs_own_history": 0.2552,
    "crowd_5d": 0.0116,
    "co_trader_overlap": 0.0025
  },
  "rule": "PSI < 0.1 stable, 0.1-0.25 watch, > 0.25 investigate/retrain",
  "flagged": [
    "value_z_vs_own_history"
  ]
}
```