"""Real-data benchmark: the Elliptic Bitcoin AML dataset (Weber et al., KDD'19 Workshop, arXiv:1908.02591).

Same philosophy as the synthetic track: graph features, strict temporal split (train t<=34, test t>=35, exactly
as the paper), a threshold chosen on a held-out validation block (t 30-34, never on test), alert-budget metrics
and SHAP. Data: public no-login mirror https://huggingface.co/datasets/yhoma/elliptic-bitcoin-dataset
(`python -m nigrani.elliptic --download`).
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "elliptic"
OUT = ROOT / "reports"
MIRROR = "https://huggingface.co/datasets/yhoma/elliptic-bitcoin-dataset/resolve/main/"
FILES = ("elliptic_txs_features.csv", "elliptic_txs_classes.csv", "elliptic_txs_edgelist.csv")
# Table 1 of Weber et al. 2019: illicit-class precision / recall / F1 on test steps 35-49.
PAPER = {"LogReg AF": (.404, .593, .481), "RF AF": (.956, .670, .788), "RF AF+NE": (.971, .675, .796),
         "MLP AF": (.694, .617, .653), "GCN": (.812, .512, .628), "Skip-GCN": (.812, .623, .705)}
TRAIN_END, VAL_START, SEED = 34, 30, 7


def download() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        if not (DATA / f).exists(): print("downloading", f); urllib.request.urlretrieve(MIRROR + f, DATA / f)


def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    X = pd.read_csv(DATA / FILES[0], header=None)
    X.columns = ["txId", "t"] + [f"local_{i}" for i in range(1, 94)] + [f"agg_{i}" for i in range(1, 73)]
    y = pd.read_csv(DATA / FILES[1]); e = pd.read_csv(DATA / FILES[2])
    X = X.merge(y, on="txId"); X["y"] = X["class"].map({"1": 1, "2": 0, 1: 1, 2: 0})
    return X.drop(columns="class"), e


def graph_features(X: pd.DataFrame, e: pd.DataFrame, k: int = 16) -> pd.DataFrame:
    """Label-free structural features on the BTC flow graph (edges never cross time steps, so this is leak-free):
    in/out degree, 2-hop reach, and mean / max of the first k local features over in- and out-neighbours."""
    idx = pd.Series(np.arange(len(X)), index=X.txId.values)
    s, d = idx[e.txId1].to_numpy(), idx[e.txId2].to_numpy(); n = len(X)
    A = sp.csr_matrix((np.ones(len(s)), (s, d)), shape=(n, n))
    out_deg, in_deg = np.asarray(A.sum(1)).ravel(), np.asarray(A.sum(0)).ravel()
    U = ((A + A.T) > 0).astype(float); deg = np.asarray(U.sum(1)).ravel()
    two_hop = np.asarray((U @ U).sum(1)).ravel() - deg
    cols = [f"local_{i}" for i in range(1, k + 1)]; F = X[cols].to_numpy(float)
    G = {"g_in_deg": in_deg, "g_out_deg": out_deg, "g_two_hop": two_hop, "g_deg_ratio": out_deg / (in_deg + 1)}
    for name, M, dg in (("in", A.T.tocsr(), in_deg), ("out", A, out_deg)):
        mean = (M @ F) / np.maximum(dg, 1)[:, None]
        for j, c in enumerate(cols): G[f"g_{name}_mean_{c}"] = mean[:, j]; G[f"g_{name}_diff_{c}"] = F[:, j] - mean[:, j]
    # neighbour max of the first local feature (tx amount proxy) via sparse max
    G["g_nbr_max_local_1"] = np.asarray(U.multiply(F[:, [0]].T).max(1).todense()).ravel()
    return pd.DataFrame(G, index=X.index)


def budget(y: np.ndarray, s: np.ndarray, frac: float) -> dict[str, float]:
    k = max(1, int(round(frac * len(y)))); top = np.argsort(-s)[:k]
    return {"alerts": k, "precision": round(float(y[top].mean()), 4), "recall": round(float(y[top].sum() / max(1, y.sum())), 4)}


def evaluate(y: np.ndarray, s: np.ndarray, thr: float) -> dict[str, float]:
    p = (s >= thr).astype(int)
    return {"precision": round(precision_score(y, p, zero_division=0), 4), "recall": round(recall_score(y, p), 4),
            "f1": round(f1_score(y, p), 4), "pr_auc": round(average_precision_score(y, s), 4), "roc_auc": round(roc_auc_score(y, s), 4),
            "threshold": round(float(thr), 4), **{f"budget_{int(f * 100)}pct": budget(y, s, f) for f in (.01, .05, .10)}}


def best_f1_thr(y: np.ndarray, s: np.ndarray) -> float:
    qs = np.unique(np.quantile(s, np.linspace(.5, .999, 400)))
    return float(max(qs, key=lambda t: f1_score(y, (s >= t).astype(int))))


def models() -> dict:
    import lightgbm as lgb
    return {
        "LogReg AF (repro)": lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)),
        "RF AF (repro, 50 trees / 50 feats)": lambda: RandomForestClassifier(50, max_features=50, n_jobs=-1, random_state=SEED),
        "LightGBM AF": lambda: lgb.LGBMClassifier(n_estimators=600, learning_rate=.03, num_leaves=31, subsample=.8, subsample_freq=1,
                                                  colsample_bytree=.5, random_state=SEED, verbose=-1),
        "LightGBM AF+graph (Nigrani)": lambda: lgb.LGBMClassifier(n_estimators=600, learning_rate=.03, num_leaves=31, subsample=.8, subsample_freq=1,
                                                                  colsample_bytree=.5, random_state=SEED, verbose=-1),
        "RF AF+graph": lambda: RandomForestClassifier(300, max_features=50, n_jobs=-1, random_state=SEED),
    }


def run() -> dict:
    t0 = time.time(); X, e = load(); G = graph_features(X, e); D = pd.concat([X, G], axis=1)
    AF = [c for c in X.columns if c.startswith(("local_", "agg_"))]; AFG = AF + list(G.columns)
    lab = D[D.y.notna()].copy(); lab["y"] = lab.y.astype(int)
    tr, te = lab[lab.t <= TRAIN_END], lab[lab.t > TRAIN_END]; fit, val = tr[tr.t < VAL_START], tr[tr.t >= VAL_START]
    res, scores = {}, {}
    for name, mk in models().items():
        cols = AFG if "graph" in name else AF
        thr_paper = .5  # the paper reports default sklearn decisions
        m = mk().fit(fit[cols], fit.y); thr_val = best_f1_thr(val.y.to_numpy(), m.predict_proba(val[cols])[:, 1])
        m = mk().fit(tr[cols], tr.y); s = m.predict_proba(te[cols])[:, 1]; scores[name] = (m, cols, s)
        res[name] = {"default_0.5": evaluate(te.y.to_numpy(), s, thr_paper), "val_tuned": evaluate(te.y.to_numpy(), s, thr_val), "n_features": len(cols)}
        print(f"{name:40s} F1@.5={res[name]['default_0.5']['f1']:.3f}  F1@val={res[name]['val_tuned']['f1']:.3f}  PR-AUC={res[name]['default_0.5']['pr_auc']:.3f}")
    best = "LightGBM AF+graph (Nigrani)"; m, cols, s = scores[best]
    yt = te.y.to_numpy(); thr = res[best]["val_tuned"]["threshold"]
    by_t = {int(t): round(f1_score(yt[te.t.to_numpy() == t], (s[te.t.to_numpy() == t] >= thr).astype(int), zero_division=0), 3) for t in sorted(te.t.unique())}
    import shap
    sv = shap.TreeExplainer(m).shap_values(te[cols].sample(3000, random_state=SEED)); sv = sv[1] if isinstance(sv, list) else sv
    top = pd.Series(np.abs(sv).mean(0), index=cols).sort_values(ascending=False).head(12).round(4)
    out = {"dataset": "Elliptic Bitcoin (203,769 txs, 234,355 edges, 49 steps; 4,545 illicit / 42,019 licit labelled)",
           "source": MIRROR.replace("resolve/main/", ""), "paper": "Weber et al. 2019, arXiv:1908.02591, Table 1",
           "split": {"train_steps": "1-34", "val_steps_for_threshold": "30-34", "test_steps": "35-49", "train_labelled": len(tr), "test_labelled": len(te),
                     "test_illicit": int(yt.sum())},
           "paper_baselines": {k: dict(zip(("precision", "recall", "f1"), v, strict=True)) for k, v in PAPER.items()},
           "results": res, "selected": best, "f1_by_test_step": by_t, "graph_features": len(G.columns),
           "shap_top": top.to_dict(), "runtime_s": round(time.time() - t0, 1),
           "note": "Steps 43+ follow a dark-market shutdown; every published model collapses there (Weber et al. Fig. 4)."}
    OUT.mkdir(exist_ok=True); (OUT / "elliptic_benchmark.json").write_text(json.dumps(out, indent=2)); return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--download", action="store_true"); a = ap.parse_args()
    download()
    run()
