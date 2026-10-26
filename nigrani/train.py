"""v3 training: expanding-window time-series CV for model selection, a single untouched test read,
alert-budget thresholds from a held-out calibration block, and a versioned registry entry.

Protocol (no test peeking):
  dates  = [ ---------------- development (85%) ---------------- | test (15%) ]
  CV     = 4 expanding folds inside development, 5-trading-day embargo before each validation block
  select = highest mean CV PR-AUC among eligible candidates (ablations are not eligible)
  deploy = refit on development minus the last block; thresholds = score quantiles on the last block
  test   = scored once for the selected model and the v2 baseline, reported, never used for decisions
"""
from __future__ import annotations

import json
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import matplotlib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, precision_recall_curve, roc_auc_score

from nigrani import registry
from nigrani.features import BASE_FEATURES, FEATURES, MARKET_FEATURES
from nigrani.models import PatternHeads, Scorer, TwoStage

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ENTITY = ["entity_size", "entity_peers_same_side", "entity_peers_5d"]
SYNC_MKT = [c for c in MARKET_FEATURES if c not in ENTITY]
BUDGETS = (.005, .01, .02)
EMBARGO = 5

CANDIDATES: dict[str, tuple[Callable[[], Scorer], bool]] = {  # name -> (factory, eligible for selection)
    "v2_catboost_base17": (lambda: Scorer(BASE_FEATURES, "catboost"), True),
    "lgbm_base17": (lambda: Scorer(BASE_FEATURES, "lgbm"), True),
    "catboost_v3": (lambda: Scorer(FEATURES, "catboost"), True),
    "lgbm_v3": (lambda: Scorer(FEATURES, "lgbm"), True),
    "pattern_heads_catboost_v3": (lambda: PatternHeads(FEATURES, "catboost"), True),
    "two_stage_v3": (lambda: TwoStage(FEATURES), True),
    "ablation_v3_no_entity": (lambda: Scorer([c for c in FEATURES if c not in ENTITY], "catboost"), False),
    "ablation_v3_no_market_sync": (lambda: Scorer([c for c in FEATURES if c not in SYNC_MKT], "catboost"), False),
}


def recall_at_rate(y: np.ndarray, s: np.ndarray, rate: float = .01) -> float:
    k = max(1, int(len(s) * rate)); return float(y[np.argsort(-s)[:k]].sum() / max(1, y.sum()))


def evaluate(y: np.ndarray, s: np.ndarray, typ: np.ndarray | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"pr_auc": round(float(average_precision_score(y, s)), 4), "roc_auc": round(float(roc_auc_score(y, s)), 4),
                           "recall_at_1pct": round(recall_at_rate(y, s), 4), "precision_at_100": round(float(y[np.argsort(-s)[:100]].mean()), 4),
                           "positives": int(y.sum()), "rows": len(y)}
    if typ is not None:
        k = max(1, int(len(s) * .01)); top = np.zeros(len(s), bool); top[np.argsort(-s)[:k]] = True
        out["recall_at_1pct_by_type"] = {t: round(float(top[(y == 1) & (typ == t)].mean()), 4) for t in sorted(set(typ[y == 1]))}
    return out


def split(f: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, list[tuple[np.ndarray, np.ndarray]]]:
    dates = np.sort(f.date.unique()); test_start = dates[int(.85 * len(dates))]
    dev_dates = dates[dates < test_start]; n = len(dev_dates); first = int(.5 * n); block = (n - first) // 4
    folds = []
    for k in range(4):
        v = dev_dates[first + k * block: (first + (k + 1) * block) if k < 3 else n]
        tr = dev_dates[: first + k * block - EMBARGO]
        folds.append((tr, v))
    return f[f.date < test_start], f[f.date >= test_start], folds


def _agg(folds: list[dict[str, Any]]) -> dict[str, Any]:
    out = {}
    for m in ("pr_auc", "roc_auc", "recall_at_1pct", "precision_at_100"):
        v = [x[m] for x in folds]; out[m] = round(float(np.mean(v)), 4); out[m + "_std"] = round(float(np.std(v)), 4)
    types = sorted({t for x in folds for t in x.get("recall_at_1pct_by_type", {})})
    out["recall_at_1pct_by_type"] = {t: round(float(np.nanmean([x["recall_at_1pct_by_type"].get(t, np.nan) for x in folds])), 4) for t in types}
    return out


