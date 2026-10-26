"""SQLite persistence (SQLAlchemy 2.x ORM) for the alert lifecycle, cases, audit trail and analyst feedback."""
from __future__ import annotations

import datetime as dt

from sqlalchemy import ForeignKey, String, Text, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


def utcnow() -> dt.datetime: return dt.datetime.now(dt.UTC).replace(tzinfo=None)


class Base(DeclarativeBase): pass


class Case(Base):
    __tablename__ = "cases"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(32), default="open", index=True)
    owner: Mapped[str | None] = mapped_column(String(64), default=None)
    summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[dt.datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(default=utcnow, onupdate=utcnow)
    alerts: Mapped[list[Alert]] = relationship(back_populates="case")
    notes: Mapped[list[CaseNote]] = relationship(back_populates="case", order_by="CaseNote.id")


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)  # "YYYY-MM-DD:account"
    date: Mapped[dt.date] = mapped_column(index=True)
    account: Mapped[int] = mapped_column(index=True)
    score: Mapped[float] = mapped_column(index=True)
    pattern: Mapped[str] = mapped_column(String(16), default="unknown", index=True)
    priority: Mapped[str] = mapped_column(String(8), index=True)
    model_version: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    assignee: Mapped[str | None] = mapped_column(String(64), default=None, index=True)
    disposition: Mapped[str | None] = mapped_column(String(32), default=None)
    escalation_reason: Mapped[str | None] = mapped_column(Text, default=None)
    case_id: Mapped[int | None] = mapped_column(ForeignKey("cases.id"), default=None, index=True)
    created_at: Mapped[dt.datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(default=utcnow, onupdate=utcnow)
    closed_at: Mapped[dt.datetime | None] = mapped_column(default=None)
    case: Mapped[Case | None] = relationship(back_populates="alerts")
    events: Mapped[list[AlertEvent]] = relationship(back_populates="alert", order_by="AlertEvent.id")


class AlertEvent(Base):
    __tablename__ = "alert_events"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    alert_id: Mapped[str] = mapped_column(ForeignKey("alerts.id"), index=True)
    action: Mapped[str] = mapped_column(String(32))
    actor: Mapped[str] = mapped_column(String(64))
    detail: Mapped[str] = mapped_column(Text, default="")
    ts: Mapped[dt.datetime] = mapped_column(default=utcnow)
    alert: Mapped[Alert] = relationship(back_populates="events")


class CaseNote(Base):
    __tablename__ = "case_notes"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    author: Mapped[str] = mapped_column(String(64))
    body: Mapped[str] = mapped_column(Text)
    ts: Mapped[dt.datetime] = mapped_column(default=utcnow)
    case: Mapped[Case] = relationship(back_populates="notes")


class Feedback(Base):
    __tablename__ = "feedback"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    alert_id: Mapped[str] = mapped_column(ForeignKey("alerts.id"), index=True)
    date: Mapped[dt.date] = mapped_column()
    account: Mapped[int] = mapped_column()
    verdict: Mapped[str] = mapped_column(String(32))
    label: Mapped[int | None] = mapped_column(default=None)  # 1 / 0 / None (needs_more_info is not a label)
    analyst: Mapped[str] = mapped_column(String(64))
    note: Mapped[str] = mapped_column(Text, default="")
    ts: Mapped[dt.datetime] = mapped_column(default=utcnow)
    used_in_version: Mapped[str | None] = mapped_column(String(16), default=None)


def make_engine(url: str) -> Engine:
    eng = create_engine(url, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})
    Base.metadata.create_all(eng); return eng


def make_sessionmaker(url: str) -> sessionmaker:
    return sessionmaker(make_engine(url), expire_on_commit=False)
