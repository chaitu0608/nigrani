"""Experiment sweep: models x imbalance strategies, Optuna, graph embeddings, autoencoder,
importance stability, PSI drift, analyst-feedback retraining loop. Logs every run to reports/experiments.csv."""
from __future__ import annotations

import json
import time
import warnings

import networkx as nx
import numpy as np
import optuna
import pandas as pd
from catboost import CatBoostClassifier
from imblearn.over_sampling import SMOTE
from lightgbm import LGBMClassifier
from scipy.stats import spearmanr
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.manifold import SpectralEmbedding
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from nigrani.features import FEATURES
from nigrani.train import GRAPH, evaluate

warnings.filterwarnings("ignore"); optuna.logging.set_verbosity(optuna.logging.WARNING)
LOG: list[dict] = []

def log(name: str, family: str, imbalance: str, sva: np.ndarray, ste: np.ndarray, yva: np.ndarray, yte: np.ndarray, t0: float, note: str = "") -> None:
    v, t = evaluate(yva, sva), evaluate(yte, ste)
    LOG.append({"experiment": name, "family": family, "imbalance": imbalance, **{f"val_{k}": x for k, x in v.items()}, **{f"test_{k}": x for k, x in t.items()}, "seconds": round(time.time() - t0, 1), "note": note})
    print(f"{name:45s} val PR-AUC {v['pr_auc']:.4f}  test PR-AUC {t['pr_auc']:.4f}  R@1% {t['recall_at_1pct_alerts']:.3f}")

def focal_objective(gamma: float = 2.0, alpha: float = .25):
    def loss(y, z):
        p = 1 / (1 + np.exp(-z)); p = np.clip(p, 1e-9, 1 - 1e-9)
        return -(alpha * y * (1 - p) ** gamma * np.log(p) + (1 - alpha) * (1 - y) * p ** gamma * np.log(1 - p))
    def obj(y, z):
        e = 1e-4; l0, lp, lm = loss(y, z), loss(y, z + e), loss(y, z - e)
        return (lp - lm) / (2 * e), np.maximum((lp - 2 * l0 + lm) / e ** 2, 1e-6)
    return obj

def psi(a: np.ndarray, b: np.ndarray, bins: int = 10) -> float:
    q = np.unique(np.quantile(a, np.linspace(0, 1, bins + 1)))
    if len(q) < 3: return 0.0
    pa = np.histogram(np.clip(a, q[0], q[-1]), q)[0] / len(a) + 1e-6; pb = np.histogram(np.clip(b, q[0], q[-1]), q)[0] / len(b) + 1e-6
    return float(np.sum((pa - pb) * np.log(pa / pb)))

