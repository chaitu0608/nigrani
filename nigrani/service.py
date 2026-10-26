"""Service layer: the single source of truth behind the REST API, the dashboard and the MCP server.

Nothing here exposes ground-truth labels or typologies; those exist only in offline evaluation.
"""
from __future__ import annotations

import datetime as dt
import os
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from functools import cached_property
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from nigrani import registry
from nigrani.db import Alert, AlertEvent, Case, CaseNote, Feedback, make_sessionmaker, utcnow
from nigrani.features import resolve_entities

ROOT = Path(__file__).resolve().parent.parent

ALERT_STATUSES = ("open", "assigned", "escalated", "closed")
DISPOSITIONS = {"true_positive": 1, "false_positive": 0, "benign_explained": 0}
VERDICTS = {**DISPOSITIONS, "needs_more_info": None}
CASE_STATUSES = ("open", "under_review", "str_filed", "closed_no_action")
TRANSITIONS: dict[str, set[str]] = {  # action -> allowed source statuses
    "assign": {"open", "assigned", "escalated"},
    "escalate": {"open", "assigned"},
    "close": {"open", "assigned", "escalated"},
    "reopen": {"closed"},
}


class NotFound(LookupError): pass


class InvalidTransition(ValueError): pass


def alert_id(date: Any, account: int) -> str: return f"{str(date)[:10]}:{int(account)}"


def parse_alert_id(aid: str) -> tuple[pd.Timestamp, int]:
    try:
        d, a = aid.split(":"); return pd.Timestamp(d), int(a)
    except Exception as e:
        raise NotFound(f"malformed alert id {aid!r}; expected YYYY-MM-DD:account") from e


def psi(ref: np.ndarray, cur: np.ndarray, bins: int = 10) -> float:
    edges = np.unique(np.quantile(ref, np.linspace(0, 1, bins + 1)))
    if len(edges) < 3: return 0.0  # (near-)constant feature: PSI undefined, treat as stable
    edges[0], edges[-1] = -np.inf, np.inf
    r = np.histogram(ref, edges)[0] / len(ref); c = np.histogram(cur, edges)[0] / max(1, len(cur))
    r, c = np.clip(r, 1e-4, None), np.clip(c, 1e-4, None)
    return float(np.sum((c - r) * np.log(c / r)))


