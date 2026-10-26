"""Real-data benchmark and subtle-pump study helpers. The full Elliptic run needs data/elliptic (make elliptic)."""
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from nigrani import elliptic
from nigrani.service import external_benchmarks


def test_graph_features_and_metrics_on_toy_graph():
    X = pd.DataFrame({"txId": [10, 11, 12, 13], "t": [1, 1, 1, 1], **{f"local_{i}": np.arange(4.0) * i for i in range(1, 17)}})
    e = pd.DataFrame({"txId1": [10, 10, 11], "txId2": [11, 12, 13]})
    G = elliptic.graph_features(X, e)
    assert G.g_out_deg.tolist() == [2, 1, 0, 0] and G.g_in_deg.tolist() == [0, 1, 1, 1]
    assert G.g_in_mean_local_1.iloc[3] == 1.0  # tx 13's only parent is tx 11 (local_1 = 1)
    y = np.array([1, 0, 1, 0]); s = np.array([.9, .1, .8, .2])
    r = elliptic.evaluate(y, s, .5); assert r["f1"] == 1.0 and r["budget_1pct"]["precision"] == 1.0
    assert 0 <= elliptic.best_f1_thr(y, s) <= 1


def test_sequence_features_are_past_only():
    from nigrani.pump_experiments import SEQ, add_sequence_features
    f = pd.read_parquet(Path(__file__).resolve().parents[1] / "data" / "features.parquet").head(3000) \
        if (Path(__file__).resolve().parents[1] / "data" / "features.parquet").exists() else pytest.skip("features not built")
    out = add_sequence_features(f)
    assert set(SEQ) <= set(out.columns) and out[SEQ].notna().all().all()


def test_reports_surface_in_model_card():
    b = external_benchmarks()
    if "elliptic" not in b: pytest.skip("run make elliptic first")
    assert b["elliptic"]["nigrani"]["f1"] > b["elliptic"]["paper_gcn_f1"]


@pytest.mark.skipif(not (elliptic.DATA / elliptic.FILES[0]).exists(), reason="Elliptic data not downloaded")
def test_elliptic_loader_shapes():
    c = pd.read_csv(elliptic.DATA / elliptic.FILES[1]); assert len(c) == 203_769 and set(c["class"].astype(str)) == {"1", "2", "unknown"}
