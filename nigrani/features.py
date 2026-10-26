"""Account-day features for trade surveillance. Label = account-day had any manipulative trade."""
import networkx as nx
import numpy as np
import pandas as pd

BASE_FEATURES = ["n_trades", "gross_value", "n_symbols", "illiquid_share", "buy_sell_balance",
            "counterparty_share", "top_cp_concentration", "repeat_cp_trades", "in_cycle",
            "sym_conc", "value_z_vs_own_history", "sym_day_volume_share", "co_trader_overlap", "px_dev_bps", "cp_round_trip_share", "cp_degree", "crowd_5d"]
# v3: market-level, multi-day, synchronisation and entity-resolution features aimed at pump-and-dump
MARKET_FEATURES = ["mkt_ret_3d", "mkt_vol_z", "impact_bps", "prior_net_5d", "reversal_score", "streak_days",
                   "coord_entry", "sync_peers_5d", "entity_size", "entity_peers_same_side", "entity_peers_5d"]
FEATURES = BASE_FEATURES + MARKET_FEATURES

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
    f = f.merge(market_features(trades), on=["date", "account"], how="left")
    f = f.merge(entity_features(trades, accounts), on=["date", "account"], how="left")
    f[MARKET_FEATURES] = f[MARKET_FEATURES].fillna(0.0)
    # label noise: analysts miss ~8% of true cases and mis-tag ~0.2% of normals; train on noisy, evaluate on truth
    rng = np.random.default_rng(11); u = rng.random(len(f))
    f["label_noisy"] = np.where(f.label == 1, (u > .08).astype(int), (u < .002).astype(int))
    f = f.merge(accounts[["account", "acct_type"]], on="account")
    return f.sort_values(["date", "account"]).reset_index(drop=True)


def _day_index(t: pd.DataFrame) -> pd.Series:
    days = np.sort(t.date.unique()); return t.date.map({d: i for i, d in enumerate(days)})


def market_features(trades: pd.DataFrame) -> pd.DataFrame:
    """Symbol-level price/volume impact plus per-(account, symbol) rolling position over the past days.

    Everything is computed from the same day or earlier, so it is available at end-of-day scoring time.
    """
    t = trades[["date", "account", "symbol", "side", "qty", "price"]].copy()
    t["di"] = _day_index(t); t["value"] = t.qty * t.price; t["sq"] = np.where(t.side == "B", 1, -1) * t.qty
    sd = t.groupby(["symbol", "di"]).agg(vol=("qty", "sum"), val=("value", "sum")).reset_index()
    sd["vwap"] = sd.val / sd.vol
    full = pd.MultiIndex.from_product([sd.symbol.unique(), range(t.di.max() + 1)], names=["symbol", "di"])
    sd = sd.set_index(["symbol", "di"]).reindex(full).reset_index()
    sd["vwap"] = sd.groupby("symbol").vwap.ffill(); sd["vol"] = sd.vol.fillna(0)
    g = sd.groupby("symbol")
    sd["ret_3d"] = (sd.vwap / g.vwap.shift(3) - 1).fillna(0) * 1e4
    lv = np.log1p(sd.vol)
    mu = lv.groupby(sd.symbol).transform(lambda x: x.shift(1).rolling(20, min_periods=5).mean())
    sg = lv.groupby(sd.symbol).transform(lambda x: x.shift(1).rolling(20, min_periods=5).std())
    sd["vol_z"] = ((lv - mu) / sg.replace(0, np.nan)).fillna(0).clip(-10, 10)
    sd["prev_vwap"] = g.vwap.shift(1)
    t = t.merge(sd[["symbol", "di", "ret_3d", "vol_z", "prev_vwap"]], on=["symbol", "di"], how="left")
    t["impact"] = (t.price / t.prev_vwap - 1).fillna(0) * 1e4 * np.sign(t.sq)  # buying above / selling below yesterday
    # per account-symbol-day net position and rolling history (previous 5 trading days)
    asd = t.groupby(["account", "symbol", "di"]).agg(net=("sq", "sum"), gross=("qty", "sum"), value=("value", "sum"),
                                                      ret_3d=("ret_3d", "first"), vol_z=("vol_z", "first"), impact=("impact", "mean")).reset_index()
    asd = asd.sort_values(["account", "symbol", "di"])
    key = asd.account.astype(np.int64) * 10_000 + asd.symbol.str[3:].astype(int)
    prior_net, streak, prev_seen = [], [], []
    for _, grp in asd.groupby(key, sort=False):
        di = grp.di.to_numpy(); net = grp.net.to_numpy(); n = len(di)
        pn = np.zeros(n); st = np.zeros(n); ps = np.full(n, 99.0)
        for i in range(n):
            j = i - 1
            while j >= 0 and di[i] - di[j] <= 5:
                pn[i] += net[j]; st[i] += 1; j -= 1
            if i: ps[i] = di[i] - di[i - 1]
        prior_net.append(pn); streak.append(st); prev_seen.append(ps)
    order = asd.groupby(key, sort=False).ngroup().argsort(kind="stable")  # align concatenation with asd order
    asd = asd.iloc[order]
    asd["prior_net"] = np.concatenate(prior_net); asd["streak"] = np.concatenate(streak); asd["gap"] = np.concatenate(prev_seen)
    asd["prior_net_n"] = asd.prior_net / (asd.gross + asd.prior_net.abs() + 1)
    asd["reversal"] = np.where(np.sign(asd.net) == -np.sign(asd.prior_net), np.minimum(asd.net.abs(), asd.prior_net.abs()) / (asd.gross + 1), 0)
    # coordinated entry: how many accounts opened a fresh buy position in this symbol today (not traded in prior 10 days)
    asd["fresh_buy"] = ((asd.gap > 10) & (asd.net > 0)).astype(int)
    fe = asd.groupby(["symbol", "di"]).fresh_buy.sum().rename("n_fresh")
    asd = asd.join(fe, on=["symbol", "di"]); asd["coord"] = asd.fresh_buy * (asd.n_fresh - 1)
    asd["sync"] = _sync_peers(asd)
    w = asd.value / asd.groupby(["account", "di"]).value.transform("sum")
    asd = asd.assign(**{c: asd[c] * w for c in ["ret_3d", "vol_z", "impact"]})
    out = asd.groupby(["account", "di"]).agg(mkt_ret_3d=("ret_3d", "sum"), mkt_vol_z=("vol_z", "sum"), impact_bps=("impact", "sum"),
                                              prior_net_5d=("prior_net_n", lambda x: x.abs().max()), reversal_score=("reversal", "max"),
                                              streak_days=("streak", "max"), coord_entry=("coord", "max"), sync_peers_5d=("sync", "max")).reset_index()
    days = np.sort(trades.date.unique()); out["date"] = days[out.di.to_numpy()]
    return out.drop(columns="di")