class SurveillanceService:
    def __init__(self, db_url: str | None = None, data_dir: Path | None = None):
        self.db_url = db_url or os.environ.get("NIGRANI_DB", f"sqlite:///{ROOT / 'artifacts' / 'nigrani.db'}")
        self.data_dir = Path(data_dir or ROOT / "data")
        self.Session: sessionmaker = make_sessionmaker(self.db_url)
        self._lock = threading.RLock(); self._version: str | None = None; self._cache: dict[str, Any] = {}

    # ---------------------------------------------------------------- model + data
    @contextmanager
    def session(self) -> Iterator[Session]:
        with self.Session() as s:
            try:
                yield s; s.commit()
            except Exception:
                s.rollback(); raise

    def _load(self) -> None:
        with self._lock:
            v = registry.index()["production"]
            if v is None: raise FileNotFoundError("no production model in registry; run `make train`")
            if v != self._version:
                b = registry.load(v); meta = registry.metadata(v)
                sc = pd.read_parquet(registry.REG / v / "scored.parquet")
                self._cache = {"bundle": b, "meta": meta, "scored": sc.drop(columns=["label", "typ"], errors="ignore")}
                self._version = v

    @property
    def version(self) -> str: self._load(); return str(self._version)

    @property
    def bundle(self) -> dict[str, Any]: self._load(); return self._cache["bundle"]

    @property
    def meta(self) -> dict[str, Any]: self._load(); return self._cache["meta"]

    @property
    def scored(self) -> pd.DataFrame: self._load(); return self._cache["scored"]

    @property
    def features(self) -> list[str]: return list(self.bundle["features"])

    @property
    def threshold(self) -> float: return float(self.bundle["threshold"])

    @cached_property
    def trades(self) -> pd.DataFrame:
        return pd.read_parquet(self.data_dir / "trades.parquet").drop(columns=["label", "typology"])

    @cached_property
    def accounts(self) -> pd.DataFrame:
        a = pd.read_parquet(self.data_dir / "accounts.parquet"); a["entity"] = resolve_entities(a).reindex(a.account).to_numpy(); return a

    def ready(self) -> dict[str, Any]:
        checks: dict[str, Any] = {}
        try: checks["model"] = self.version
        except Exception as e: checks["model"] = f"error: {e}"
        try:
            with self.session() as s: s.execute(select(func.count(Alert.id))).scalar_one()
            checks["database"] = "ok"
        except Exception as e: checks["database"] = f"error: {e}"
        try: checks["trades"] = int(len(self.trades))
        except Exception as e: checks["trades"] = f"error: {e}"
        checks["ready"] = all(not str(v).startswith("error") for v in checks.values())
        return checks

    # ---------------------------------------------------------------- scoring + explanation
    def _frame(self, rows: list[dict[str, float]]) -> pd.DataFrame:
        missing = sorted({f for r in rows for f in self.features if f not in r})
        if missing: raise ValueError(f"missing features: {missing}")
        df = pd.DataFrame([{f: float(r[f]) for f in self.features} for r in rows])
        df["typ"] = "unknown"; return df

    def _pattern(self, df: pd.DataFrame) -> list[str]:
        sc = self.bundle["scorer"]
        if hasattr(sc, "head_scores"):
            h = sc.head_scores(df); return ["network" if n >= p else "pump" for n, p in zip(h["network"], h["pump"], strict=True)]
        return ["unknown"] * len(df)

    def score_batch(self, rows: list[dict[str, float]]) -> list[dict[str, Any]]:
        if not rows: return []
        if len(rows) > 5000: raise ValueError("batch too large (max 5000 rows)")
        df = self._frame(rows); p = self.bundle["scorer"].predict_proba(df); pat = self._pattern(df)
        return [{"score": round(float(x), 4), "alert": bool(x >= self.threshold), "pattern": pt, "threshold": round(self.threshold, 4),
                 "model_version": self.version} for x, pt in zip(p, pat, strict=True)]

    def score(self, features: dict[str, float]) -> dict[str, Any]: return self.score_batch([features])[0]

    def explain(self, features: dict[str, float], top_k: int = 8) -> dict[str, Any]:
        df = self._frame([features]); sv = self.bundle["scorer"].shap_values(df)[0]
        order = np.argsort(-np.abs(sv))[:top_k]
        return {**self.score(features), "base": "log-odds contributions (SHAP TreeExplainer)",
                "top_reasons": [{"feature": self.features[i], "value": round(float(df.iloc[0][self.features[i]]), 4), "shap": round(float(sv[i]), 4)} for i in order]}

    def _scored_row(self, aid: str) -> pd.Series:
        d, a = parse_alert_id(aid); s = self.scored; r = s[(s.date == d) & (s.account == a)]
        if r.empty: raise NotFound(f"no scored account-day {aid}")
        return r.iloc[0]

    def explain_account_day(self, aid: str, top_k: int = 8) -> dict[str, Any]:
        r = self._scored_row(aid); return {"alert_id": aid, **self.explain({f: r[f] for f in self.features}, top_k)}

    # ---------------------------------------------------------------- alert generation + queue
    def live_start(self) -> pd.Timestamp: return pd.Timestamp(self.meta["data"]["test_start"])

    def sync_alerts(self, budget: str = "1.0%", since: str | None = None) -> dict[str, Any]:
        thr = float(self.bundle["thresholds"][budget]); hi = float(self.bundle["thresholds"].get("0.5%", thr))
        s = self.scored; start = pd.Timestamp(since) if since else self.live_start()
        rows = s[(s.date >= start) & (s.score >= thr)]
        pats = self._pattern(rows.assign(typ="unknown")) if len(rows) else []
        created = 0
        with self.session() as ses:
            existing = set(ses.scalars(select(Alert.id)).all())
            for r, pat in zip(rows.itertuples(), pats, strict=True):
                aid = alert_id(r.date, r.account)
                if aid in existing: continue
                ses.add(Alert(id=aid, date=pd.Timestamp(r.date).date(), account=int(r.account), score=round(float(r.score), 4), pattern=pat,
                              priority="high" if r.score >= hi else "medium", model_version=self.version))
                ses.add(AlertEvent(alert_id=aid, action="created", actor="system", detail=f"score {r.score:.4f} >= {budget} budget threshold {thr:.4f}"))
                created += 1
        return {"created": created, "candidates": len(rows), "threshold": round(thr, 4), "budget": budget, "model_version": self.version}

    @staticmethod
    def _alert_dict(a: Alert) -> dict[str, Any]:
        return {"alert_id": a.id, "date": a.date.isoformat(), "account": a.account, "score": a.score, "pattern": a.pattern, "priority": a.priority,
                "status": a.status, "assignee": a.assignee, "disposition": a.disposition, "case_id": a.case_id, "model_version": a.model_version,
                "escalation_reason": a.escalation_reason, "created_at": a.created_at.isoformat(), "updated_at": a.updated_at.isoformat(),
                "closed_at": a.closed_at.isoformat() if a.closed_at else None}

    def list_alerts(self, status: str | None = None, assignee: str | None = None, pattern: str | None = None, priority: str | None = None,
                    account: int | None = None, min_score: float | None = None, date_from: str | None = None, date_to: str | None = None,
                    page: int = 1, page_size: int = 25, sort: str = "-score") -> dict[str, Any]:
        if page < 1 or not 1 <= page_size <= 200: raise ValueError("page >= 1 and 1 <= page_size <= 200")
        q = select(Alert)
        if status:
            if status not in ALERT_STATUSES: raise ValueError(f"status must be one of {ALERT_STATUSES}")
            q = q.where(Alert.status == status)
        if assignee: q = q.where(Alert.assignee == assignee)
        if pattern: q = q.where(Alert.pattern == pattern)
        if priority: q = q.where(Alert.priority == priority)
        if account is not None: q = q.where(Alert.account == account)
        if min_score is not None: q = q.where(Alert.score >= min_score)
        if date_from: q = q.where(Alert.date >= dt.date.fromisoformat(date_from))
        if date_to: q = q.where(Alert.date <= dt.date.fromisoformat(date_to))
        col = {"score": Alert.score, "date": Alert.date, "updated_at": Alert.updated_at, "account": Alert.account}.get(sort.lstrip("-"))
        if col is None: raise ValueError("sort must be one of score,date,updated_at,account (prefix - for descending)")
        q = q.order_by(col.desc() if sort.startswith("-") else col.asc(), Alert.id)
        with self.session() as s:
            total = s.execute(select(func.count()).select_from(q.subquery())).scalar_one()
            items = s.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()
            return {"items": [self._alert_dict(a) for a in items], "total": total, "page": page, "page_size": page_size}

    def _get(self, s: Session, aid: str) -> Alert:
        a = s.get(Alert, aid)
        if a is None: raise NotFound(f"alert {aid} not found")
        return a

    def get_alert(self, aid: str, with_explanation: bool = True) -> dict[str, Any]:
        with self.session() as s:
            a = self._get(s, aid); out = self._alert_dict(a)
            out["events"] = [{"action": e.action, "actor": e.actor, "detail": e.detail, "ts": e.ts.isoformat()} for e in a.events]
        if with_explanation: out["explanation"] = self.explain_account_day(aid)
        return out

    def _transition(self, aid: str, action: str, actor: str, detail: str, mutate: Any) -> dict[str, Any]:
        with self.session() as s:
            a = self._get(s, aid)
            if a.status not in TRANSITIONS[action]: raise InvalidTransition(f"cannot {action} an alert in status '{a.status}'")
            mutate(a, s); s.add(AlertEvent(alert_id=aid, action=action, actor=actor, detail=detail)); a.updated_at = utcnow()
            s.flush(); return self._alert_dict(a)

    def assign(self, aid: str, assignee: str, actor: str) -> dict[str, Any]:
        if not assignee.strip(): raise ValueError("assignee required")
        def m(a: Alert, _: Session) -> None:
            a.assignee = assignee
            if a.status == "open": a.status = "assigned"
        return self._transition(aid, "assign", actor, f"assigned to {assignee}", m)

    def escalate(self, aid: str, reason: str, actor: str) -> dict[str, Any]:
        if len(reason.strip()) < 5: raise ValueError("escalation reason required (min 5 chars)")
        def m(a: Alert, _: Session) -> None: a.status = "escalated"; a.escalation_reason = reason; a.priority = "high"
        return self._transition(aid, "escalate", actor, reason, m)

    def close(self, aid: str, disposition: str, actor: str, note: str = "") -> dict[str, Any]:
        if disposition not in DISPOSITIONS: raise ValueError(f"disposition must be one of {sorted(DISPOSITIONS)}")
        def m(a: Alert, s: Session) -> None:
            a.status = "closed"; a.disposition = disposition; a.closed_at = utcnow()
            s.add(Feedback(alert_id=a.id, date=a.date, account=a.account, verdict=disposition, label=DISPOSITIONS[disposition], analyst=actor, note=note))
        return self._transition(aid, "close", actor, f"{disposition}: {note}".strip(": "), m)

    def reopen(self, aid: str, reason: str, actor: str) -> dict[str, Any]:
        def m(a: Alert, _: Session) -> None: a.status = "assigned" if a.assignee else "open"; a.disposition = None; a.closed_at = None
        return self._transition(aid, "reopen", actor, reason, m)

    def record_feedback(self, aid: str, verdict: str, actor: str, note: str = "") -> dict[str, Any]:
        if verdict not in VERDICTS: raise ValueError(f"verdict must be one of {sorted(VERDICTS)}")
        with self.session() as s:
            a = self._get(s, aid)
            s.add(Feedback(alert_id=aid, date=a.date, account=a.account, verdict=verdict, label=VERDICTS[verdict], analyst=actor, note=note))
            s.add(AlertEvent(alert_id=aid, action="feedback", actor=actor, detail=f"{verdict}: {note}".strip(": ")))
        return {"saved": True, **self.feedback_stats()}

    def feedback_stats(self) -> dict[str, Any]:
        with self.session() as s:
            rows = s.execute(select(Feedback.verdict, func.count()).group_by(Feedback.verdict)).all()
            unused = s.execute(select(func.count()).where(Feedback.label.is_not(None), Feedback.used_in_version.is_(None))).scalar_one()
        return {"by_verdict": {v: n for v, n in rows}, "labelled_not_yet_trained_on": unused}

    def queue_stats(self) -> dict[str, Any]:
        with self.session() as s:
            st = dict(s.execute(select(Alert.status, func.count()).group_by(Alert.status)).all())
            disp = dict(s.execute(select(Alert.disposition, func.count()).where(Alert.disposition.is_not(None)).group_by(Alert.disposition)).all())
            cases = dict(s.execute(select(Case.status, func.count()).group_by(Case.status)).all())
        tp, closed = disp.get("true_positive", 0), sum(disp.values())
        return {"alerts_by_status": {k: st.get(k, 0) for k in ALERT_STATUSES}, "dispositions": disp, "cases_by_status": cases,
                "analyst_precision": round(tp / closed, 4) if closed else None}

    # ---------------------------------------------------------------- cases
    @staticmethod
    def _case_dict(c: Case, full: bool = False) -> dict[str, Any]:
        out: dict[str, Any] = {"case_id": c.id, "title": c.title, "status": c.status, "owner": c.owner, "summary": c.summary,
                               "alert_ids": [a.id for a in c.alerts], "created_at": c.created_at.isoformat(), "updated_at": c.updated_at.isoformat()}
        if full: out["notes"] = [{"author": n.author, "body": n.body, "ts": n.ts.isoformat()} for n in c.notes]
        return out

    def create_case(self, title: str, alert_ids: list[str], actor: str, owner: str | None = None, summary: str = "") -> dict[str, Any]:
        if not title.strip(): raise ValueError("title required")
        with self.session() as s:
            c = Case(title=title, owner=owner or actor, summary=summary); s.add(c); s.flush()
            for aid in alert_ids:
                a = self._get(s, aid); a.case_id = c.id
                s.add(AlertEvent(alert_id=aid, action="linked_to_case", actor=actor, detail=f"case {c.id}"))
            s.add(CaseNote(case_id=c.id, author=actor, body=f"Case opened with alerts: {', '.join(alert_ids) or 'none'}")); s.flush()
            s.refresh(c); return self._case_dict(c, True)

    def _getc(self, s: Session, cid: int) -> Case:
        c = s.get(Case, cid)
        if c is None: raise NotFound(f"case {cid} not found")
        return c

    def get_case(self, cid: int) -> dict[str, Any]:
        with self.session() as s: return self._case_dict(self._getc(s, cid), True)

    def list_cases(self, status: str | None = None, owner: str | None = None, page: int = 1, page_size: int = 25) -> dict[str, Any]:
        if page < 1 or not 1 <= page_size <= 200: raise ValueError("page >= 1 and 1 <= page_size <= 200")
        q = select(Case)
        if status: q = q.where(Case.status == status)
        if owner: q = q.where(Case.owner == owner)
        with self.session() as s:
            total = s.execute(select(func.count()).select_from(q.subquery())).scalar_one()
            items = s.scalars(q.order_by(Case.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
            return {"items": [self._case_dict(c) for c in items], "total": total, "page": page, "page_size": page_size}

    def add_case_note(self, cid: int, body: str, actor: str) -> dict[str, Any]:
        if not body.strip(): raise ValueError("note body required")
        with self.session() as s:
            c = self._getc(s, cid); s.add(CaseNote(case_id=cid, author=actor, body=body)); c.updated_at = utcnow(); s.flush(); s.refresh(c)
            return self._case_dict(c, True)

    def link_alert(self, cid: int, aid: str, actor: str) -> dict[str, Any]:
        with self.session() as s:
            c = self._getc(s, cid); a = self._get(s, aid); a.case_id = cid
            s.add(AlertEvent(alert_id=aid, action="linked_to_case", actor=actor, detail=f"case {cid}")); s.flush(); s.refresh(c)
            return self._case_dict(c, True)

    def update_case(self, cid: int, actor: str, status: str | None = None, owner: str | None = None, summary: str | None = None) -> dict[str, Any]:
        if status and status not in CASE_STATUSES: raise ValueError(f"case status must be one of {CASE_STATUSES}")
        with self.session() as s:
            c = self._getc(s, cid)
            if c.status in ("str_filed", "closed_no_action") and status and status != c.status:
                raise InvalidTransition(f"case {cid} is final ({c.status})")
            changes = []
            if status: c.status = status; changes.append(f"status={status}")
            if owner: c.owner = owner; changes.append(f"owner={owner}")
            if summary is not None: c.summary = summary; changes.append("summary updated")
            s.add(CaseNote(case_id=cid, author=actor, body="; ".join(changes) or "no change")); c.updated_at = utcnow(); s.flush(); s.refresh(c)
            return self._case_dict(c, True)

    # ---------------------------------------------------------------- investigation views
    def account_profile(self, account: int) -> dict[str, Any]:
        a = self.accounts[self.accounts.account == account]
        if a.empty: raise NotFound(f"account {account} not found")
        r = a.iloc[0]; linked = self.linked_accounts(account)
        return {"account": account, "acct_type": r.acct_type, "entity_id": int(r.entity), "linked_accounts": linked["linked"][:50],
                "n_linked": len(linked["linked"])}

    def linked_accounts(self, account: int) -> dict[str, Any]:
        acc = self.accounts; me = acc[acc.account == account]
        if me.empty: raise NotFound(f"account {account} not found")
        me = me.iloc[0]; out = []
        for col, name in [("address_id", "address"), ("phone_id", "phone"), ("bank_id", "bank_account")]:
            for b in acc[(acc[col] == me[col]) & (acc.account != account)].account:
                out.append({"account": int(b), "shared": name})
        merged: dict[int, list[str]] = {}
        for x in out: merged.setdefault(x["account"], []).append(x["shared"])
        same_entity = acc[(acc.entity == me.entity) & (acc.account != account)].account.astype(int).tolist()
        return {"account": account, "entity_id": int(me.entity), "linked": [{"account": k, "shared": v} for k, v in merged.items()],
                "entity_members": same_entity, "method": "union-find over shared address / phone / bank account (KYC)"}

    def account_timeline(self, account: int, end: str | None = None, days: int = 30) -> dict[str, Any]:
        s = self.scored; x = s[s.account == account]
        if end: x = x[x.date <= pd.Timestamp(end)]
        x = x.sort_values("date").tail(days)
        t = self.trades; tt = t[(t.account == account) & t.date.isin(x.date)]
        sym = tt.assign(v=tt.qty * tt.price, sq=np.where(tt.side == "B", 1, -1) * tt.qty).groupby(["date", "symbol"]).agg(net_qty=("sq", "sum"), value=("v", "sum")).reset_index()
        with self.session() as ses:
            alerted = {a.id: a.status for a in ses.scalars(select(Alert).where(Alert.account == account)).all()}
        days_out = []
        for r in x.itertuples():
            aid = alert_id(r.date, account); top = sym[sym.date == r.date].sort_values("value", ascending=False).head(5)
            days_out.append({"date": str(r.date)[:10], "score": round(float(r.score), 4), "n_trades": int(r.n_trades), "gross_value": round(float(r.gross_value), 2),
                             "alert_status": alerted.get(aid), "top_symbols": [{"symbol": y.symbol, "net_qty": int(y.net_qty), "value": round(float(y.value), 2)} for y in top.itertuples()]})
        return {"account": account, "threshold": round(self.threshold, 4), "days": days_out}

    def counterparty_network(self, account: int, date: str, window: int = 5) -> dict[str, Any]:
        """Graph around one account-day: direct trade edges, shared-KYC links and same-symbol/same-side co-trading
        over the trailing `window` trading days (the signature of coordinated pumps)."""
        d = pd.Timestamp(date); t = self.trades; all_days = np.sort(t.date.unique())
        if d not in set(all_days): raise NotFound(f"no trading on {date}")
        win = all_days[max(0, int(np.searchsorted(all_days, d)) - window + 1): int(np.searchsorted(all_days, d)) + 1]
        tw = t[t.date.isin(win)]
        edges: list[dict[str, Any]] = []
        x = tw[(tw.date == d) & (tw.counterparty >= 0) & ((tw.account == account) | (tw.counterparty == account))]
        for r in x.groupby(["account", "counterparty", "symbol", "side"]).qty.sum().reset_index().itertuples():
            if r.side == "S": edges.append({"source": int(r.account), "target": int(r.counterparty), "type": "trade", "symbol": r.symbol, "qty": int(r.qty)})
        mine = tw[tw.account == account].assign(sd=lambda z: z.side)[["date", "symbol", "sd"]].drop_duplicates()
        co = tw.merge(mine, left_on=["date", "symbol", "side"], right_on=["date", "symbol", "sd"])
        co = co[co.account != account].groupby(["account", "symbol"]).date.nunique().reset_index()
        for r in co[co.date >= 2].sort_values("date", ascending=False).head(40).itertuples():
            edges.append({"source": int(r.account), "target": account, "type": "co_trade", "symbol": r.symbol, "days": int(r.date)})
        for lk in self.linked_accounts(account)["linked"]:
            edges.append({"source": account, "target": lk["account"], "type": "kyc", "shared": lk["shared"]})
        ids = sorted({account} | {e["source"] for e in edges} | {e["target"] for e in edges})
        sc = self.scored[(self.scored.date == d) & self.scored.account.isin(ids)].set_index("account").score
        acc = self.accounts.set_index("account")
        nodes = [{"id": i, "focus": i == account, "score": round(float(sc.get(i, 0.0)), 4), "acct_type": str(acc.acct_type.get(i, "?")),
                  "entity_id": int(acc.entity.get(i, -1)), "alert": bool(sc.get(i, 0.0) >= self.threshold)} for i in ids]
        return {"account": account, "date": str(d)[:10], "window_days": [str(w)[:10] for w in win], "nodes": nodes, "edges": edges,
                "summary": {k: sum(e["type"] == k for e in edges) for k in ("trade", "co_trade", "kyc")}}

    def account_trades(self, account: int, date: str, limit: int = 200) -> list[dict[str, Any]]:
        t = self.trades; x = t[(t.account == account) & (t.date == pd.Timestamp(date))].head(limit)
        return [{"trade_id": int(r.trade_id), "symbol": r.symbol, "side": r.side, "qty": int(r.qty), "price": float(r.price),
                 "counterparty": int(r.counterparty) if r.counterparty >= 0 else None} for r in x.itertuples()]

    def draft_case_note(self, aid: str) -> str:
        e = self.explain_account_day(aid, 6); d, a = parse_alert_id(aid)
        net = self.counterparty_network(a, str(d)[:10]); tl = self.account_timeline(a, str(d)[:10], 10)
        try: al = self.get_alert(aid, with_explanation=False); status = f"{al['status']} (pattern head: {al['pattern']})"
        except NotFound: status = "not in alert queue"
        reasons = "\n".join(f"  - {r['feature']} = {r['value']} (SHAP {r['shap']:+.3f})" for r in e["top_reasons"])
        recent = ", ".join(f"{x['date']}:{x['score']}" for x in tl["days"][-5:])
        co = sorted({x["symbol"] for x in net["edges"] if x["type"] == "co_trade"})
        return (f"DRAFT surveillance case note: for analyst review, not a filed report\n"
                f"Alert {aid} | account {a} | trade date {str(d)[:10]} | status {status}\n"
                f"Model {e['model_version']} score {e['score']} vs threshold {e['threshold']}\n"
                f"Top drivers (SHAP):\n{reasons}\n"
                f"Network ({len(net['window_days'])}-day window): {net['summary']['trade']} direct counterparty legs, "
                f"{net['summary']['co_trade']} accounts co-trading the same side on 2+ days{(' in ' + ', '.join(co[:5])) if co else ''}, "
                f"{net['summary']['kyc']} KYC-linked accounts.\n"
                f"Recent daily scores: {recent}\n"
                "Analyst to verify: beneficial ownership of linked accounts, order-log intent (placement vs. cancellation), "
                "price impact versus market news, and whether an STR to FIU-IND is warranted.")

    def draft_case_summary(self, cid: int) -> str:
        c = self.get_case(cid); parts = [f"DRAFT case summary: case {cid} '{c['title']}' (status {c['status']}, owner {c['owner']})"]
        for aid in c["alert_ids"]:
            e = self.explain_account_day(aid, 3); parts.append(f"- {aid}: score {e['score']}; drivers " + ", ".join(r["feature"] for r in e["top_reasons"]))
        parts.append(f"{len(c['notes'])} notes on file. Not a filed report; requires analyst sign-off."); return "\n".join(parts)

    # ---------------------------------------------------------------- model governance
    def model_card(self) -> dict[str, Any]:
        m = self.meta
        return {"version": m["version"], "name": m["name"], "created_at": m["created_at"], "git_sha": m["git_sha"], "model": m["model"],
                "features": m["features"], "thresholds": {k: round(v, 4) for k, v in m["thresholds"].items()}, "deployed_budget": m["deployed_budget"],
                "protocol": m["protocol"], "data": m["data"], "cv": m["cv"], "test": m["test"], "global_shap_mean_abs": m["global_shap_mean_abs"],
                "label_noise": m["label_noise"], "retrain": m.get("retrain")}

    def model_versions(self) -> dict[str, Any]: return registry.index()

    def promote(self, version: str) -> dict[str, Any]:
        ix = registry.promote_version(version); self._load(); return ix

    def drift_report(self, recent_days: int | None = None, top: int = 30) -> dict[str, Any]:
        s = self.scored; live = self.live_start(); ref = s[s.date < live]; cur = s[s.date >= live]
        if recent_days: cur = cur[cur.date >= np.sort(cur.date.unique())[-recent_days]]
        vals = {f: round(psi(ref[f].to_numpy(float), cur[f].to_numpy(float)), 4) for f in self.features}
        vals["score"] = round(psi(ref.score.to_numpy(), cur.score.to_numpy()), 4)
        items = sorted(vals.items(), key=lambda kv: -kv[1])[:top]
        return {"reference": [str(ref.date.min())[:10], str(ref.date.max())[:10]], "current": [str(cur.date.min())[:10], str(cur.date.max())[:10]],
                "psi": dict(items), "rule": "PSI < 0.1 stable, 0.1-0.25 watch, > 0.25 investigate", "watch": [k for k, v in items if .1 < v <= .25],
                "investigate": [k for k, v in items if v > .25],
                "alert_rate": {"reference": round(float((ref.score >= self.threshold).mean()), 4), "current": round(float((cur.score >= self.threshold).mean()), 4)}}

    def retrain(self, actor: str, promote: bool = True, tolerance: float = .005) -> dict[str, Any]:
        """Retrain the production configuration with analyst dispositions as labels; promote only if the
        held-out calibration-block PR-AUC does not drop by more than `tolerance`."""
        from nigrani.train import retrain_with_feedback
        with self.session() as s:
            fb = pd.DataFrame([{"date": f.date, "account": f.account, "label": f.label, "id": f.id}
                               for f in s.scalars(select(Feedback).where(Feedback.label.is_not(None))).all()])
        if fb.empty: raise ValueError("no labelled analyst feedback yet; close alerts with a disposition first")
        res = retrain_with_feedback(self.meta["name"], fb, self.bundle["scorer"], parent=self.version, actor=actor)
        res["promoted"] = bool(promote and res["candidate_pr_auc"] >= res["production_pr_auc"] - tolerance)
        if res["promoted"]:
            registry.promote_version(res["version"]); self._load()
            with self.session() as s:
                for f in s.scalars(select(Feedback).where(Feedback.id.in_(fb.id.tolist()))).all(): f.used_in_version = res["version"]
        return res


_SERVICE: SurveillanceService | None = None


def get_service() -> SurveillanceService:
    global _SERVICE
    if _SERVICE is None: _SERVICE = SurveillanceService()
    return _SERVICE


def set_service(svc: SurveillanceService | None) -> None:
    global _SERVICE
    _SERVICE = svc
