export type Alert = {
  alert_id: string; date: string; account: number; score: number; pattern: string; priority: string; status: string;
  assignee: string | null; disposition: string | null; case_id: number | null; model_version: string;
  escalation_reason: string | null; created_at: string; updated_at: string; closed_at: string | null;
};
export type Reason = { feature: string; value: number; shap: number };
export type Explanation = { score: number; threshold: number; pattern: string; base: string; top_reasons: Reason[]; model_version: string };
export type AlertDetail = Alert & { events: { action: string; actor: string; detail: string; ts: string }[]; explanation: Explanation | null };
export type Page<T> = { total: number; page: number; page_size: number; items: T[] };
export type Case = { case_id: number; title: string; status: string; owner: string | null; summary: string; alert_ids: string[]; created_at: string; updated_at: string; notes: { author: string; body: string; ts: string }[] | null };
export type Stats = { alerts_by_status: Record<string, number>; dispositions: Record<string, number>; cases_by_status: Record<string, number>; analyst_precision: number | null };
export type TimelineDay = { date: string; score: number; n_trades: number; gross_value: number; alert_status: string | null; top_symbols: { symbol: string; net_qty: number; value: number }[] };
export type Timeline = { account: number; threshold: number; days: TimelineDay[] };
export type NetNode = { id: number; focus: boolean; score: number; acct_type: string; entity_id: number; alert: boolean };
export type NetEdge = { source: number; target: number; type: "trade" | "co_trade" | "kyc"; symbol?: string; days?: number; value?: number; n?: number; shared?: string[] };
export type Network = { account: number; date: string; window_days: string[]; nodes: NetNode[]; edges: NetEdge[]; summary: Record<string, number> };
export type Linked = { account: number; entity_id: number; linked: { account: number; shared: string[] }[]; entity_members: number[]; method: string };
export type Budget = { threshold: number; alerts: number; precision: number; recall: number };
export type EvalBlock = { pr_auc: number; roc_auc: number; recall_at_1pct: number; precision_at_100: number; positives: number; rows: number; recall_at_1pct_by_type: Record<string, number>; alert_budget: Record<string, Budget>; episode_recall_at_deployed_threshold?: Record<string, { episodes: number; detected: number }> };
export type CvRow = { eligible: boolean; pr_auc: number; pr_auc_std: number; roc_auc: number; recall_at_1pct: number; precision_at_100: number; recall_at_1pct_by_type: Record<string, number> };
export type ModelCard = {
  version: string; name: string; created_at: string; git_sha: string; model: { kind: string; algo: string; n_features: number; heads?: string[] };
  features: string[]; thresholds: Record<string, number>; deployed_budget: string; protocol: string[];
  data: { rows: number; test_rows: number; test_positives: number; dev_end: string; test_start: string; folds?: unknown[] };
  cv: Record<string, CvRow>; test: { selected: EvalBlock; v2_baseline?: EvalBlock }; global_shap_mean_abs: Record<string, number>; label_noise: string;
};
export type Versions = { production: string; versions: { version: string; created_at: string; git_sha: string; artifact_sha: string; name: string; stage: string }[] };
export type Drift = { reference: string[]; current: string[]; psi: Record<string, number>; rule: string; watch: string[]; investigate: string[]; alert_rate: { reference: number; current: number } };
export type Trade = { trade_id: number; symbol: string; side: string; qty: number; price: number; counterparty: number | null };

export class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }

export const getKey = () => localStorage.getItem("nigrani.key") || "analyst-dev-key";
export const setKey = (k: string) => localStorage.setItem("nigrani.key", k);

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method, headers: { "X-API-Key": getKey(), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = j?.error; const msg = typeof e?.message === "string" ? e.message : Array.isArray(e?.message) ? e.message.map((m: { msg: string }) => m.msg).join("; ") : r.statusText;
    throw new ApiError(r.status, e?.code ?? "error", msg);
  }
  return j as T;
}
const qs = (o: Record<string, unknown>) => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => v !== undefined && v !== "" && v !== null && p.set(k, String(v))); const s = p.toString(); return s ? `?${s}` : ""; };

export const api = {
  me: () => req<{ user: string; role: string }>("GET", "/v1/me"),
  alerts: (q: Record<string, unknown>) => req<Page<Alert>>("GET", `/v1/alerts${qs(q)}`),
  alert: (id: string) => req<AlertDetail>("GET", `/v1/alerts/${encodeURIComponent(id)}`),
  stats: () => req<Stats>("GET", "/v1/alerts/stats"),
  assign: (id: string, assignee: string) => req<Alert>("POST", `/v1/alerts/${encodeURIComponent(id)}/assign`, { assignee }),
  escalate: (id: string, reason: string) => req<Alert>("POST", `/v1/alerts/${encodeURIComponent(id)}/escalate`, { reason }),
  close: (id: string, disposition: string, note: string) => req<Alert>("POST", `/v1/alerts/${encodeURIComponent(id)}/close`, { disposition, note }),
  reopen: (id: string, reason: string) => req<Alert>("POST", `/v1/alerts/${encodeURIComponent(id)}/reopen`, { reason }),
  feedback: (id: string, verdict: string, note: string) => req<unknown>("POST", `/v1/alerts/${encodeURIComponent(id)}/feedback`, { verdict, note }),
  draft: (id: string) => req<{ draft: string }>("GET", `/v1/alerts/${encodeURIComponent(id)}/case-note-draft`),
  network: (id: string, window = 5) => req<Network>("GET", `/v1/alerts/${encodeURIComponent(id)}/network?window=${window}`),
  timeline: (account: number, end?: string, days = 30) => req<Timeline>("GET", `/v1/accounts/${account}/timeline${qs({ end, days })}`),
  linked: (account: number) => req<Linked>("GET", `/v1/accounts/${account}/linked`),
  trades: (account: number, date: string) => req<Trade[]>("GET", `/v1/accounts/${account}/trades?date=${date}`),
  cases: (q: Record<string, unknown> = {}) => req<Page<Case>>("GET", `/v1/cases${qs({ page_size: 100, ...q })}`),
  case: (id: number) => req<Case>("GET", `/v1/cases/${id}`),
  createCase: (title: string, alert_ids: string[], summary = "") => req<Case>("POST", "/v1/cases", { title, alert_ids, summary }),
  patchCase: (id: number, patch: Partial<Pick<Case, "status" | "owner" | "summary">>) => req<Case>("PATCH", `/v1/cases/${id}`, patch),
  noteCase: (id: number, body: string) => req<Case>("POST", `/v1/cases/${id}/notes`, { body }),
  linkCase: (id: number, alert_id: string) => req<Case>("POST", `/v1/cases/${id}/alerts`, { alert_id }),
  caseDraft: (id: number) => req<{ draft: string }>("GET", `/v1/cases/${id}/summary-draft`),
  card: () => req<ModelCard>("GET", "/v1/model/card"),
  versions: () => req<Versions>("GET", "/v1/model/versions"),
  drift: () => req<Drift>("GET", "/v1/monitoring/drift"),
  feedbackStats: () => req<{ by_verdict: Record<string, number>; labelled_not_yet_trained_on: number }>("GET", "/v1/feedback/stats"),
  promote: (version: string) => req<unknown>("POST", "/v1/model/promote", { version }),
  retrain: () => req<Record<string, unknown>>("POST", "/v1/model/retrain", { promote: false }),
  sync: (budget = "1.0%") => req<{ created: number; candidates: number }>("POST", "/v1/alerts/sync", { budget }),
};
