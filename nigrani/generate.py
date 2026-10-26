"""Synthetic NSE-style client trade generator with injected, labelled manipulation.

Why synthetic: real broker client-level trades are private, and public labelled AML sets
(IBM AMLworld, Elliptic) need a Kaggle login and are bank transfers / crypto, not equity trades.
The patterns below mirror typologies described in SEBI orders: wash/self trades, circular
trading rings, and pump-and-dump in illiquid scrips. Everything is seeded and reproducible.
"""
import argparse

import numpy as np
import pandas as pd


def generate(n_accounts=2000, n_symbols=60, n_days=120, seed=7):
    rng = np.random.default_rng(seed)
    days = pd.bdate_range("2026-01-01", periods=n_days)
    liq = rng.lognormal(0, 1, n_symbols); illiquid = np.argsort(liq)[:15]
    base_px = rng.uniform(20, 2500, n_symbols)
    acct_type = rng.choice(["retail", "hni", "active_trader", "nri"], n_accounts, p=[.75, .1, .12, .03])
    rows = []; tid = 0; PROP = 0
    family = (np.arange(n_accounts) + rng.integers(2, 50, n_accounts)) % n_accounts
    # KYC attributes for entity resolution. Families share an address (legit); some manipulator groups
    # share a phone or bank account (mule / proxy accounts); random co-tenancy adds realistic noise.
    address = np.arange(n_accounts).copy(); phone = np.arange(n_accounts) + 10_000; bank = np.arange(n_accounts) + 20_000
    for a in range(n_accounts):
        if rng.random() < .5: address[family[a]] = address[a]
    for _ in range(80):  # unrelated people at the same building / PG / office address
        grp = rng.choice(n_accounts, rng.integers(2, 6), replace=False); address[grp] = address[grp[0]]
    def link(grp, p):
        grp = np.asarray(grp)
        for x in grp[1:]:
            if rng.random() < p:
                arr = phone if rng.random() < .6 else bank; arr[x] = arr[grp[0]]
    def add(d, a, cp, s, side, qty, px, label, typ):
        nonlocal tid
        tid += 1
        rows.append((tid, d, a, cp, s, side, max(1, int(qty)), round(px, 2), label, typ))
    for di, d in enumerate(days):
        active = rng.random(n_accounts) < np.where(acct_type == "active_trader", .6, .12)
        for a in np.nonzero(active)[0]:
            k = rng.poisson(12 if acct_type[a] == "active_trader" else 2) + 1
            for _ in range(k):
                s = rng.choice(n_symbols, p=liq / liq.sum())
                qty = rng.lognormal(3 + (acct_type[a] == "hni") * 2, 1)
                add(d, a, -1, s, rng.choice(["B", "S"]), qty + 1, base_px[s] * rng.normal(1, .01), 0, "normal")
        # --- legitimate internal crosses (removes the 'counterparty => fraud' leak) ---
        for _ in range(rng.integers(8, 16)):  # family / HUF accounts rebalancing between each other
            a = rng.integers(n_accounts); b = family[a]; s = rng.choice(n_symbols, p=liq / liq.sum())
            for _ in range(rng.integers(1, 4)):
                q = rng.lognormal(4, .8); p = base_px[s] * rng.normal(1, .006)
                add(d, a, b, s, "S", q, p, 0, "legit_family_cross"); add(d, b, a, s, "B", q, p, 0, "legit_family_cross")
        for _ in range(rng.integers(20, 40)):  # prop desk / market-maker crosses with clients
            a = rng.integers(1, n_accounts); s = rng.choice(n_symbols)
            q = rng.lognormal(4, 1); p = base_px[s] * rng.normal(1, .005); sd = rng.choice(["B", "S"])
            add(d, a, PROP, s, sd, q, p, 0, "legit_prop_cross"); add(d, PROP, a, s, "S" if sd == "B" else "B", q, p, 0, "legit_prop_cross")
        if rng.random() < .3:  # legit triangular rebalancing among a family of 3 (looks like a ring)
            a = rng.integers(n_accounts); ring = [a, family[a], (family[a] + 7) % n_accounts]; s = rng.choice(n_symbols)
            for i, x in enumerate(ring):
                q = rng.lognormal(4, .6); add(d, x, ring[(i + 1) % 3], s, "S", q, base_px[s], 0, "legit_family_ring"); add(d, ring[(i + 1) % 3], x, s, "B", q, base_px[s], 0, "legit_family_ring")
        if rng.random() < .15:  # news-driven / momentum crowd buying an illiquid scrip (legit, borderline)
            s = rng.choice(illiquid); crowd = rng.choice(n_accounts, rng.integers(6, 20), replace=False)
            for a in crowd:
                add(d, a, -1, s, "B", rng.lognormal(5, .8), base_px[s] * (1 + rng.uniform(.01, .08)), 0, "legit_news_crowd")
        # --- injected manipulation ---
        if rng.random() < .35:  # wash trades: same beneficial owner on both sides (account pair)
            a = rng.integers(n_accounts); b = (a + 1) % n_accounts; s = rng.choice(illiquid); link([a, b], .4)
            for _ in range(rng.integers(4, 15)):
                q = rng.lognormal(5, .5); p = base_px[s] * rng.normal(1.002, .003)
                add(d, a, b, s, "B", q, p, 1, "wash"); add(d, b, a, s, "S", q, p, 1, "wash")
        if rng.random() < .25:  # circular ring of 3-5 accounts
            ring = rng.choice(n_accounts, rng.integers(3, 6), replace=False); link(ring, .3); s = rng.choice(illiquid)
            q = rng.lognormal(5, .4)
            for r in range(rng.integers(2, 5)):
                for i, a in enumerate(ring):
                    b = ring[(i + 1) % len(ring)]; p = base_px[s] * (1 + .01 * r)
                    add(d, a, b, s, "S", q, p, 1, "circular"); add(d, b, a, s, "B", q, p, 1, "circular")
        if di % 11 == 3:  # subtle pump: small group, small size, mixed with normal trades, liquid-ish stock sometimes
            grp = rng.choice(n_accounts, rng.integers(2, 5), replace=False); link(grp, .35); s = rng.choice(illiquid if rng.random() < .6 else np.arange(n_symbols))
            for j in range(4):
                if di + j >= n_days: break
                for a in grp:
                    for _ in range(rng.integers(1, 3)):
                        add(days[di + j], a, -1, s, "B" if j < 2 else "S", rng.lognormal(4.5, .7), base_px[s] * (1 + .02 * min(j, 2)), 1, "pump_dump_subtle")
                    s2 = rng.integers(n_symbols); add(days[di + j], a, -1, s2, rng.choice(["B", "S"]), rng.lognormal(3, 1), base_px[s2] * rng.normal(1, .01), 0, "normal")
        if di % 15 == 5:  # pump & dump: group accumulates then dumps over 5 days
            grp = rng.choice(n_accounts, rng.integers(4, 9), replace=False); link(grp, .35); s = rng.choice(illiquid)
            for j in range(5):
                if di + j >= n_days: break
                dj = days[di + j]
                for a in grp:
                    side = "B" if j < 3 else "S"
                    add(dj, a, -1, s, side, rng.lognormal(6, .5), base_px[s] * (1 + .06 * min(j, 3)), 1, "pump_dump")
        # hard negatives: legit block trades / arbitrage that look busy
        if rng.random() < .5:
            a = rng.integers(n_accounts); s = rng.choice(n_symbols)
            for _ in range(rng.integers(5, 20)):
                add(d, a, -1, s, rng.choice(["B", "S"]), rng.lognormal(5, .6), base_px[s] * rng.normal(1, .004), 0, "legit_block")
    df = pd.DataFrame(rows, columns=["trade_id", "date", "account", "counterparty", "symbol", "side", "qty", "price", "label", "typology"])
    df["symbol"] = "SYM" + df.symbol.astype(str).str.zfill(3)
    df["illiquid"] = df.symbol.isin(["SYM" + str(i).zfill(3) for i in illiquid]).astype(int)
    accts = pd.DataFrame({"account": range(n_accounts), "acct_type": acct_type, "address_id": address, "phone_id": phone, "bank_id": bank})
    return df, accts

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--seed", type=int, default=7); a = ap.parse_args()
    t, acc = generate(seed=a.seed)
    t.to_parquet("data/trades.parquet"); acc.to_parquet("data/accounts.parquet")
    print(len(t), "trades;", t.label.mean().round(4), "manipulative share;", t.typology.value_counts().to_dict())
