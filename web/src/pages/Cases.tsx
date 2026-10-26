import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Briefcase, ChevronRight, FileText, MessageSquare, Plus, Copy } from "lucide-react";
import { api, type Case } from "@/lib/api";
import { refreshAll, useData } from "@/lib/hooks";
import { ago, cn } from "@/lib/utils";
import { PageHeader } from "@/components/AppShell";
import { Badge, Button, Dialog, Empty, Input, Skeleton, Textarea } from "@/components/ui";

const COLS = [
  { id: "open", title: "Open", hint: "Gathering evidence" },
  { id: "under_review", title: "Under review", hint: "With compliance lead" },
  { id: "str_filed", title: "STR filed", hint: "Reported to FIU-IND" },
  { id: "closed_no_action", title: "Closed · no action", hint: "Explained or insufficient" },
] as const;

export default function Cases() {
  const cases = useData(() => api.cases()); const [sel, setSel] = useState<Case | null>(null); const [newOpen, setNewOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null); const [over, setOver] = useState<string | null>(null);
  const move = async (c: Case, status: string) => {
    if (c.status === status) return;
    cases.setData((d) => d && { ...d, items: d.items.map((x) => (x.case_id === c.case_id ? { ...x, status } : x)) });
    try { await api.patchCase(c.case_id, { status }); toast.success(`Case #${c.case_id} moved`, { description: COLS.find((x) => x.id === status)?.title }); refreshAll(); }
    catch (e) { toast.error("Move failed", { description: (e as Error).message }); cases.reload(true); }
  };
  const items = cases.data?.items ?? [];
  return (
    <div className="flex h-full flex-col pb-6">
      <PageHeader title="Cases" sub="Investigations grouping related alerts, from evidence to STR filing" right={<Button variant="primary" onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5" />New case</Button>} />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-x-auto px-6 sm:grid-cols-2 lg:px-10 xl:grid-cols-4">
        {COLS.map((col) => {
          const list = items.filter((c) => c.status === col.id);
          return (
            <div key={col.id} data-col={col.id} onDragOver={(e) => { e.preventDefault(); setOver(col.id); }} onDragLeave={() => setOver(null)}
              onDrop={() => { const c = items.find((x) => x.case_id === drag); if (c) move(c, col.id); setDrag(null); setOver(null); }}
              className={cn("flex min-h-[420px] flex-col rounded-xl border bg-bg-2/50 p-2 transition-colors", over === col.id ? "border-accent/50 bg-accent-soft" : "border-line")}>
              <div className="flex items-center gap-2 px-2 pb-3 pt-1.5">
                <span className={cn("h-2 w-2 rounded-full", col.id === "str_filed" ? "bg-accent" : col.id === "closed_no_action" ? "bg-fg-3/50" : col.id === "under_review" ? "bg-fg-2" : "border border-fg-3")} />
                <span className="text-[13px] font-medium">{col.title}</span><span className="tnum font-mono text-xs text-fg-3">{list.length}</span>
                <span className="ml-auto truncate text-[11px] text-fg-3">{col.hint}</span>
              </div>
              <div className="space-y-2">
                {cases.loading && col.id === "open" && <Skeleton className="h-28 w-full rounded-xl" />}
                {list.map((c) => (
                  <motion.div layout layoutId={`case-${c.case_id}`} key={c.case_id} data-case-id={c.case_id} draggable onDragStart={() => setDrag(c.case_id)} onClick={() => setSel(c)}
                    className="cursor-grab rounded-xl border border-line bg-bg-2 p-3.5 shadow-card transition-colors hover:border-line-2 active:cursor-grabbing">
                    <div className="mb-2 flex items-center gap-2 text-[11px] text-fg-3"><span className="font-mono">#{c.case_id}</span><span>·</span><span>{ago(c.updated_at)}</span><span className="ml-auto">{c.owner}</span></div>
                    <div className="text-[13px] font-medium leading-snug">{c.title}</div>
                    {c.summary && <p className="mt-1 line-clamp-2 text-xs text-fg-3">{c.summary}</p>}
                    <div className="mt-3 flex items-center gap-2"><Badge t="neutral">{c.alert_ids.length} alert{c.alert_ids.length === 1 ? "" : "s"}</Badge>{!!c.notes?.length && <span className="flex items-center gap-1 text-[11px] text-fg-3"><MessageSquare className="h-3 w-3" />{c.notes.length}</span>}</div>
                  </motion.div>
                ))}
                {!cases.loading && !list.length && <div className="grid h-24 place-items-center rounded-xl border border-dashed border-line-2 text-xs text-fg-3">Drop a case here</div>}
              </div>
            </div>
          );
        })}
      </div>
      {!cases.loading && !items.length && <Empty icon={<Briefcase className="h-5 w-5" />} title="No cases yet" body="Open one from any alert with “Add to case”." />}
      <CaseDialog c={sel} onClose={() => setSel(null)} onMove={move} onChanged={(c) => { setSel(c); cases.reload(true); }} />
      <NewCase open={newOpen} setOpen={setNewOpen} onDone={() => cases.reload(true)} />
    </div>
  );
}

function CaseDialog({ c, onClose, onMove, onChanged }: { c: Case | null; onClose: () => void; onMove: (c: Case, s: string) => void; onChanged: (c: Case) => void }) {
  const [note, setNote] = useState(""); const [draft, setDraft] = useState<string>(); const nav = useNavigate();
  if (!c) return null;
  return (
    <Dialog open={!!c} onOpenChange={(o) => { if (!o) { onClose(); setDraft(undefined); } }} title={c.title} description={`Case #${c.case_id} · owner ${c.owner ?? "unassigned"} · opened ${ago(c.created_at)}`} className="max-w-2xl">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">{COLS.map((s) => <button key={s.id} onClick={() => { onMove(c, s.id); onChanged({ ...c, status: s.id }); }} className={cn("rounded-lg border px-2.5 py-1 text-xs transition", c.status === s.id ? "border-accent/50 bg-accent-soft text-accent" : "border-line-2 text-fg-2 hover:bg-bg-3")}>{s.title}</button>)}</div>
        <div><div className="mb-2 text-xs font-medium text-fg-3">Linked alerts</div>
          <div className="space-y-1">{c.alert_ids.map((id) => <button key={id} onClick={() => nav(`/dashboard/queue/${id}`)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-[13px] hover:bg-bg-3">{id}<ChevronRight className="ml-auto h-3.5 w-3.5 text-fg-3" /></button>)}</div></div>
        <div><div className="mb-2 text-xs font-medium text-fg-3">Notes</div>
          <div className="max-h-40 space-y-2 overflow-y-auto">{(c.notes ?? []).map((n, i) => <div key={i} className="rounded-lg bg-bg-3 px-3 py-2 text-[13px]"><div className="mb-0.5 text-[11px] text-fg-3">{n.author} · {ago(n.ts)}</div>{n.body}</div>)}{!c.notes?.length && <p className="text-xs text-fg-3">No notes yet.</p>}</div>
          <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!note.trim()) return; try { const r = await api.noteCase(c.case_id, note); setNote(""); toast.success("Note added"); onChanged(r); } catch (er) { toast.error("Failed", { description: (er as Error).message }); } }}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" /><Button variant="primary">Add</Button>
          </form></div>
        <div className="border-t border-line pt-4">
          {draft ? <><pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-bg p-3 font-mono text-xs leading-relaxed text-fg-2">{draft}</pre><Button size="sm" className="mt-2" onClick={() => { navigator.clipboard?.writeText(draft); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5" />Copy</Button></>
            : <Button onClick={() => api.caseDraft(c.case_id).then((r) => setDraft(r.draft)).catch((e) => toast.error(e.message))}><FileText className="h-3.5 w-3.5" />Draft case summary</Button>}
        </div>
      </div>
    </Dialog>
  );
}

function NewCase({ open, setOpen, onDone }: { open: boolean; setOpen: (o: boolean) => void; onDone: () => void }) {
  const [title, setTitle] = useState(""); const [ids, setIds] = useState(""); const [summary, setSummary] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen} title="New case" description="Group one or more alerts into an investigation.">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { const c = await api.createCase(title, ids.split(/[\s,]+/).filter(Boolean), summary); toast.success(`Case #${c.case_id} opened`); setOpen(false); setTitle(""); setIds(""); setSummary(""); onDone(); } catch (er) { toast.error("Couldn't create case", { description: (er as Error).message }); } }}>
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Wash ring around SYM014" />
        <Input value={ids} onChange={(e) => setIds(e.target.value)} placeholder="Alert ids, comma-separated (e.g. 2026-06-08:867)" className="font-mono" />
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summary (optional)" className="min-h-16" />
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={title.trim().length < 3}>Create</Button></div>
      </form>
    </Dialog>
  );
}
