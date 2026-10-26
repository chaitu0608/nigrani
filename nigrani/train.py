"""Time-split model comparison, imbalance handling, ablation, SHAP. Writes artifacts/ and reports/."""
import json

import joblib
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from catboost import CatBoostClassifier
from lightgbm import LGBMClassifier
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, precision_recall_curve, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from nigrani.features import FEATURES

matplotlib.use("Agg")

GRAPH = ["in_cycle", "top_cp_concentration", "repeat_cp_trades", "counterparty_share", "cp_round_trip_share", "cp_degree"]
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.metrics import brier_score_loss


def recall_at_alert_rate(y, s, rate=.01):
    k = max(1, int(len(s) * rate)); idx = np.argsort(-s)[:k]; return y[idx].sum() / max(1, y.sum())
def precision_at_k(y, s, k=100): return y[np.argsort(-s)[:k]].mean()

def evaluate(y, s): return {"pr_auc": round(average_precision_score(y, s), 4), "roc_auc": round(roc_auc_score(y, s), 4),
                            "recall_at_1pct_alerts": round(recall_at_alert_rate(y, s), 4), "precision_at_100": round(precision_at_k(y, s), 4)}

def main():
    f = pd.read_parquet("data/features.parquet"); pd.read_parquet("data/trades.parquet")
    dates = np.sort(f.date.unique()); c1, c2 = dates[int(.7 * len(dates))], dates[int(.85 * len(dates))]
    tr_, va, te = f[f.date < c1], f[(f.date >= c1) & (f.date < c2)], f[f.date >= c2]
    X = lambda d, cols=FEATURES: d[cols].values
    ytr, yva, yte = tr_.label_noisy.values, va.label.values, te.label.values  # train on noisy labels, evaluate on truth
    spw = (ytr == 0).sum() / ytr.sum()
    models = {
        "baseline_prior": DummyClassifier(strategy="prior"),
        "logreg_balanced": make_pipeline(StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=2000)),
        "random_forest_balanced": RandomForestClassifier(400, min_samples_leaf=3, class_weight="balanced_subsample", n_jobs=-1, random_state=0),
        "catboost": CatBoostClassifier(iterations=600, learning_rate=.05, depth=6, verbose=0, random_seed=0),
        "lightgbm_unweighted": LGBMClassifier(n_estimators=400, learning_rate=.05, num_leaves=31, verbose=-1, random_state=0),
        "lightgbm_spw": LGBMClassifier(n_estimators=400, learning_rate=.05, num_leaves=31, scale_pos_weight=spw, verbose=-1, random_state=0),
    }
    res = {}
    for n, m in models.items():
        m.fit(X(tr_), ytr); res[n] = {"val": evaluate(yva, m.predict_proba(X(va))[:, 1]), "test": evaluate(yte, m.predict_proba(X(te))[:, 1])}
    iso = IsolationForest(n_estimators=300, random_state=0).fit(X(tr_[tr_.label == 0]))
    res["isolation_forest_unsupervised"] = {"val": evaluate(yva, -iso.score_samples(X(va))), "test": evaluate(yte, -iso.score_samples(X(te)))}
    # ablation: no graph/counterparty features
    nog = [c for c in FEATURES if c not in GRAPH]
    abl = LGBMClassifier(n_estimators=400, learning_rate=.05, verbose=-1, random_state=0).fit(X(tr_, nog), ytr)
    res["ablation_lightgbm_no_graph_features"] = {"val": evaluate(yva, abl.predict_proba(X(va, nog))[:, 1]), "test": evaluate(yte, abl.predict_proba(X(te, nog))[:, 1])}
    best = max([k for k in models if k != "baseline_prior"], key=lambda k: res[k]["val"]["pr_auc"])
    m = models[best]; sva = m.predict_proba(X(va))[:, 1]
    p, r, th = precision_recall_curve(yva, sva); f1 = 2 * p * r / (p + r + 1e-9); thr = float(th[np.argmax(f1[:-1])])
    ste = m.predict_proba(X(te))[:, 1]; pred = ste >= thr
    tp, fp, fn = int((pred & (yte == 1)).sum()), int((pred & (yte == 0)).sum()), int((~pred & (yte == 1)).sum())
    # per-typology recall at threshold
    te2 = te.assign(pred=pred)
    per_typ = {k: round(float(g.pred.mean()), 4) for k, g in te2[te2.label == 1].groupby("typ")}
    fn_by_typ = te2[(te2.label == 1) & ~te2.pred].typ.value_counts().to_dict()
    fp_by_typ = te2[(te2.label == 0) & te2.pred].typ.value_counts().to_dict()
    legit_fp_rate = {k: round(float(g.pred.mean()), 4) for k, g in te2[te2.label == 0].groupby("typ")}
    # alert-budget thresholds: pick score cut on VAL so alerts = budget share of account-days, apply to TEST
    budgets = {}
    for b in [.005, .01, .02]:
        t_b = float(np.quantile(sva, 1 - b)); pb = ste >= t_b
        budgets[f"{b:.1%}"] = {"threshold": round(t_b, 4), "test_alerts": int(pb.sum()), "precision": round(float(yte[pb].mean()) if pb.any() else 0, 4), "recall": round(float(yte[pb].sum() / yte.sum()), 4)}
    # calibration on validation (isotonic, frozen base model)
    cal = CalibratedClassifierCV(FrozenEstimator(m), method="isotonic").fit(X(va), yva)
    pc = cal.predict_proba(X(te))[:, 1]
    calib = {"brier_raw": round(brier_score_loss(yte, ste), 5), "brier_isotonic": round(brier_score_loss(yte, pc), 5),
             "mean_pred_raw": round(float(ste.mean()), 4), "mean_pred_isotonic": round(float(pc.mean()), 4), "true_rate": round(float(yte.mean()), 4)}
    summary = {"split": {"train_rows": len(tr_), "val_rows": len(va), "test_rows": len(te), "train_end": str(c1)[:10], "val_end": str(c2)[:10],
                         "test_pos_rate": round(float(yte.mean()), 4)}, "models": res, "selected_model": best, "threshold_from_val_max_f1": round(thr, 4),
               "test_at_threshold": {"tp": tp, "fp": fp, "fn": fn, "precision": round(tp / max(1, tp + fp), 4), "recall": round(tp / max(1, tp + fn), 4), "alerts": tp + fp},
               "test_recall_by_typology": per_typ, "false_negatives_by_typology": fn_by_typ, "false_positives_by_typology": fp_by_typ, "fp_rate_by_legit_type": legit_fp_rate, "alert_budget": budgets, "calibration": calib, "label_noise": "train on noisy labels (8% positives dropped, 0.2% negatives flipped); val/test scored on true labels"}
    # SHAP
    tree = m
    ex = shap.TreeExplainer(tree); sv = ex.shap_values(X(te)); sv = sv[1] if isinstance(sv, list) else sv
    if sv.ndim == 3: sv = sv[:, :, 1]
    imp = dict(sorted(zip(FEATURES, np.abs(sv).mean(0).round(4).tolist(), strict=False), key=lambda x: -x[1])); summary["global_shap_mean_abs"] = imp
    plt.figure(figsize=(7, 4)); plt.barh(list(imp)[::-1], list(imp.values())[::-1]); plt.title(f"Mean |SHAP| — {best}"); plt.tight_layout(); plt.savefig("reports/shap_importance.png", dpi=120)
    plt.figure(figsize=(6, 4))
    for n in ["logreg_balanced", "random_forest_balanced", "lightgbm_spw", "catboost"]:
        pp, rr, _ = precision_recall_curve(yte, models[n].predict_proba(X(te))[:, 1]); plt.plot(rr, pp, label=f"{n} AP={res[n]['test']['pr_auc']}")
    plt.xlabel("Recall"); plt.ylabel("Precision"); plt.legend(fontsize=7); plt.title("Test PR curves"); plt.tight_layout(); plt.savefig("reports/pr_curves.png", dpi=120)
    from sklearn.calibration import calibration_curve
    plt.figure(figsize=(5, 4))
    for nm, pr in [("raw", ste), ("isotonic", pc)]:
        a, b2 = calibration_curve(yte, pr, n_bins=8, strategy="quantile"); plt.plot(b2, a, marker="o", label=nm)
    plt.plot([0, 1], [0, 1], "k--"); plt.legend(); plt.title("Reliability (test)"); plt.tight_layout(); plt.savefig("reports/calibration.png", dpi=120)
    joblib.dump({"model": m, "calibrator": cal, "features": FEATURES, "threshold": thr, "name": best}, "artifacts/model.joblib")
    te.assign(score=ste).to_parquet("artifacts/test_scored.parquet")
    json.dump(summary, open("reports/metrics.json", "w"), indent=2, default=str); print(json.dumps(summary, indent=1, default=str))

if __name__ == "__main__": main()