def main() -> None:
    f = pd.read_parquet("data/features.parquet"); tr = pd.read_parquet("data/trades.parquet")
    dates = np.sort(f.date.unique()); c1, c2 = dates[int(.7 * len(dates))], dates[int(.85 * len(dates))]
    A, V, T = f[f.date < c1], f[(f.date >= c1) & (f.date < c2)], f[f.date >= c2]
    ytr, yva, yte = A.label_noisy.values, V.label.values, T.label.values
    Xa, Xv, Xt = A[FEATURES].values, V[FEATURES].values, T[FEATURES].values
    spw = (ytr == 0).sum() / ytr.sum()
    p = lambda m, X: m.predict_proba(X)[:, 1]
    lgb = lambda **k: LGBMClassifier(n_estimators=400, learning_rate=.05, verbose=-1, random_state=0, **k)
    # 1. model families x imbalance strategies
    sm = SMOTE(random_state=0, k_neighbors=5); Xs, ys = sm.fit_resample(Xa, ytr)
    runs = [
        ("logreg | class_weight", "logreg", "class_weight", lambda: make_pipeline(StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=3000)), False),
        ("logreg | SMOTE", "logreg", "smote", lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000)), True),
        ("random_forest | class_weight", "rf", "class_weight", lambda: RandomForestClassifier(300, min_samples_leaf=3, class_weight="balanced_subsample", n_jobs=-1, random_state=0), False),
        ("random_forest | SMOTE", "rf", "smote", lambda: RandomForestClassifier(300, min_samples_leaf=3, n_jobs=-1, random_state=0), True),
        ("lightgbm | none", "lightgbm", "none", lambda: lgb(), False),
        ("lightgbm | scale_pos_weight", "lightgbm", "class_weight", lambda: lgb(scale_pos_weight=spw), False),
        ("lightgbm | SMOTE", "lightgbm", "smote", lambda: lgb(), True),
        ("lightgbm | focal loss (g=2,a=.25)", "lightgbm", "focal", lambda: lgb(objective=focal_objective()), False),
        ("xgboost | scale_pos_weight", "xgboost", "class_weight", lambda: XGBClassifier(n_estimators=400, learning_rate=.05, max_depth=6, scale_pos_weight=spw, eval_metric="aucpr", random_state=0, n_jobs=-1), False),
        ("xgboost | none", "xgboost", "none", lambda: XGBClassifier(n_estimators=400, learning_rate=.05, max_depth=6, eval_metric="aucpr", random_state=0, n_jobs=-1), False),
        ("catboost | auto_class_weights", "catboost", "class_weight", lambda: CatBoostClassifier(iterations=600, learning_rate=.05, depth=6, auto_class_weights="Balanced", verbose=0, random_seed=0), False),
        ("catboost | none", "catboost", "none", lambda: CatBoostClassifier(iterations=600, learning_rate=.05, depth=6, verbose=0, random_seed=0), False),
    ]
    for name, fam, imb, mk, smote in runs:
        t0 = time.time(); m = mk(); m.fit(*(Xs, ys) if smote else (Xa, ytr))
        if imb == "focal":
            raw = lambda X, m=m: 1 / (1 + np.exp(-m.predict(X, raw_score=True))); log(name, fam, imb, raw(Xv), raw(Xt), yva, yte, t0)
        else: log(name, fam, imb, p(m, Xv), p(m, Xt), yva, yte, t0)
    # 2. ablation: graph features
    nog = [c for c in FEATURES if c not in GRAPH]; t0 = time.time()
    m = lgb(scale_pos_weight=spw).fit(A[nog].values, ytr); log("ablation: lightgbm spw WITHOUT graph features", "lightgbm", "class_weight", p(m, V[nog].values), p(m, T[nog].values), yva, yte, t0)
    # 3. graph embeddings: spectral embedding of the TRAIN-period counterparty graph (node2vec-style, leakage-safe)
    t0 = time.time(); c = tr[(tr.counterparty >= 0) & (tr.date < c1)]
    G = nx.Graph(); G.add_nodes_from(range(f.account.max() + 1)); G.add_edges_from(zip(c.account, c.counterparty, strict=True))
    emb = SpectralEmbedding(8, affinity="precomputed", random_state=0).fit_transform(nx.to_scipy_sparse_array(G, format="csr") + 1e-6 * np.eye(G.number_of_nodes()))
    E = lambda d: np.hstack([d[FEATURES].values, emb[d.account.values]])
    m = lgb(scale_pos_weight=spw).fit(E(A), ytr); log("lightgbm spw + spectral graph embeddings (8d)", "lightgbm+graph_emb", "class_weight", p(m, E(V)), p(m, E(T)), yva, yte, t0, "graph built from train-period edges only")
    # 4. semi-supervised autoencoder (MLP) trained on normal rows only; score = reconstruction error
    t0 = time.time(); sc = StandardScaler().fit(Xa[ytr == 0]); Z = lambda X: np.clip(sc.transform(X), -8, 8)
    ae = MLPRegressor(hidden_layer_sizes=(16, 6, 16), max_iter=200, random_state=0).fit(Z(Xa[ytr == 0]), Z(Xa[ytr == 0]))
    re = lambda X: ((ae.predict(Z(X)) - Z(X)) ** 2).mean(1); log("autoencoder (normals only, recon error)", "autoencoder", "n/a (unsupervised)", re(Xv), re(Xt), yva, yte, t0)
    # 5. Optuna on LightGBM, objective = validation PR-AUC
    t0 = time.time()
    def objective(trial):
        prm = dict(n_estimators=trial.suggest_int("n_estimators", 150, 800), learning_rate=trial.suggest_float("learning_rate", .01, .2, log=True), num_leaves=trial.suggest_int("num_leaves", 8, 96),
                   min_child_samples=trial.suggest_int("min_child_samples", 5, 100), subsample=trial.suggest_float("subsample", .5, 1), subsample_freq=1, colsample_bytree=trial.suggest_float("colsample_bytree", .4, 1),
                   reg_lambda=trial.suggest_float("reg_lambda", 1e-3, 10, log=True), scale_pos_weight=trial.suggest_float("scale_pos_weight", 1, spw, log=True))
        return evaluate(yva, p(LGBMClassifier(verbose=-1, random_state=0, **prm).fit(Xa, ytr), Xv))["pr_auc"]
    st = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=0)); st.optimize(objective, n_trials=40)
    best = LGBMClassifier(verbose=-1, random_state=0, subsample_freq=1, **st.best_params).fit(Xa, ytr)
    log("lightgbm | Optuna (40 trials, val PR-AUC)", "lightgbm", "tuned", p(best, Xv), p(best, Xt), yva, yte, t0, json.dumps({k: round(v, 4) if isinstance(v, float) else v for k, v in st.best_params.items()}))
    # 6. feature-importance stability: 5 bootstrap resamples of train, Spearman of gain importances
    imps = []
    for s in range(5):
        idx = np.random.default_rng(s).choice(len(Xa), len(Xa)); imps.append(lgb(scale_pos_weight=spw, importance_type="gain").fit(Xa[idx], ytr[idx]).feature_importances_)
    rho = [spearmanr(imps[i], imps[j]).statistic for i in range(5) for j in range(i + 1, 5)]
    ranks = pd.DataFrame(imps, columns=FEATURES).rank(axis=1, ascending=False)
    stability = {"mean_pairwise_spearman": round(float(np.mean(rho)), 4), "min_pairwise_spearman": round(float(np.min(rho)), 4),
                 "top5_rank_mean": ranks.mean().sort_values().head(5).round(2).to_dict(), "top5_rank_std": ranks.std().loc[ranks.mean().sort_values().head(5).index].round(2).to_dict()}
    # 7. PSI drift train -> test
    drift = {c: round(psi(A[c].values, T[c].values), 4) for c in FEATURES}; drift = dict(sorted(drift.items(), key=lambda x: -x[1]))
    # 8. analyst-feedback loop: each test week, analysts review top 1% alerts, true labels flow back, model retrains
    weeks = pd.Series(T.date.dt.isocalendar().week.values, index=T.index); fb = []; Xtrain, ytrain = Xa.copy(), ytr.copy()
    static = lgb(scale_pos_weight=spw).fit(Xa, ytr); cur = static
    for w in sorted(weeks.unique()):
        W = T[weeks == w]; yW = W.label.values
        if yW.sum() == 0: continue
        fb.append({"week": int(w), "positives": int(yW.sum()), "static_pr_auc": evaluate(yW, p(static, W[FEATURES].values))["pr_auc"], "feedback_pr_auc": evaluate(yW, p(cur, W[FEATURES].values))["pr_auc"]})
        k = max(1, int(.01 * len(W))); top = np.argsort(-p(cur, W[FEATURES].values))[:k]
        Xtrain = np.vstack([Xtrain, W[FEATURES].values[top]]); ytrain = np.concatenate([ytrain, yW[top]])
        cur = lgb(scale_pos_weight=(ytrain == 0).sum() / ytrain.sum()).fit(Xtrain, ytrain)
    df = pd.DataFrame(LOG).sort_values("val_pr_auc", ascending=False); df.to_csv("reports/experiments.csv", index=False)
    chosen = df.iloc[0].experiment
    json.dump({"chosen_by_val_pr_auc": chosen, "experiments": df.to_dict("records"), "importance_stability": stability, "psi_train_vs_test": drift,
               "feedback_loop": fb, "notes": "GNN not run: no torch-geometric in this box; spectral embedding used as a graph-embedding stand-in."}, open("reports/experiments.json", "w"), indent=2, default=str)
    print("\nCHOSEN (val PR-AUC):", chosen); print(json.dumps({"stability": stability, "psi_top": dict(list(drift.items())[:5]), "feedback": fb}, indent=1))

if __name__ == "__main__": main()
