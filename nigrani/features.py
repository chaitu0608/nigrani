"""Account-day features for trade surveillance. Label = account-day had any manipulative trade."""
import networkx as nx
import numpy as np
import pandas as pd

FEATURES = ["n_trades", "gross_value", "n_symbols", "illiquid_share", "buy_sell_balance",
            "counterparty_share", "top_cp_concentration", "repeat_cp_trades", "in_cycle",
            "sym_conc", "value_z_vs_own_history", "sym_day_volume_share", "co_trader_overlap", "px_dev_bps", "cp_round_trip_share", "cp_degree", "crowd_5d"]

def build(trades: pd.DataFrame, accounts: pd.DataFrame) -> pd.DataFrame:
    t = trades.copy(); t["value"] = t.qty * t.price
    t["sgn"] = np.where(t.side == "B", 1, -1)
    g = t.groupby(["date", "account"])
    f = pd.DataFrame({
        "n_trades": g.size(), "gross_value": g.value.sum(), "n_symbols": g.symbol.nunique(),
        "illiquid_share": g.illiquid.mean(),
        "buy_sell_balance": g.apply(lambda x: abs((x.sgn * x.value).sum()) / x.value.sum(), include_groups=False),
        "counterparty_share": g.counterparty.apply(lambda c: (c >= 0).mean()),
        "top_cp_concentration": g.counterparty.apply(lambda c: c[c >= 0].value_counts(normalize=True).max() if (c >= 0).any() else 0.0),
        "repeat_cp_trades": g.counterparty.apply(lambda c: c[c >= 0].value_counts().max() if (c >= 0).any() else 0),
        "sym_conc": g.symbol.apply(lambda s: s.value_counts(normalize=True).max()),
        "label": g.label.max(),
        "typ": g.typology.agg(lambda s: next((x for x in s if x not in ("normal",) and not x.startswith("legit")), next((x for x in s if x.startswith("legit")), "normal"))),
    }).reset_index()
    # graph feature: account sits on a directed cycle of counterparty trades that day
    cyc = []
    for d, x in t[t.counterparty >= 0].groupby("date"):
        G = nx.DiGraph(); G.add_edges_from(zip(x[x.side == "S"].account, x[x.side == "S"].counterparty, strict=False))
        for comp in nx.strongly_connected_components(G):
            if len(comp) >= 2: cyc += [(d, a) for a in comp]
    cyc = pd.DataFrame(cyc, columns=["date", "account"]).drop_duplicates().assign(in_cycle=1)
    f = f.merge(cyc, on=["date", "account"], how="left").fillna({"in_cycle": 0})
    # own-history z-score of value (past 20 days only — no leakage)
    f = f.sort_values(["account", "date"])
    lv = np.log1p(f.gross_value)
    r = lv.groupby(f.account).transform(lambda s: s.shift(1).rolling(20, min_periods=3).mean())
    sd = lv.groupby(f.account).transform(lambda s: s.shift(1).rolling(20, min_periods=3).std())
    f["value_z_vs_own_history"] = ((lv - r) / sd.replace(0, np.nan)).fillna(0).clip(-10, 10)
    # share of the symbol's daily volume this account represents (max over its symbols)
    sv = t.groupby(["date", "symbol"]).qty.sum().rename("sym_vol")
    av = t.groupby(["date", "account", "symbol"]).qty.sum().rename("acc_vol").reset_index().join(sv, on=["date", "symbol"])
    av["share"] = av.acc_vol / av.sym_vol
    f = f.merge(av.groupby(["date", "account"]).share.max().rename("sym_day_volume_share").reset_index(), on=["date", "account"])
    # co-trader overlap: how many other accounts traded the same illiquid symbols same day, same direction
    il = t[t.illiquid == 1].groupby(["date", "symbol", "side"]).account.nunique().rename("n_same").reset_index()
    ti = t[t.illiquid == 1].merge(il, on=["date", "symbol", "side"])
    f = f.merge(ti.groupby(["date", "account"]).n_same.max().rename("co_trader_overlap").reset_index(), on=["date", "account"], how="left").fillna({"co_trader_overlap": 0})
    # price deviation from symbol-day VWAP
    vw = t.groupby(["date", "symbol"]).apply(lambda x: (x.value.sum() / x.qty.sum()), include_groups=False).rename("vwap")
    t = t.join(vw, on=["date", "symbol"]); t["dev"] = (t.price / t.vwap - 1).abs() * 1e4
    f = f.merge(t.groupby(["date", "account"]).dev.mean().rename("px_dev_bps").reset_index(), on=["date", "account"])
    # round-trip with the SAME counterparty in the SAME symbol (wash signature) vs one-way crosses (family rebalancing)
    c = t[t.counterparty >= 0].copy(); c["pair"] = np.minimum(c.account, c.counterparty).astype(str) + "-" + np.maximum(c.account, c.counterparty).astype(str)
    rt = c.groupby(["date", "account", "pair", "symbol"]).side.nunique().rename("both").reset_index()
    rt = rt.assign(rt=(rt.both == 2).astype(float)).groupby(["date", "account"]).rt.mean().rename("cp_round_trip_share").reset_index()
    f = f.merge(rt, on=["date", "account"], how="left").fillna({"cp_round_trip_share": 0})
    f = f.merge(c.groupby(["date", "account"]).counterparty.nunique().rename("cp_degree").reset_index(), on=["date", "account"], how="left").fillna({"cp_degree": 0})
    # 5-day trailing crowding (subtle pumps run over several days)
    f = f.sort_values(["account", "date"])
    f["crowd_5d"] = f.groupby("account").co_trader_overlap.transform(lambda s: s.rolling(5, min_periods=1).mean())
    # label noise: analysts miss ~8% of true cases and mis-tag ~0.2% of normals; train on noisy, evaluate on truth
    rng = np.random.default_rng(11); u = rng.random(len(f))
    f["label_noisy"] = np.where(f.label == 1, (u > .08).astype(int), (u < .002).astype(int))
    f = f.merge(accounts, on="account")
    return f.sort_values(["date", "account"]).reset_index(drop=True)

if __name__ == "__main__":
    tr = pd.read_parquet("data/trades.parquet"); ac = pd.read_parquet("data/accounts.parquet")
    f = build(tr, ac); f.to_parquet("data/features.parquet")
    print(f.shape, "positive rate", round(f.label.mean(), 4))