def cross_validate(dev: pd.DataFrame, folds: list[tuple[np.ndarray, np.ndarray]], names: list[str] | None = None) -> dict[str, Any]:
    res: dict[str, Any] = {}
    for name in names or list(CANDIDATES):
        t0 = time.time(); per = []
        for tr_d, va_d in folds:
            tr, va = dev[dev.date.isin(tr_d)], dev[dev.date.isin(va_d)]
            m = CANDIDATES[name][0]().fit(tr, tr.label_noisy.to_numpy())
            per.append(evaluate(va.label.to_numpy(), m.predict_proba(va), va.typ.to_numpy()))
        res[name] = {"eligible": CANDIDATES[name][1], "folds": per, "cv": _agg(per), "seconds": round(time.time() - t0, 1)}
        print(f"{name:32s} CV PR-AUC {res[name]['cv']['pr_auc']:.4f} ± {res[name]['cv']['pr_auc_std']:.4f}  R@1% {res[name]['cv']['recall_at_1pct']:.3f}", flush=True)
    return res


def fit_deployable(name: str, dev: pd.DataFrame, folds: list[tuple[np.ndarray, np.ndarray]],
                   label_overrides: pd.DataFrame | None = None) -> tuple[Scorer, dict[str, float], pd.DataFrame]:
    """Refit `name` on development minus the last CV block; return model, budget thresholds, calibration block."""
    cal_dates = folds[-1][1]; fit_dates = np.sort(dev.date.unique()); fit_dates = fit_dates[fit_dates < cal_dates[0]][:-EMBARGO]
    tr = apply_overrides(dev[dev.date.isin(fit_dates)], label_overrides); cal = dev[dev.date.isin(cal_dates)]
    m = CANDIDATES[name][0]().fit(tr, tr.label_noisy.to_numpy()); s = m.predict_proba(cal)
    thr = {f"{b:.1%}": float(np.quantile(s, 1 - b)) for b in BUDGETS}
    return m, thr, cal.assign(score=s)


def apply_overrides(df: pd.DataFrame, overrides: pd.DataFrame | None) -> pd.DataFrame:
    """Analyst dispositions replace the noisy training label for the account-days they reviewed."""
    if overrides is None or overrides.empty: return df
    o = overrides[["date", "account", "label"]].rename(columns={"label": "fb_label"}).drop_duplicates(["date", "account"], keep="last")
    o["date"] = pd.to_datetime(o.date)
    d = df.merge(o, on=["date", "account"], how="left")
    d["label_noisy"] = d.fb_label.fillna(d.label_noisy).astype(int); return d.drop(columns="fb_label").set_index(df.index)


def budget_table(y: np.ndarray, s: np.ndarray, thr: dict[str, float]) -> dict[str, Any]:
    out = {}
    for k, t in thr.items():
        p = s >= t; out[k] = {"threshold": round(t, 4), "alerts": int(p.sum()), "precision": round(float(y[p].mean()) if p.any() else 0.0, 4),
                              "recall": round(float(y[p].sum() / max(1, y.sum())), 4)}
    return out


def episodes(trades: pd.DataFrame) -> pd.DataFrame:
    """Group manipulative trades into episodes: same typology + symbol, trading days at most 2 apart."""
    m = trades[trades.label == 1][["date", "account", "symbol", "typology"]].drop_duplicates().sort_values(["typology", "symbol", "date"])
    days = {d: i for i, d in enumerate(np.sort(trades.date.unique()))}; m["di"] = m.date.map(days)
    new = (m.typology != m.typology.shift()) | (m.symbol != m.symbol.shift()) | (m.di - m.di.shift() > 2)
    return m.assign(episode=new.cumsum())


def episode_recall(ep: pd.DataFrame, scored: pd.DataFrame, thr: float) -> dict[str, Any]:
    """Share of manipulation episodes in the scored period with at least one alerted account-day (case-level recall)."""
    hit = scored[scored.score >= thr][["date", "account"]].assign(hit=1)
    e = ep[ep.date.isin(scored.date.unique())].merge(hit, on=["date", "account"], how="left").fillna({"hit": 0})
    g = e.groupby(["typology", "episode"]).hit.max().reset_index()
    return {t: {"episodes": len(x), "detected": int(x.hit.sum()), "recall": round(float(x.hit.mean()), 4)} for t, x in g.groupby("typology")}


