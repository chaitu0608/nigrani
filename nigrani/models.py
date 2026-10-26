"""Model families compared in time-series CV. Every scorer exposes fit / predict_proba / shap_values."""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import shap
from catboost import CatBoostClassifier
from lightgbm import LGBMClassifier

NETWORK_TYPES = {"wash", "circular"}
PUMP_TYPES = {"pump_dump", "pump_dump_subtle"}


def _cat(seed: int = 0, iters: int = 500) -> CatBoostClassifier:
    return CatBoostClassifier(iterations=iters, learning_rate=.06, depth=6, verbose=0, random_seed=seed, thread_count=-1)


def _lgbm(spw: float = 1.0, seed: int = 0) -> LGBMClassifier:
    return LGBMClassifier(n_estimators=400, learning_rate=.05, num_leaves=31, min_child_samples=20,
                          scale_pos_weight=spw, subsample=.8, subsample_freq=1, colsample_bytree=.8, verbose=-1, random_state=seed)


class Scorer:
    """Base: one binary tree model on a fixed feature list."""
    kind = "single"

    def __init__(self, features: list[str], algo: str = "catboost", seed: int = 0):
        self.features, self.algo, self.seed = list(features), algo, seed
        self.model: Any = None

    def _new(self, y: np.ndarray) -> Any:
        if self.algo == "catboost": return _cat(self.seed)
        return _lgbm(float((y == 0).sum() / max(1, y.sum())), self.seed)

    def fit(self, df: pd.DataFrame, y: np.ndarray) -> Scorer:
        self.model = self._new(y).fit(df[self.features].to_numpy(float), y); return self

    def predict_proba(self, df: pd.DataFrame) -> np.ndarray:
        return self.model.predict_proba(df[self.features].to_numpy(float))[:, 1]

    def shap_values(self, df: pd.DataFrame) -> np.ndarray:
        return _shap(self.model, df[self.features].to_numpy(float))

    def describe(self) -> dict:
        return {"kind": self.kind, "algo": self.algo, "n_features": len(self.features)}


_EXPLAINERS: dict[int, Any] = {}


def _shap(model: Any, x: np.ndarray) -> np.ndarray:
    ex = _EXPLAINERS.get(id(model))
    if ex is None:
        ex = _EXPLAINERS[id(model)] = shap.TreeExplainer(model)
    sv = ex.shap_values(x); sv = sv[1] if isinstance(sv, list) else sv
    return sv[:, :, 1] if sv.ndim == 3 else sv


class PatternHeads(Scorer):
    """Per-pattern heads: one model for network manipulation (wash/circular), one for pump-and-dump.
    Combined as P(any) = 1 - (1-p_net)(1-p_pump). Training labels come from the (noisy) label; the
    pattern is known only for cases an analyst confirmed, exactly like a real case-management system."""
    kind = "pattern_heads"

    def fit(self, df: pd.DataFrame, y: np.ndarray) -> PatternHeads:
        typ = df["typ"].to_numpy(); x = df[self.features].to_numpy(float)
        self.heads = {}
        for name, types in [("network", NETWORK_TYPES), ("pump", PUMP_TYPES)]:
            yy = ((y == 1) & np.isin(typ, list(types))).astype(int)
            self.heads[name] = self._new(yy).fit(x, yy)
        rest = ((y == 1) & ~np.isin(typ, list(NETWORK_TYPES | PUMP_TYPES))).astype(int)  # label-noise positives
        self.heads_rest = rest.sum(); return self

    def head_scores(self, df: pd.DataFrame) -> dict[str, np.ndarray]:
        x = df[self.features].to_numpy(float)
        return {k: m.predict_proba(x)[:, 1] for k, m in self.heads.items()}

    def predict_proba(self, df: pd.DataFrame) -> np.ndarray:
        h = self.head_scores(df); return 1 - (1 - h["network"]) * (1 - h["pump"])

    def shap_values(self, df: pd.DataFrame) -> np.ndarray:
        h = self.head_scores(df); x = df[self.features].to_numpy(float)
        sn, sp = _shap(self.heads["network"], x), _shap(self.heads["pump"], x)
        return np.where((h["network"] >= h["pump"])[:, None], sn, sp)

    def describe(self) -> dict:
        return {**super().describe(), "heads": list(self.heads)}


class TwoStage(Scorer):
    """Stage 1: high-recall LightGBM keeps the top `keep` share; stage 2: CatBoost re-ranks only those."""
    kind = "two_stage"

    def __init__(self, features: list[str], keep: float = .06, seed: int = 0):
        super().__init__(features, "two_stage", seed); self.keep = keep

    def fit(self, df: pd.DataFrame, y: np.ndarray) -> TwoStage:
        x = df[self.features].to_numpy(float)
        self.s1 = _lgbm(float((y == 0).sum() / max(1, y.sum())), self.seed).fit(x, y)
        p1 = self.s1.predict_proba(x)[:, 1]; self.cut = float(np.quantile(p1, 1 - self.keep))
        m = p1 >= self.cut; self.s2 = _cat(self.seed).fit(x[m], y[m]); return self

    def predict_proba(self, df: pd.DataFrame) -> np.ndarray:
        x = df[self.features].to_numpy(float); p1 = self.s1.predict_proba(x)[:, 1]
        out = p1 * 0.1  # rejected rows stay ranked below every stage-2 row
        m = p1 >= self.cut
        if m.any(): out[m] = 0.1 + 0.9 * self.s2.predict_proba(x[m])[:, 1]
        return out

    def shap_values(self, df: pd.DataFrame) -> np.ndarray:
        return _shap(self.s2, df[self.features].to_numpy(float))
