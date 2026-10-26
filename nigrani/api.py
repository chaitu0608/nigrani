"""Production FastAPI app: API-key auth, Pydantic schemas, alert lifecycle, cases, monitoring, dashboard."""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from nigrani import schemas as S
from nigrani.service import InvalidTransition, NotFound, SurveillanceService, get_service

log = logging.getLogger("nigrani.api")
STATIC = Path(__file__).parent / "static"


DEMO = os.environ.get("NIGRANI_DEMO", "").lower() in {"1", "true", "yes"}
DEMO_ALLOWED_POSTS = {"/v1/score", "/v1/score/batch", "/v1/explain"}  # pure compute, no state change


def _keys() -> dict[str, tuple[str, str]]:
    default = "demo-key=demo:analyst,analyst-dev-key=analyst1:analyst" if DEMO else "analyst-dev-key=analyst1:analyst,admin-dev-key=admin:admin"
    raw = os.environ.get("NIGRANI_API_KEYS", default)
    out = {}
    for item in filter(None, (x.strip() for x in raw.split(","))):
        key, _, rest = item.partition("="); user, _, role = rest.partition(":"); out[key] = (user, role or "analyst")
    return out


class Principal:
    def __init__(self, user: str, role: str): self.user, self.role = user, role


def principal(x_api_key: Annotated[str | None, Header()] = None) -> Principal:
    k = _keys().get(x_api_key or "")
    if k is None: raise HTTPException(401, "missing or invalid X-API-Key")
    return Principal(*k)


def admin(p: Annotated[Principal, Depends(principal)]) -> Principal:
    if p.role != "admin": raise HTTPException(403, "admin role required")
    return p


Svc = Annotated[SurveillanceService, Depends(get_service)]
User = Annotated[Principal, Depends(principal)]
Admin = Annotated[Principal, Depends(admin)]

app = FastAPI(title="Nigrani surveillance API", version="3.0.0",
              description="Explainable trade surveillance for a stockbroker: scoring, alert lifecycle, cases, monitoring.")

# ------------------------------------------------------------------ metrics + request logging
METRICS: dict[str, Any] = {"requests": defaultdict(int), "latency_sum": defaultdict(float), "latency_count": defaultdict(int), "started": time.time()}
BUCKETS = (.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10)
HIST: dict[str, list[int]] = defaultdict(lambda: [0] * (len(BUCKETS) + 1))


@app.middleware("http")
async def observe(request: Request, call_next: Any) -> Any:
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]; request.state.rid = rid; t0 = time.perf_counter()
    try:
        resp = await call_next(request); status = resp.status_code
    except Exception:
        log.exception("unhandled error rid=%s", rid); status = 500
        resp = JSONResponse({"error": {"code": "internal_error", "message": "internal server error", "request_id": rid}}, 500)
    dur = time.perf_counter() - t0
    route = request.scope.get("route"); path = getattr(route, "path", "unmatched")
    METRICS["requests"][(request.method, path, status)] += 1; METRICS["latency_sum"][path] += dur; METRICS["latency_count"][path] += 1
    h = HIST[path]; h[next((i for i, b in enumerate(BUCKETS) if dur <= b), len(BUCKETS))] += 1
    resp.headers["x-request-id"] = rid
    log.info(json.dumps({"rid": rid, "method": request.method, "path": request.url.path, "status": status, "ms": round(dur * 1000, 1)}))
    return resp


def _err(request: Request, status: int, code: str, msg: Any) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": msg, "request_id": getattr(request.state, "rid", None)}}, status)


@app.exception_handler(NotFound)
async def _nf(request: Request, e: NotFound) -> JSONResponse: return _err(request, 404, "not_found", str(e).strip("'\""))


@app.exception_handler(InvalidTransition)
async def _it(request: Request, e: InvalidTransition) -> JSONResponse: return _err(request, 409, "invalid_transition", str(e))


@app.exception_handler(ValueError)
async def _ve(request: Request, e: ValueError) -> JSONResponse: return _err(request, 422, "invalid_request", str(e))


@app.exception_handler(HTTPException)
async def _he(request: Request, e: HTTPException) -> JSONResponse:
    code = {401: "unauthorized", 403: "forbidden", 404: "not_found"}.get(e.status_code, "http_error"); return _err(request, e.status_code, code, e.detail)


