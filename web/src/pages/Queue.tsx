import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Inbox, Search, SlidersHorizontal } from "lucide-react";
import { api, type Alert } from "@/lib/api";
import { useData, useMedia } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Badge, Empty, Input, Kbd, ScoreBar, Segmented, Skeleton, StatusPill } from "@/components/ui";
import AlertDetail from "./AlertDetail";

type View = "active" | "mine" | "escalated" | "closed" | "all";
const VIEWS: { value: View; label: string }[] = [{ value: "active", label: "Active" }, { value: "mine", label: "Mine" }, { value: "escalated", label: "Escalated" }, { value: "closed", label: "Closed" }, { value: "all", label: "All" }];

export default function Queue() {
  const { id } = useParams(); const nav = useNavigate(); const [sp, setSp] = useSearchParams();
  const view = (sp.get("view") as View) || "active"; const pattern = sp.get("pattern") || ""; const [q, setQ] = useState("");
  const me = useData(() => api.me());
  const data = useData(() => api.alerts({ page_size: 200, pattern: pattern || undefined, status: view === "escalated" ? "escalated" : view === "closed" ? "closed" : undefined, assignee: view === "mine" ? me.data?.user : undefined }), [view, pattern, me.data?.user]);
  const items = useMemo(() => (data.data?.items ?? []).filter((a) => (view === "active" ? a.status !== "closed" : true)).filter((a) => !q || String(a.account).includes(q) || a.alert_id.includes(q)), [data.data, view, q]);
  const [cur, setCur] = useState(0); const searchRef = useRef<HTMLInputElement>(null); const listRef = useRef<HTMLDivElement>(null);
  const wide = useMedia("(min-width: 1024px)");
  useEffect(() => { if (id) { const i = items.findIndex((a) => a.alert_id === id); if (i >= 0) setCur(i); } }, [id, items]);
  useEffect(() => { if (!id && wide && items[0]) nav(`/dashboard/queue/${items[0].alert_id}${location.search}`, { replace: true }); }, [id, items, wide]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listRef.current?.querySelector(`[data-i="${cur}"]`)?.scrollIntoView({ block: "nearest" }); }, [cur]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[role=dialog][data-state=open]")) return;
      if (t.tagName === "INPUT") { if (e.key === "Escape") (t as HTMLInputElement).blur(); return; }
      if (t.tagName === "TEXTAREA") return;
      const go = (i: number) => { const n = Math.max(0, Math.min(items.length - 1, i)); setCur(n); if (items[n]) nav(`/dashboard/queue/${items[n].alert_id}${location.search}`, { replace: true }); };
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); go(cur + 1); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); go(cur - 1); }
      else if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "Enter" && items[cur]) nav(`/dashboard/queue/${items[cur].alert_id}`);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [items, cur, nav]);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n); };
  const counts = data.data ? { pump: data.data.items.filter((a) => a.pattern === "pump").length, network: data.data.items.filter((a) => a.pattern === "network").length } : null;
  const list = (
    <div className="flex h-full min-h-0 flex-col border-r border-line">
      <div className="space-y-3 border-b border-line px-4 pb-3 pt-5">
        <div className="flex items-center justify-between"><h1 className="text-[17px] font-semibold tracking-tight">Alert queue</h1><span className="tnum font-mono text-xs text-fg-3">{items.length}</span></div>
        <Segmented value={view} onChange={(v) => set("view", v === "active" ? "" : v)} options={VIEWS} className="w-full [&>button]:flex-1" />
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" /><Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Account or alert id" className="pl-8 pr-8" /><Kbd className="absolute right-2 top-1/2 -translate-y-1/2">/</Kbd></div>
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
            <select value={pattern} onChange={(e) => set("pattern", e.target.value)} className="h-8 appearance-none rounded-lg border border-line-2 bg-bg-2 pl-8 pr-3 text-[13px] text-fg-2 outline-none focus:border-accent/60">
              <option value="">All patterns</option><option value="pump">Pump{counts ? ` (${counts.pump})` : ""}</option><option value="network">Network{counts ? ` (${counts.network})` : ""}</option>
            </select>
          </div>
        </div>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {data.loading && Array.from({ length: 9 }).map((_, i) => <div key={i} className="space-y-2 px-3 py-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>)}
        {!data.loading && !items.length && <Empty icon={<Inbox className="h-5 w-5" />} title="Queue is clear" body={view === "mine" ? "Nothing assigned to you. Pick something from Active." : "No alerts match these filters."} />}
        {items.map((a, i) => <Row key={a.alert_id} a={a} i={i} active={a.alert_id === id} cursor={i === cur} onClick={() => { setCur(i); nav(`/dashboard/queue/${a.alert_id}${location.search}`); }} />)}
      </div>
      <div className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-[11px] text-fg-3"><span className="flex items-center gap-1"><Kbd>J</Kbd><Kbd>K</Kbd> move</span><span className="flex items-center gap-1"><Kbd>A</Kbd> assign</span><span className="flex items-center gap-1"><Kbd>E</Kbd> escalate</span><span className="flex items-center gap-1"><Kbd>C</Kbd> close</span></div>
    </div>
  );
  if (!wide) return id ? <AlertDetail id={id} me={me.data?.user} onBack={() => nav(`/dashboard/queue${location.search}`)} onChanged={() => data.reload(true)} /> : list;
  return (
    <div className="grid h-full grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
      {list}
      <div className="min-h-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          {id ? <motion.div key={id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <AlertDetail id={id} me={me.data?.user} onChanged={() => data.reload(true)} onNext={() => { const n = items[cur + 1]; if (n) nav(`/dashboard/queue/${n.alert_id}${location.search}`); }} />
          </motion.div> : <Empty icon={<Inbox className="h-5 w-5" />} title="Select an alert" body="Use J / K to move through the queue." />}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({ a, i, active, cursor, onClick }: { a: Alert; i: number; active: boolean; cursor: boolean; onClick: () => void }) {
  return (
    <button data-i={i} data-alert-id={a.alert_id} onClick={onClick} className={cn("relative block w-full rounded-lg px-3 py-2.5 text-left transition-colors", active ? "bg-bg-3" : "hover:bg-bg-3/60", cursor && !active && "ring-1 ring-inset ring-line-2")}>
      {active && <motion.span layoutId="q-active" className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full bg-accent" />}
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium">Account {a.account}</span>
        {a.priority === "high" && <Badge t="accent">high</Badge>}
        {a.case_id && <Badge t="muted">case #{a.case_id}</Badge>}
        <span className="ml-auto"><ScoreBar score={a.score} /></span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-fg-3">
        <StatusPill status={a.status} /><span className="capitalize">{a.pattern === "pump" ? "pump & dump" : "network"}</span><span className="font-mono">{a.date.slice(5)}</span>
        {a.assignee && <span className="ml-auto truncate">{a.assignee}</span>}
      </div>
    </button>
  );
}