def _sync_peers(asd: pd.DataFrame, window: int = 5) -> np.ndarray:
    """For each account-symbol-day: number of OTHER accounts that traded the same symbol in the same
    direction on at least 2 of the last `window` days that this account also traded it (cross-account synchronisation)."""
    x = asd[["account", "symbol", "di", "net"]].copy(); x["side"] = np.sign(x.net)
    res = np.zeros(len(x)); pos = {k: i for i, k in enumerate(x.index)}
    for _, g in x[x.side != 0].groupby(["symbol", "side"]):
        if len(g) < 2: continue
        accs = g.account.to_numpy(); days = g.di.to_numpy()
        by_day: dict[int, list[int]] = {}
        for a, d in zip(accs, days, strict=True): by_day.setdefault(int(d), []).append(int(a))
        for idx, a, d in zip(g.index, accs, days, strict=True):
            cnt: dict[int, int] = {}
            for dd in range(int(d) - window + 1, int(d) + 1):
                lst = by_day.get(dd)
                if not lst or a not in lst: continue
                if len(lst) > 80: continue  # liquid-stock crowds carry no coordination signal and are O(n^2)
                for b in lst:
                    if b != a: cnt[b] = cnt.get(b, 0) + 1
            res[pos[idx]] = sum(1 for v in cnt.values() if v >= 2)
    return res


def resolve_entities(accounts: pd.DataFrame) -> pd.Series:
    """Union-find over shared KYC attributes (address, phone, bank account) -> entity id per account."""
    parent = list(range(len(accounts)))
    def find(i: int) -> int:
        while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
        return i
    acc = accounts.reset_index(drop=True)
    for col in ["address_id", "phone_id", "bank_id"]:
        if col not in acc: continue
        for _, idx in acc.groupby(col).groups.items():
            idx = list(idx)
            for j in idx[1:]: parent[find(j)] = find(idx[0])
    return pd.Series([find(i) for i in range(len(acc))], index=acc.account.to_numpy(), name="entity")


def entity_features(trades: pd.DataFrame, accounts: pd.DataFrame) -> pd.DataFrame:
    ent = resolve_entities(accounts); size = ent.map(ent.value_counts())
    t = trades[["date", "account", "symbol", "side"]].drop_duplicates().copy()
    t["entity"] = t.account.map(ent); t["di"] = _day_index(t)
    same = t.groupby(["date", "entity", "symbol", "side"]).account.nunique().rename("n").reset_index()
    t = t.merge(same, on=["date", "entity", "symbol", "side"])
    out = t.groupby(["date", "account"]).n.max().sub(1).rename("entity_peers_same_side").reset_index()
    # linked accounts in the same symbol any day in the past 5 days (entity-level accumulation)
    es = t[["entity", "symbol", "di", "account"]].drop_duplicates()
    rows = []
    for (_, _), g in es.groupby(["entity", "symbol"]):
        if g.account.nunique() < 2: continue
        for a, d in g[["account", "di"]].drop_duplicates().itertuples(index=False):
            w = g[(g.di > d - 5) & (g.di <= d) & (g.account != a)]
            rows.append((a, d, w.account.nunique()))
    p5 = pd.DataFrame(rows, columns=["account", "di", "entity_peers_5d"]).groupby(["account", "di"]).max().reset_index()
    days = np.sort(trades.date.unique()); p5["date"] = days[p5.di.to_numpy()]
    out = out.merge(p5.drop(columns="di"), on=["date", "account"], how="left")
    out["entity_size"] = out.account.map(size).astype(float)
    return out


if __name__ == "__main__":
    tr = pd.read_parquet("data/trades.parquet"); ac = pd.read_parquet("data/accounts.parquet")
    f = build(tr, ac); f.to_parquet("data/features.parquet")
    print(f.shape, "positive rate", round(f.label.mean(), 4))