@app.exception_handler(RequestValidationError)
async def _rv(request: Request, e: RequestValidationError) -> JSONResponse:
    return _err(request, 422, "validation_error", [{"loc": list(x["loc"]), "msg": x["msg"]} for x in e.errors()])


@app.exception_handler(FileNotFoundError)
async def _fnf(request: Request, e: FileNotFoundError) -> JSONResponse: return _err(request, 503, "not_ready", str(e))


@app.middleware("http")
async def _demo_read_only(request: Request, call_next: Any) -> Any:
    """NIGRANI_DEMO=1: public demo. Every state-changing call is refused, so the seeded database never drifts."""
    if DEMO and request.method not in {"GET", "HEAD", "OPTIONS"} and request.url.path not in DEMO_ALLOWED_POSTS:
        return _err(request, 403, "demo_read_only", "this is a read-only public demo; run locally for the full workflow")
    return await call_next(request)


# ------------------------------------------------------------------ public
APP_DIR = STATIC / "app"  # React build output (web/ -> npm run build)


def _spa() -> FileResponse:
    idx = APP_DIR / "index.html"
    return FileResponse(idx if idx.exists() else STATIC / "dashboard.html")


@app.get("/", include_in_schema=False)
def root() -> FileResponse: return _spa()


@app.get("/health", tags=["ops"])
def health() -> dict[str, Any]: return {"status": "ok", "demo": DEMO, "uptime_s": round(time.time() - METRICS["started"], 1)}


@app.get("/ready", tags=["ops"])
def ready(svc: Svc) -> JSONResponse:
    r = svc.ready(); return JSONResponse(r, 200 if r["ready"] else 503)


@app.get("/metrics", tags=["ops"], response_class=PlainTextResponse)
def metrics(svc: Svc) -> str:
    lines = ["# HELP nigrani_http_requests_total HTTP requests", "# TYPE nigrani_http_requests_total counter"]
    for (m, p, s), n in sorted(METRICS["requests"].items()): lines.append(f'nigrani_http_requests_total{{method="{m}",path="{p}",status="{s}"}} {n}')
    lines += ["# HELP nigrani_http_request_duration_seconds request latency", "# TYPE nigrani_http_request_duration_seconds histogram"]
    for p, h in sorted(HIST.items()):
        acc = 0
        for b, c in zip((*BUCKETS, "+Inf"), h, strict=True):
            acc += c; lines.append(f'nigrani_http_request_duration_seconds_bucket{{path="{p}",le="{b}"}} {acc}')
        lines.append(f'nigrani_http_request_duration_seconds_sum{{path="{p}"}} {METRICS["latency_sum"][p]:.6f}')
        lines.append(f'nigrani_http_request_duration_seconds_count{{path="{p}"}} {METRICS["latency_count"][p]}')
    try:
        q = svc.queue_stats(); lines += ["# HELP nigrani_alerts alerts by status", "# TYPE nigrani_alerts gauge"]
        lines += [f'nigrani_alerts{{status="{k}"}} {v}' for k, v in q["alerts_by_status"].items()]
        lines += ["# TYPE nigrani_model_info gauge", f'nigrani_model_info{{version="{svc.version}",name="{svc.meta["name"]}"}} 1',
                  "# TYPE nigrani_alert_threshold gauge", f"nigrani_alert_threshold {svc.threshold:.6f}"]
        fb = svc.feedback_stats(); lines += ["# TYPE nigrani_feedback_pending gauge", f"nigrani_feedback_pending {fb['labelled_not_yet_trained_on']}"]
    except Exception as e:  # metrics must never fail scraping
        lines.append(f"# service unavailable: {type(e).__name__}")
    return "\n".join(lines) + "\n"


@app.get("/dashboard/legacy", include_in_schema=False)
def dashboard_legacy() -> FileResponse: return FileResponse(STATIC / "dashboard.html")


@app.get("/dashboard", include_in_schema=False)
@app.get("/dashboard/{path:path}", include_in_schema=False)
def dashboard(path: str = "") -> FileResponse: return _spa()


if (APP_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=APP_DIR / "assets"), name="assets")


