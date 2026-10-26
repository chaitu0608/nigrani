import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpRight, Briefcase, Check, Copy, FileText, Flag, History, LineChart, Network as NetIcon, RotateCcw, Sparkles, UserPlus, Users, X as XIcon, ListOrdered } from "lucide-react";
import { api, type AlertDetail as AD } from "@/lib/api";
import { refreshAll, useData } from "@/lib/hooks";
import { ago, cn, human, inr } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, Dialog, Empty, Kbd, ScoreBar, Segmented, Skeleton, StatusPill, Textarea } from "@/components/ui";
import { RiskTimeline, ShapBars } from "@/components/charts";
import { NetworkGraph } from "@/components/NetworkGraph";

type Tab = "explain" | "timeline" | "network" | "trades" | "activity";
const TABS: { value: Tab; label: React.ReactNode }[] = [
  { value: "explain", label: <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Explain</span> },
  { value: "timeline", label: <span className="flex items-center gap-1.5"><LineChart className="h-3.5 w-3.5" />Timeline</span> },
  { value: "network", label: <span className="flex items-center gap-1.5"><NetIcon className="h-3.5 w-3.5" />Network</span> },
  { value: "trades", label: <span className="flex items-center gap-1.5"><ListOrdered className="h-3.5 w-3.5" />Trades</span> },
  { value: "activity", label: <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Activity</span> },
];
const err = (e: unknown) => toast.error("Action failed", { description: (e as Error).message });

