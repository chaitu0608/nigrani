"""Gap study: can we lift recall on the *subtle* pump-and-dump typology without hurting the rest?

Variants are scored with the same 4-fold expanding CV as `nigrani.train` (selection on CV only); the untouched
test block is read once at the end for the CV winner and the production baseline. Output: reports/pump_experiments.json.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from nigrani.features import FEATURES
from nigrani.models import PUMP_TYPES, PatternHeads
from nigrani.train import evaluate, split

ROOT = Path(__file__).resolve().parent.parent
SEQ = ["impact_per_vol", "impact_5d", "ret_5d_mean", "sync_5d_max", "coord_5d_max", "streak_5d_max", "active_days_5d",
       "impact_lag1", "buy_bal_5d", "peer_day_sync"]


def add_sequence_features(f: pd.DataFrame) -> pd.DataFrame:
    """Multi-day sequence, price-impact-per-volume and coordinated-timing features. Past-and-today only."""
    f = f.sort_values(["account", "date"]).copy(); g = f.groupby("account")
    r = lambda c, fn: g[c].transform(lambda s: getattr(s.rolling(5, min_periods=1), fn)())  # noqa: E731
    f["impact_per_vol"] = f.impact_bps / (f.sym_day_volume_share + 1e-3)
    f["impact_5d"] = r("impact_bps", "sum"); f["ret_5d_mean"] = r("mkt_ret_3d", "mean")
    f["sync_5d_max"] = r("sync_peers_5d", "max"); f["coord_5d_max"] = r("coord_entry", "max"); f["streak_5d_max"] = r("streak_days", "max")
    f["active_days_5d"] = r("n_trades", "count"); f["impact_lag1"] = g.impact_bps.shift(1).fillna(0); f["buy_bal_5d"] = r("buy_sell_balance", "mean")
    # coordinated timing: how many accounts share today's (high co-trader overlap & positive impact) signature
    sig = (f.co_trader_overlap > f.co_trader_overlap.quantile(.9)) & (f.impact_bps > 0)
    f["peer_day_sync"] = sig.groupby(f.date).transform("sum") * sig
    return f.sort_values(["date", "account"]).reset_index(drop=True)


class WeightedHeads(PatternHeads):
    """Cost-sensitive pattern heads: confirmed pump positives get `w` times the loss weight."""
    kind = "pattern_heads_weighted"

    def __init__(self, features, algo="catboost", seed=0, w=3.0):
        super().__init__(features, algo, seed); self.w = w

    def fit(self, df, y):
        typ = df["typ"].to_numpy(); x = df[self.features].to_numpy(float); self.heads = {}
        for name, types in [("network", {"wash", "circular"}), ("pump", PUMP_TYPES)]:
            yy = ((y == 1) & np.isin(typ, list(types))).astype(int)
            sw = np.where(yy == 1, self.w if name == "pump" else 1.0, 1.0)
            self.heads[name] = self._new(yy).fit(x, yy, sample_weight=sw)
        return self


def reserved_budget(m: PatternHeads, df: pd.DataFrame, share: float, budget: float = .01) -> np.ndarray:
    """Per-pattern alert budget: `share` of the 1% queue goes to the pump head's top scores, the rest to the combined score."""
    h = m.head_scores(df); comb = 1 - (1 - h["network"]) * (1 - h["pump"]); k = max(1, int(len(df) * budget)); kp = int(round(k * share))
    s = comb.copy()
    if kp:
        top_p = np.argsort(-h["pump"])[:kp]; s[top_p] = 2 + h["pump"][top_p]  # guaranteed slots for the pump queue
    return s


def run() -> dict:
    f = add_sequence_features(pd.read_parquet(ROOT / "data" / "features.parquet"))
    dev, test, folds = split(f)
    variants = {
        "baseline_pattern_heads": (lambda: PatternHeads(FEATURES), 0.0),
        "+sequence_features": (lambda: PatternHeads(FEATURES + SEQ), 0.0),
        "+seq +cost_sensitive_w3": (lambda: WeightedHeads(FEATURES + SEQ, w=3.0), 0.0),
        "+seq +cost_sensitive_w6": (lambda: WeightedHeads(FEATURES + SEQ, w=6.0), 0.0),
        "+seq +pump_budget_25pct": (lambda: PatternHeads(FEATURES + SEQ), .25),
        "+seq +pump_budget_40pct": (lambda: PatternHeads(FEATURES + SEQ), .40),
        "+seq +w3 +pump_budget_25pct": (lambda: WeightedHeads(FEATURES + SEQ, w=3.0), .25),
    }
    def score(mk, share, tr, va):
        m = mk().fit(tr, tr.label_noisy.to_numpy())
        s = reserved_budget(m, va, share) if share else m.predict_proba(va)
        return evaluate(va.label.to_numpy(), s, va.typ.to_numpy())
    cv = {}
    for name, (mk, share) in variants.items():
        per = [score(mk, share, dev[dev.date.isin(a)], dev[dev.date.isin(b)]) for a, b in folds]
        cv[name] = {k: round(float(np.mean([p[k] for p in per])), 4) for k in ("pr_auc", "recall_at_1pct", "precision_at_100")}
        cv[name]["subtle_recall_at_1pct"] = round(float(np.mean([p["recall_at_1pct_by_type"].get("pump_dump_subtle", np.nan) for p in per])), 4)
        cv[name]["pump_recall_at_1pct"] = round(float(np.mean([p["recall_at_1pct_by_type"].get("pump_dump", np.nan) for p in per])), 4)
        print(name, cv[name], flush=True)
    base = cv["baseline_pattern_heads"]
    # selection rule (CV only): best subtle recall whose overall R@1% does not drop more than 1 point
    ok = {k: v for k, v in cv.items() if v["recall_at_1pct"] >= base["recall_at_1pct"] - .01}
    win = max(ok, key=lambda k: (ok[k]["subtle_recall_at_1pct"], ok[k]["pr_auc"]))
    cut = np.sort(dev.date.unique())[-EMB:] if (EMB := 5) else None
    tr = dev[~dev.date.isin(cut)]; out_test = {}
    for name in dict.fromkeys(["baseline_pattern_heads", win]):
        mk, share = variants[name]; r = score(mk, share, tr, test)
        out_test[name] = {k: r[k] for k in ("pr_auc", "recall_at_1pct", "precision_at_100")} | {"by_type": r["recall_at_1pct_by_type"]}
    res = {"cv_mean_4_folds": cv, "selection_rule": "max CV subtle recall@1% s.t. overall recall@1% >= baseline - 0.01", "cv_winner": win,
           "test_read_once": out_test, "new_features": SEQ}
    (ROOT / "reports" / "pump_experiments.json").write_text(json.dumps(res, indent=2)); print(json.dumps(out_test, indent=1)); return res


if __name__ == "__main__":
    run()
