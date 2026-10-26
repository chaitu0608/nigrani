"""End-to-end pipeline on a small synthetic market: generator, features, models, CV protocol, registry."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from nigrani import registry
from nigrani.features import FEATURES, build, resolve_entities
from nigrani.generate import generate
from nigrani.models import PatternHeads, Scorer, TwoStage
from nigrani.train import EMBARGO, apply_overrides, budget_table, episode_recall, episodes, evaluate, recall_at_rate, split


@pytest.fixture(scope="module")
def small() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    t, a = generate(n_accounts=500, n_symbols=20, n_days=60, seed=3); return t, a, build(t, a)


def test_generator(small):
    t, a, _ = small
    assert {"wash", "circular", "pump_dump"} <= set(t.typology) and t.label.between(0, 1).all()
    assert (t.price > 0).all() and (t.qty > 0).all() and {"address_id", "phone_id", "bank_id"} <= set(a.columns)


def test_features_shape_and_finite(small):
    _, _, f = small
    assert set(FEATURES) <= set(f.columns) and not f.duplicated(["date", "account"]).any()
    assert np.isfinite(f[FEATURES].to_numpy(float)).all() and f.label.sum() > 0


def test_entity_resolution_transitive():
    acc = pd.DataFrame({"account": [0, 1, 2, 3], "address_id": [10, 10, 11, 12], "phone_id": [20, 21, 21, 22], "bank_id": [30, 31, 32, 33]})
    e = resolve_entities(acc); assert e[0] == e[1] == e[2] and e[3] != e[0]


def test_split_is_temporal_with_embargo(small):
    _, _, f = small; dev, test, folds = split(f)
    assert dev.date.max() < test.date.min() and len(folds) == 4
    days = list(np.sort(dev.date.unique()))
    for tr, va in folds:
        assert tr.max() < va.min() and days.index(va.min()) - days.index(tr.max()) > EMBARGO


@pytest.mark.parametrize("model", [lambda: Scorer(FEATURES, "lgbm"), lambda: PatternHeads(FEATURES, "lgbm"), lambda: TwoStage(FEATURES)])
def test_models_fit_predict_explain(small, model):
    _, _, f = small; m = model().fit(f, f.label_noisy.to_numpy()); p = m.predict_proba(f)
    assert p.shape == (len(f),) and ((p >= 0) & (p <= 1)).all() and evaluate(f.label.to_numpy(), p)["roc_auc"] > .8
    sv = m.shap_values(f.head(5)); assert sv.shape == (5, len(m.features)) and m.describe()


def test_pattern_heads_route(small):
    _, _, f = small; m = PatternHeads(FEATURES, "lgbm").fit(f, f.label_noisy.to_numpy()); h = m.head_scores(f)
    combo = 1 - (1 - h["network"]) * (1 - h["pump"]); assert np.allclose(combo, m.predict_proba(f))


def test_metrics_helpers():
    y = np.array([0, 0, 1, 1, 0, 0, 0, 0, 0, 1]); s = np.linspace(0, 1, 10)
    assert recall_at_rate(y, s, .1) == pytest.approx(1 / 3) and evaluate(y, s)["pr_auc"] > 0
    b = budget_table(y, s, {"10%": .95}); assert b["10%"]["alerts"] == 1 and b["10%"]["precision"] == 1.0


def test_overrides_replace_noisy_labels():
    d = pd.DataFrame({"date": pd.to_datetime(["2026-01-01", "2026-01-02"]), "account": [1, 2], "label_noisy": [0, 1]})
    o = pd.DataFrame({"date": ["2026-01-01"], "account": [1], "label": [1]})
    assert apply_overrides(d, o).label_noisy.tolist() == [1, 1] and apply_overrides(d, None) is d


def test_episode_recall(small):
    t, _, f = small; ep = episodes(t); scored = f.assign(score=f.label.astype(float))
    r = episode_recall(ep, scored, .5); assert r and all(v["recall"] == 1.0 for v in r.values() if isinstance(v, dict) and "recall" in v)


def test_registry_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "REG", tmp_path)
    with pytest.raises(FileNotFoundError): registry.metadata()
    v1 = registry.register({"x": 1}, {"name": "a"}, promote=True); v2 = registry.register({"x": 2}, {"name": "b"})
    assert registry.index()["production"] == v1 and registry.load()["x"] == 1
    registry.promote_version(v2); assert registry.load()["x"] == 2 and registry.metadata(v2)["version"] == v2
    with pytest.raises(KeyError): registry.promote_version("v9")
    assert len(registry.file_sha(tmp_path / v1 / "model.joblib")) == 16
