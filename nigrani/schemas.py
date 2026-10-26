"""Pydantic request/response schemas for the public API."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Disposition = Literal["true_positive", "false_positive", "benign_explained"]
Verdict = Literal["true_positive", "false_positive", "benign_explained", "needs_more_info"]
CaseStatus = Literal["open", "under_review", "str_filed", "closed_no_action"]


class FeaturesIn(BaseModel):
    features: dict[str, float] = Field(..., description="All model features for one account-day")


class BatchIn(BaseModel):
    rows: list[dict[str, float]] = Field(..., min_length=1, max_length=5000)


class ScoreOut(BaseModel):
    score: float
    alert: bool
    pattern: str
    threshold: float
    model_version: str


class Reason(BaseModel):
    feature: str
    value: float
    shap: float


class ExplainOut(ScoreOut):
    base: str
    top_reasons: list[Reason]
    alert_id: str | None = None


class BatchOut(BaseModel):
    results: list[ScoreOut]
    n: int
    n_alerts: int


class AlertOut(BaseModel):
    alert_id: str
    date: str
    account: int
    score: float
    pattern: str
    priority: str
    status: str
    assignee: str | None
    disposition: str | None
    case_id: int | None
    model_version: str
    escalation_reason: str | None
    created_at: str
    updated_at: str
    closed_at: str | None


class Event(BaseModel):
    action: str
    actor: str
    detail: str
    ts: str


class AlertDetail(AlertOut):
    events: list[Event]
    explanation: ExplainOut | None = None


class Page(BaseModel):
    total: int
    page: int
    page_size: int


class AlertPage(Page):
    items: list[AlertOut]


class AssignIn(BaseModel):
    assignee: str = Field(..., min_length=1, max_length=64)


class EscalateIn(BaseModel):
    reason: str = Field(..., min_length=5, max_length=2000)


class CloseIn(BaseModel):
    disposition: Disposition
    note: str = Field("", max_length=4000)


class ReopenIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=2000)


class FeedbackIn(BaseModel):
    verdict: Verdict
    note: str = Field("", max_length=4000)


class SyncIn(BaseModel):
    budget: Literal["0.5%", "1.0%", "2.0%"] = "1.0%"
    since: str | None = None


class CaseIn(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    alert_ids: list[str] = []
    owner: str | None = None
    summary: str = ""


class CasePatch(BaseModel):
    status: CaseStatus | None = None
    owner: str | None = None
    summary: str | None = None


class NoteIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=8000)


class LinkIn(BaseModel):
    alert_id: str


class Note(BaseModel):
    author: str
    body: str
    ts: str


class CaseOut(BaseModel):
    case_id: int
    title: str
    status: str
    owner: str | None
    summary: str
    alert_ids: list[str]
    created_at: str
    updated_at: str
    notes: list[Note] | None = None


class CasePage(Page):
    items: list[CaseOut]


class PromoteIn(BaseModel):
    version: str


class RetrainIn(BaseModel):
    promote: bool = True
    tolerance: float = Field(.005, ge=0, le=.2)


class DraftOut(BaseModel):
    draft: str


class Loose(BaseModel):
    """Free-form JSON payloads (model card, network, timeline) documented in the README."""
    model_config = ConfigDict(extra="allow")


def loose(d: dict[str, Any]) -> Loose: return Loose(**d)