# ------------------------------------------------------------------ v1 API
@app.get("/v1/me", tags=["auth"])
def me(p: User) -> dict[str, str]: return {"user": p.user, "role": p.role}


@app.post("/v1/score", response_model=S.ScoreOut, tags=["scoring"])
def score(body: S.FeaturesIn, svc: Svc, _: User) -> dict[str, Any]: return svc.score(body.features)


@app.post("/v1/score/batch", response_model=S.BatchOut, tags=["scoring"])
def score_batch(body: S.BatchIn, svc: Svc, _: User) -> dict[str, Any]:
    r = svc.score_batch(body.rows); return {"results": r, "n": len(r), "n_alerts": sum(x["alert"] for x in r)}


@app.post("/v1/explain", response_model=S.ExplainOut, tags=["scoring"])
def explain(body: S.FeaturesIn, svc: Svc, _: User, top_k: Annotated[int, Query(ge=1, le=40)] = 8) -> dict[str, Any]:
    return svc.explain(body.features, top_k)


@app.get("/v1/alerts", response_model=S.AlertPage, tags=["alerts"])
def alerts(svc: Svc, _: User, status: str | None = None, assignee: str | None = None, pattern: str | None = None, priority: str | None = None,
           account: int | None = None, min_score: Annotated[float | None, Query(ge=0, le=1)] = None, date_from: str | None = None,
           date_to: str | None = None, page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=200)] = 25,
           sort: str = "-score") -> dict[str, Any]:
    return svc.list_alerts(status, assignee, pattern, priority, account, min_score, date_from, date_to, page, page_size, sort)


@app.post("/v1/alerts/sync", tags=["alerts"])
def sync(body: S.SyncIn, svc: Svc, _: Admin) -> dict[str, Any]: return svc.sync_alerts(body.budget, body.since)


@app.get("/v1/alerts/stats", tags=["alerts"])
def alert_stats(svc: Svc, _: User) -> dict[str, Any]: return svc.queue_stats()


@app.get("/v1/alerts/{alert_id}", response_model=S.AlertDetail, tags=["alerts"])
def alert(alert_id: str, svc: Svc, _: User) -> dict[str, Any]: return svc.get_alert(alert_id)


@app.post("/v1/alerts/{alert_id}/assign", response_model=S.AlertOut, tags=["alerts"])
def assign(alert_id: str, body: S.AssignIn, svc: Svc, p: User) -> dict[str, Any]: return svc.assign(alert_id, body.assignee, p.user)


@app.post("/v1/alerts/{alert_id}/escalate", response_model=S.AlertOut, tags=["alerts"])
def escalate(alert_id: str, body: S.EscalateIn, svc: Svc, p: User) -> dict[str, Any]: return svc.escalate(alert_id, body.reason, p.user)


@app.post("/v1/alerts/{alert_id}/close", response_model=S.AlertOut, tags=["alerts"])
def close(alert_id: str, body: S.CloseIn, svc: Svc, p: User) -> dict[str, Any]: return svc.close(alert_id, body.disposition, p.user, body.note)


@app.post("/v1/alerts/{alert_id}/reopen", response_model=S.AlertOut, tags=["alerts"])
def reopen(alert_id: str, body: S.ReopenIn, svc: Svc, p: User) -> dict[str, Any]: return svc.reopen(alert_id, body.reason, p.user)


@app.post("/v1/alerts/{alert_id}/feedback", tags=["alerts"])
def feedback(alert_id: str, body: S.FeedbackIn, svc: Svc, p: User) -> dict[str, Any]: return svc.record_feedback(alert_id, body.verdict, p.user, body.note)


@app.get("/v1/alerts/{alert_id}/case-note-draft", response_model=S.DraftOut, tags=["alerts"])
def case_note(alert_id: str, svc: Svc, _: User) -> dict[str, str]: return {"draft": svc.draft_case_note(alert_id)}


@app.get("/v1/alerts/{alert_id}/network", tags=["investigation"])
def alert_network(alert_id: str, svc: Svc, _: User, window: Annotated[int, Query(ge=1, le=20)] = 5) -> dict[str, Any]:
    a = svc.get_alert(alert_id, with_explanation=False); return svc.counterparty_network(a["account"], a["date"], window)


@app.get("/v1/accounts/{account}", tags=["investigation"])
def account(account: int, svc: Svc, _: User) -> dict[str, Any]: return svc.account_profile(account)