export default function AlertDetail({ id, me, onBack, onChanged, onNext }: { id: string; me?: string; onBack?: () => void; onChanged?: () => void; onNext?: () => void }) {
  const [sp, setSp] = useSearchParams(); const tab = (sp.get("tab") as Tab) || "explain"; const nav = useNavigate();
  const setTab = (t: Tab) => { const n = new URLSearchParams(sp); t === "explain" ? n.delete("tab") : n.set("tab", t); setSp(n, { replace: true }); };
  const d = useData(() => api.alert(id), [id]);
  const [dlg, setDlg] = useState<null | "escalate" | "close" | "reopen" | "draft" | "case" | "feedback">(null);
  const a = d.data;
  const changed = (msg: string, desc?: string) => { toast.success(msg, { description: desc }); d.reload(true); onChanged?.(); refreshAll(); };
  const assign = async () => { if (!a || !me) return; try { await api.assign(a.alert_id, me); changed(`Assigned to ${me}`, `Account ${a.account}`); } catch (e) { err(e); } };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || document.querySelector("[role=dialog][data-state=open]") || !a) return;
      if (e.key === "a" && a.status !== "closed") assign();
      else if (e.key === "e" && a.status !== "closed" && a.status !== "escalated") setDlg("escalate");
      else if (e.key === "c" && a.status !== "closed") setDlg("close");
      else if (e.key === "d") setDlg("draft");
      else if (["1", "2", "3", "4", "5"].includes(e.key)) setTab(TABS[+e.key - 1].value);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });
  if (d.error) return <Empty icon={<XIcon className="h-5 w-5" />} title="Couldn't load alert" body={d.error.message} />;
  if (!a) return <div className="space-y-4 p-8"><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-96" /><Skeleton className="mt-6 h-72 w-full" /></div>;
  const ex = a.explanation;
  return (
    <div data-testid="alert-detail" className="mx-auto max-w-[1100px] px-6 pb-16 pt-6 lg:px-8">
      {onBack && <Button variant="ghost" size="sm" className="-ml-2 mb-3" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" />Queue</Button>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-fg-3">
            <button className="group flex items-center gap-1 font-mono hover:text-fg" onClick={() => { navigator.clipboard?.writeText(a.alert_id); toast("Copied alert id", { description: a.alert_id }); }}>{a.alert_id}<Copy className="h-3 w-3 opacity-0 group-hover:opacity-100" /></button>
            <span>·</span><span>model {a.model_version}</span>{a.case_id && <><span>·</span><button onClick={() => nav("/dashboard/cases")} className="flex items-center gap-1 hover:text-fg">case #{a.case_id}<ArrowUpRight className="h-3 w-3" /></button></>}
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Account {a.account}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <StatusPill status={a.status} /><Badge t={a.priority === "high" ? "accent" : "neutral"}>{a.priority} priority</Badge>
            <Badge>{a.pattern === "pump" ? "pump & dump head" : "network head"}</Badge>
            {a.assignee && <span className="text-xs text-fg-3">Owner <span className="text-fg-2">{a.assignee}</span></span>}
            {a.disposition && <Badge t="muted">{human(a.disposition)}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {a.status !== "closed" ? (<>
            {a.assignee !== me && <Button onClick={assign}><UserPlus className="h-3.5 w-3.5" />Assign to me<Kbd>A</Kbd></Button>}
            {a.status !== "escalated" && <Button onClick={() => setDlg("escalate")}><Flag className="h-3.5 w-3.5" />Escalate<Kbd>E</Kbd></Button>}
            <Button variant="primary" onClick={() => setDlg("close")}><Check className="h-3.5 w-3.5" />Close<Kbd className="border-transparent bg-bg/20 text-bg/70">C</Kbd></Button>
          </>) : <Button onClick={() => setDlg("reopen")}><RotateCcw className="h-3.5 w-3.5" />Reopen</Button>}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        <Metric k="Risk score"><ScoreBar score={a.score} threshold={ex?.threshold} /></Metric>
        <Metric k="Alert threshold"><span className="tnum font-mono text-sm">{ex?.threshold ?? "—"}</span></Metric>
        <Metric k="Trade date"><span className="font-mono text-sm">{a.date}</span></Metric>
        <Metric k="Raised"><span className="text-sm">{ago(a.created_at)}</span></Metric>
      </div>
      {a.escalation_reason && <div className="mt-4 flex gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-[13px]"><Flag className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><div><span className="font-medium">Escalated:</span> <span className="text-fg-2">{a.escalation_reason}</span></div></div>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={tab} onChange={setTab} options={TABS} className="max-w-full overflow-x-auto" />
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setDlg("feedback")}><Sparkles className="h-3.5 w-3.5" />Label for retrain</Button>
          <Button size="sm" variant="ghost" onClick={() => setDlg("case")}><Briefcase className="h-3.5 w-3.5" />Add to case</Button>
          <Button size="sm" onClick={() => setDlg("draft")}><FileText className="h-3.5 w-3.5" />Draft case note<Kbd>D</Kbd></Button>
        </div>
      </div>
      <div className="mt-4">
        {tab === "explain" && (ex ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
            <Card><CardHeader title="Why this alert fired" hint="top SHAP contributions toward manipulation" /><div className="px-3 pb-4">{<ShapBars ex={ex} />}</div></Card>
            <Card className="h-fit p-5">
              <div className="text-xs font-medium text-fg-3">Read it like an analyst</div>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-2">Each bar is how much a behaviour pushed this account-day's score above the base rate, in log-odds. Accent bars push toward manipulation; grey would push away.</p>
              <div className="mt-4 border-t border-line pt-4 text-xs text-fg-3">Strongest signal</div>
              <div className="mt-1 text-[13px] font-medium">{ex.top_reasons[0] && <>{human(ex.top_reasons[0].feature)} <span className="font-mono text-accent">+{ex.top_reasons[0].shap.toFixed(2)}</span></>}</div>
            </Card>
          </div>
        ) : <Empty icon={<Sparkles className="h-5 w-5" />} title="No explanation stored" />)}
        {tab === "timeline" && <TimelineTab a={a} />}
        {tab === "network" && <NetworkTab a={a} />}
        {tab === "trades" && <TradesTab a={a} />}
        {tab === "activity" && (
          <Card className="p-5"><ol className="relative space-y-5 border-l border-line pl-5">
            {a.events.slice().reverse().map((e, i) => (
              <li key={i} className="relative"><span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full border-2 border-bg-2 bg-accent ring-1 ring-line-2" />
                <div className="flex flex-wrap items-baseline gap-2 text-[13px]"><span className="font-medium capitalize">{human(e.action)}</span><span className="text-fg-3">by {e.actor}</span><span className="ml-auto text-xs text-fg-3">{ago(e.ts)}</span></div>
                {e.detail && <p className="mt-0.5 text-[13px] text-fg-2">{e.detail}</p>}
              </li>
            ))}
          </ol></Card>
        )}
      </div>
      <Dialogs a={a} dlg={dlg} setDlg={setDlg} changed={(m, desc) => { changed(m, desc); if (dlg === "close") onNext?.(); }} />
    </div>
  );
}
function Metric({ k, children }: { k: string; children: React.ReactNode }) { return <div className="bg-bg-2 px-4 py-3.5"><div className="mb-1.5 text-xs text-fg-3">{k}</div>{children}</div>; }

function TimelineTab({ a }: { a: AD }) {
  const [days, setDays] = useState<"30" | "60" | "90">("30"); const tl = useData(() => api.timeline(a.account, a.date, +days), [a.account, a.date, days]);
  const hits = tl.data?.days.filter((d) => d.score >= tl.data!.threshold).length ?? 0;
  return (
    <Card><CardHeader title="Risk timeline" hint={tl.data ? `${hits} day${hits === 1 ? "" : "s"} above threshold` : ""} right={<Segmented value={days} onChange={setDays} options={[{ value: "30", label: "30d" }, { value: "60", label: "60d" }, { value: "90", label: "90d" }]} />} />
      <div className="px-3 pb-4">{tl.data ? <RiskTimeline tl={tl.data} focusDate={a.date} height={320} /> : <Skeleton className="mx-2 h-[320px]" />}</div></Card>
  );
}
function NetworkTab({ a }: { a: AD }) {
  const net = useData(() => api.network(a.alert_id), [a.alert_id]); const lk = useData(() => api.linked(a.account), [a.account]); const nav = useNavigate();
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div>{net.data ? <NetworkGraph net={net.data} height={480} onNode={(n) => toast(`Account ${n}`, { description: "Open from the queue or ⌘K to investigate", action: { label: "Find alert", onClick: () => nav(`/dashboard/queue?view=all`) } })} /> : <Skeleton className="h-[480px] w-full rounded-xl" />}</div>
      <div className="space-y-4">
        <Card className="p-4"><div className="mb-3 text-xs font-medium text-fg-3">Graph summary · {net.data?.window_days.length ?? "…"}-day window</div>
          <div className="grid grid-cols-3 gap-2">{(["trade", "co_trade", "kyc"] as const).map((k) => <div key={k}><div className="tnum font-mono text-lg">{net.data?.summary[k] ?? "–"}</div><div className="text-[11px] text-fg-3">{human(k)}</div></div>)}</div>
          <div className="mt-3 border-t border-line pt-3 text-xs text-fg-3"><span className="tnum font-mono text-fg-2">{net.data?.nodes.length ?? "–"}</span> accounts · <span className="tnum font-mono text-fg-2">{net.data?.nodes.filter((n) => n.alert).length ?? "–"}</span> alerted</div>
        </Card>
        <Card className="p-4"><div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-3"><Users className="h-3.5 w-3.5" />KYC-linked accounts</div>
          {lk.data?.linked.length ? <ul className="space-y-1.5">{lk.data.linked.map((l) => <li key={l.account} className="flex justify-between text-[13px]"><span className="font-mono">{l.account}</span><span className="text-xs text-fg-3">{l.shared.join(", ")}</span></li>)}</ul> : <p className="text-xs text-fg-3">{lk.loading ? "Loading…" : "No shared KYC identifiers."}</p>}
          {lk.data && <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-fg-3">Entity of {lk.data.entity_members.length} accounts · {lk.data.method}</p>}
        </Card>
      </div>
    </div>
  );
}
function TradesTab({ a }: { a: AD }) {
  const t = useData(() => api.trades(a.account, a.date), [a.account, a.date]);
  return (
    <Card className="overflow-hidden">
      <CardHeader title={`Trades on ${a.date}`} hint={t.data ? `${t.data.length} fills` : ""} />
      {t.loading ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}</div> : !t.data?.length ? <Empty icon={<ListOrdered className="h-5 w-5" />} title="No trades that day" /> : (
        <div className="max-h-[440px] overflow-auto"><table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-bg-2 text-left text-xs text-fg-3"><tr className="border-y border-line">{["Trade", "Symbol", "Side", "Qty", "Price", "Value", "Counterparty"].map((h) => <th key={h} className={cn("px-5 py-2 font-normal", ["Qty", "Price", "Value"].includes(h) && "text-right")}>{h}</th>)}</tr></thead>
          <tbody>{t.data.map((r) => (
            <tr key={r.trade_id} className="border-b border-line/60 hover:bg-bg-3/60">
              <td className="px-5 py-2 font-mono text-xs text-fg-3">{r.trade_id}</td><td className="px-5 py-2 font-mono">{r.symbol}</td>
              <td className="px-5 py-2"><span className={r.side.toLowerCase().startsWith("b") ? "text-accent" : "text-fg-2"}>{r.side}</span></td>
              <td className="tnum px-5 py-2 text-right font-mono">{r.qty}</td><td className="tnum px-5 py-2 text-right font-mono">{r.price.toFixed(2)}</td>
              <td className="tnum px-5 py-2 text-right font-mono">{inr(r.qty * r.price)}</td><td className="px-5 py-2 font-mono text-fg-3">{r.counterparty ?? "exchange"}</td>
            </tr>))}</tbody>
        </table></div>
      )}
    </Card>
  );
}