def main() -> None:
    f = pd.read_parquet(ROOT / "data" / "features.parquet")
    dev, test, folds = split(f)
    cv = cross_validate(dev, folds)
    best = max((n for n in cv if cv[n]["eligible"]), key=lambda n: cv[n]["cv"]["pr_auc"])
    print("selected by CV:", best)
    model, thr, cal = fit_deployable(best, dev, folds)
    base, base_thr, _ = fit_deployable("v2_catboost_base17", dev, folds)
    yt, tt = test.label.to_numpy(), test.typ.to_numpy()
    st, sb = model.predict_proba(test), base.predict_proba(test)
    t1 = thr["1.0%"]; pred = st >= t1; te = test.assign(pred=pred)
    test_report = {
        "selected": {**evaluate(yt, st, tt), "alert_budget": budget_table(yt, st, thr),
                     "recall_by_type_at_deployed_threshold": {k: round(float(g.pred.mean()), 4) for k, g in te[te.label == 1].groupby("typ")},
                     "false_negatives_by_type": te[(te.label == 1) & ~te.pred].typ.value_counts().to_dict(),
                     "false_positives_by_type": te[(te.label == 0) & te.pred].typ.value_counts().to_dict()},
        "v2_baseline": {**evaluate(yt, sb, tt), "alert_budget": budget_table(yt, sb, base_thr),
                        "recall_by_type_at_deployed_threshold": {k: round(float(g.mean()), 4) for k, g in pd.Series(sb >= base_thr["1.0%"])[yt == 1].groupby(tt[yt == 1])}},
    }
    ep = episodes(pd.read_parquet(ROOT / "data" / "trades.parquet"))
    test_report["selected"]["episode_recall_at_deployed_threshold"] = episode_recall(ep, test.assign(score=st), t1)
    test_report["v2_baseline"]["episode_recall_at_deployed_threshold"] = episode_recall(ep, test.assign(score=sb), base_thr["1.0%"])
    sv = model.shap_values(test); imp = dict(sorted(zip(model.features, np.abs(sv).mean(0).round(4).tolist(), strict=True), key=lambda x: -x[1]))
    meta = {"name": best, "model": model.describe(), "features": model.features, "thresholds": thr, "deployed_budget": "1.0%",
            "protocol": __doc__.strip().splitlines()[2:8], "data": {"features_sha": registry.file_sha(ROOT / "data" / "features.parquet"),
            "rows": len(f), "dev_end": str(dev.date.max())[:10], "test_start": str(test.date.min())[:10], "test_rows": len(test),
            "test_positives": int(yt.sum()), "folds": [{"train_end": str(a[-1])[:10], "val": [str(b[0])[:10], str(b[-1])[:10]]} for a, b in folds],
            "calibration_block": [str(cal.date.min())[:10], str(cal.date.max())[:10]]},
            "cv": {n: {"eligible": r["eligible"], **r["cv"]} for n, r in cv.items()}, "test": test_report, "global_shap_mean_abs": imp,
            "label_noise": "trained on noisy labels (8% of positives missed, 0.2% of negatives mis-tagged); evaluated on true labels"}
    scored = f[["date", "account", "typ", "label"] + FEATURES].assign(score=model.predict_proba(f))
    version = registry.register({"scorer": model, "features": model.features, "name": best, "thresholds": thr, "threshold": t1}, meta, promote=True)
    scored.to_parquet(registry.REG / version / "scored.parquet")
    (ROOT / "reports").mkdir(exist_ok=True)
    json.dump({**meta, "version": version}, open(ROOT / "reports" / "metrics.json", "w"), indent=2, default=str)
    _plots(imp, best, yt, st, sb)
    print(json.dumps({"version": version, "selected": best, "test": test_report}, indent=1, default=str))


def _plots(imp: dict[str, float], best: str, yt: np.ndarray, st: np.ndarray, sb: np.ndarray) -> None:
    top = dict(list(imp.items())[:15])
    plt.figure(figsize=(7, 5)); plt.barh(list(top)[::-1], list(top.values())[::-1]); plt.title(f"Mean |SHAP| (test) — {best}"); plt.tight_layout()
    plt.savefig(ROOT / "reports" / "shap_importance.png", dpi=120); plt.close()
    plt.figure(figsize=(6, 4))
    for nm, s in [(best, st), ("v2 baseline (17 features)", sb)]:
        p, r, _ = precision_recall_curve(yt, s); plt.plot(r, p, label=f"{nm} AP={average_precision_score(yt, s):.3f}")
    plt.xlabel("Recall"); plt.ylabel("Precision"); plt.legend(fontsize=8); plt.title("Test PR curve (read once)"); plt.tight_layout()
    plt.savefig(ROOT / "reports" / "pr_curves.png", dpi=120); plt.close()


if __name__ == "__main__": main()