@app.get("/v1/accounts/{account}/linked", tags=["investigation"])
def linked(account: int, svc: Svc, _: User) -> dict[str, Any]: return svc.linked_accounts(account)


@app.get("/v1/accounts/{account}/timeline", tags=["investigation"])
def timeline(account: int, svc: Svc, _: User, end: str | None = None, days: Annotated[int, Query(ge=1, le=120)] = 30) -> dict[str, Any]:
    return svc.account_timeline(account, end, days)


@app.get("/v1/accounts/{account}/network", tags=["investigation"])
def network(account: int, date: str, svc: Svc, _: User, window: Annotated[int, Query(ge=1, le=20)] = 5) -> dict[str, Any]:
    return svc.counterparty_network(account, date, window)


@app.get("/v1/accounts/{account}/trades", tags=["investigation"])
def trades(account: int, date: str, svc: Svc, _: User, limit: Annotated[int, Query(ge=1, le=1000)] = 200) -> list[dict[str, Any]]:
    return svc.account_trades(account, date, limit)


@app.post("/v1/cases", response_model=S.CaseOut, status_code=201, tags=["cases"])
def create_case(body: S.CaseIn, svc: Svc, p: User) -> dict[str, Any]: return svc.create_case(body.title, body.alert_ids, p.user, body.owner, body.summary)


@app.get("/v1/cases", response_model=S.CasePage, tags=["cases"])
def cases(svc: Svc, _: User, status: str | None = None, owner: str | None = None, page: Annotated[int, Query(ge=1)] = 1,
          page_size: Annotated[int, Query(ge=1, le=200)] = 25) -> dict[str, Any]:
    return svc.list_cases(status, owner, page, page_size)


@app.get("/v1/cases/{case_id}", response_model=S.CaseOut, tags=["cases"])
def get_case(case_id: int, svc: Svc, _: User) -> dict[str, Any]: return svc.get_case(case_id)


@app.patch("/v1/cases/{case_id}", response_model=S.CaseOut, tags=["cases"])
def patch_case(case_id: int, body: S.CasePatch, svc: Svc, p: User) -> dict[str, Any]:
    return svc.update_case(case_id, p.user, body.status, body.owner, body.summary)


@app.post("/v1/cases/{case_id}/notes", response_model=S.CaseOut, tags=["cases"])
def add_note(case_id: int, body: S.NoteIn, svc: Svc, p: User) -> dict[str, Any]: return svc.add_case_note(case_id, body.body, p.user)


@app.post("/v1/cases/{case_id}/alerts", response_model=S.CaseOut, tags=["cases"])
def link_alert(case_id: int, body: S.LinkIn, svc: Svc, p: User) -> dict[str, Any]: return svc.link_alert(case_id, body.alert_id, p.user)


@app.get("/v1/cases/{case_id}/summary-draft", response_model=S.DraftOut, tags=["cases"])
def case_summary(case_id: int, svc: Svc, _: User) -> dict[str, str]: return {"draft": svc.draft_case_summary(case_id)}


@app.get("/v1/model/card", tags=["model"])
def model_card(svc: Svc, _: User) -> dict[str, Any]: return svc.model_card()


@app.get("/v1/model/versions", tags=["model"])
def model_versions(svc: Svc, _: User) -> dict[str, Any]: return svc.model_versions()


@app.post("/v1/model/promote", tags=["model"])
def promote(body: S.PromoteIn, svc: Svc, _: Admin) -> dict[str, Any]:
    try: return svc.promote(body.version)
    except KeyError as e: raise NotFound(str(e)) from e


@app.post("/v1/model/retrain", tags=["model"])
def retrain(body: S.RetrainIn, svc: Svc, p: Admin) -> dict[str, Any]: return svc.retrain(p.user, body.promote, body.tolerance)


@app.get("/v1/monitoring/drift", tags=["model"])
def drift(svc: Svc, _: User, recent_days: Annotated[int | None, Query(ge=1, le=60)] = None) -> dict[str, Any]: return svc.drift_report(recent_days)


@app.get("/v1/feedback/stats", tags=["model"])
def feedback_stats(svc: Svc, _: User) -> dict[str, Any]: return svc.feedback_stats()