function Opt<T extends string>({ v, cur, set, title, desc }: { v: T; cur: T; set: (v: T) => void; title: string; desc: string }) {
  return (
    <button type="button" onClick={() => set(v)} className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left transition", cur === v ? "border-accent/50 bg-accent-soft" : "border-line-2 hover:bg-bg-3")}>
      <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border", cur === v ? "border-accent bg-accent" : "border-line-2")}>{cur === v && <span className="h-1.5 w-1.5 rounded-full bg-accent-fg" />}</span>
      <span><span className="block text-[13px] font-medium">{title}</span><span className="text-xs text-fg-3">{desc}</span></span>
    </button>
  );
}

function Dialogs({ a, dlg, setDlg, changed }: { a: AD; dlg: string | null; setDlg: (d: null) => void; changed: (m: string, d?: string) => void }) {
  const [text, setText] = useState(""); const [disp, setDisp] = useState<"true_positive" | "false_positive" | "benign_explained">("true_positive");
  const [verdict, setVerdict] = useState<"true_positive" | "false_positive" | "benign_explained" | "needs_more_info">("true_positive");
  const [busy, setBusy] = useState(false); const [draft, setDraft] = useState<string>(); const cases = useData(() => (dlg === "case" ? api.cases() : Promise.resolve(undefined)), [dlg]);
  useEffect(() => { setText(""); setDraft(undefined); if (dlg === "draft") api.draft(a.alert_id).then((r) => setDraft(r.draft)).catch((e) => setDraft(`Error: ${e.message}`)); }, [dlg, a.alert_id]);
  const run = async (f: () => Promise<unknown>, m: string, desc?: string) => { setBusy(true); try { await f(); setDlg(null); changed(m, desc); } catch (e) { err(e); } finally { setBusy(false); } };
  const close = () => setDlg(null);
  return (<>
    <Dialog open={dlg === "escalate"} onOpenChange={close} title="Escalate to compliance lead" description="The reason is written to the immutable audit trail.">
      <form onSubmit={(e) => { e.preventDefault(); run(() => api.escalate(a.alert_id, text), "Alert escalated", `Account ${a.account}`); }} className="space-y-3">
        <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Coordinated buying with 4 KYC-linked accounts ahead of a 9% run-up" />
        <div className="flex items-center justify-between"><span className="text-xs text-fg-3">{text.trim().length < 5 ? "At least 5 characters" : ""}</span><div className="flex gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" disabled={busy || text.trim().length < 5}>Escalate</Button></div></div>
      </form>
    </Dialog>
    <Dialog open={dlg === "close"} onOpenChange={close} title="Close alert" description="Your disposition becomes a training label for the next model version.">
      <form onSubmit={(e) => { e.preventDefault(); run(() => api.close(a.alert_id, disp, text), "Alert closed", human(disp)); }} className="space-y-2.5">
        <Opt v="true_positive" cur={disp} set={setDisp} title="True positive" desc="Manipulation confirmed; consider an STR case." />
        <Opt v="false_positive" cur={disp} set={setDisp} title="False positive" desc="Model was wrong; nothing suspicious." />
        <Opt v="benign_explained" cur={disp} set={setDisp} title="Benign, explained" desc="Unusual but legitimate, e.g. news-driven or prop hedge." />
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Note (optional)" className="mt-1 min-h-16" />
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" disabled={busy}>Close alert</Button></div>
      </form>
    </Dialog>
    <Dialog open={dlg === "reopen"} onOpenChange={close} title="Reopen alert">
      <form onSubmit={(e) => { e.preventDefault(); run(() => api.reopen(a.alert_id, text), "Alert reopened"); }} className="space-y-3">
        <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Why reopen?" className="min-h-16" />
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" disabled={busy || text.trim().length < 3}>Reopen</Button></div>
      </form>
    </Dialog>
    <Dialog open={dlg === "feedback"} onOpenChange={close} title="Label for retraining" description="Feedback is stored separately from the disposition and picked up by the next retrain.">
      <form onSubmit={(e) => { e.preventDefault(); run(() => api.feedback(a.alert_id, verdict, text), "Feedback recorded", human(verdict)); }} className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">{(["true_positive", "false_positive", "benign_explained", "needs_more_info"] as const).map((v) => <Opt key={v} v={v} cur={verdict} set={setVerdict} title={human(v)} desc="" />)}</div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Note (optional)" className="min-h-16" />
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" disabled={busy}>Save label</Button></div>
      </form>
    </Dialog>
    <Dialog open={dlg === "draft"} onOpenChange={close} title="Case note draft" description="Generated from stored evidence only: score, SHAP reasons, graph and timeline." className="max-w-2xl">
      {draft === undefined ? <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4" />)}</div> : <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-bg p-4 font-mono text-xs leading-relaxed text-fg-2">{draft}</pre>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={close}>Done</Button><Button variant="primary" disabled={!draft} onClick={() => { navigator.clipboard?.writeText(draft ?? ""); toast.success("Draft copied"); }}><Copy className="h-3.5 w-3.5" />Copy</Button></div>
    </Dialog>
    <Dialog open={dlg === "case"} onOpenChange={close} title="Add to case" description="Link this alert to an existing investigation, or open a new one.">
      <div className="space-y-2">
        {cases.data?.items.filter((c) => !c.alert_ids.includes(a.alert_id)).map((c) => (
          <button key={c.case_id} disabled={busy} onClick={() => run(() => api.linkCase(c.case_id, a.alert_id), `Linked to case #${c.case_id}`)} className="flex w-full items-center gap-3 rounded-xl border border-line-2 p-3 text-left hover:bg-bg-3">
            <Briefcase className="h-4 w-4 text-fg-3" /><span className="flex-1 text-[13px]">{c.title}</span><StatusPill status={c.status} />
          </button>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); run(() => api.createCase(text || `Investigation: account ${a.account}`, [a.alert_id]), "Case opened", text || `Account ${a.account}`); }} className="flex gap-2 border-t border-line pt-3">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Investigation: account ${a.account}`} className="h-8 flex-1 rounded-lg border border-line-2 bg-bg-2 px-2.5 text-[13px] outline-none focus:border-accent/60" />
          <Button variant="primary" disabled={busy}>New case</Button>
        </form>
      </div>
    </Dialog>
  </>);
}
