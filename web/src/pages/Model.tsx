import { useState } from "react";
import { toast } from "sonner";
import { Check, Cpu, GitCommit, RefreshCw, Rocket } from "lucide-react";
import { api } from "@/lib/api";
import { useData } from "@/lib/hooks";
import { cn, human, label, pct } from "@/lib/utils";
import { PageHeader } from "@/components/AppShell";
import { Badge, Button, Card, CardHeader, Segmented, Skeleton } from "@/components/ui";

export default function Model() {
  const card = useData(() => api.card()); const vers = useData(() => api.versions()); const drift = useData(() => api.drift()); const fb = useData(() => api.feedbackStats());
  const [budget, setBudget] = useState<string>("1.0%"); const [busy, setBusy] = useState(false);
  const c = card.data; const t = c?.test.selected; const b = t?.alert_budget[budget]; const base = c?.test.v2_baseline;
  const shap = c ? Object.entries(c.global_shap_mean_abs).sort((a, b) => b[1] - a[1]).slice(0, 10) : []; const smax = shap[0]?.[1] ?? 1;
  const psi = drift.data ? Object.entries(drift.data.psi).slice(0, 10) : [];
  const admin = async (f: () => Promise<unknown>, ok: string) => { setBusy(true); try { const r = await f(); toast.success(ok, { description: typeof r === "object" ? JSON.stringify(r).slice(0, 120) : undefined }); vers.reload(true); } catch (e) { toast.error("Admin action failed", { description: `${(e as Error).message}. Switch to admin-dev-key via the key icon.` }); } finally { setBusy(false); } };
  return (
    <div className="pb-16">
      <PageHeader title="Model" sub={c ? <>{c.name} · {c.model.algo} · {c.model.n_features} features · heads {c.model.heads?.join(", ")}</> : "…"}
        right={<><Button disabled={busy} onClick={() => admin(() => api.retrain(), "Retrain finished (candidate, not promoted)")}><RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />Retrain candidate</Button></>} />
      <div className="space-y-5 px-6 lg:px-10">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          {(t ? [["PR-AUC", t.pr_auc.toFixed(3), base && `v2 baseline ${base.pr_auc.toFixed(3)}`], ["ROC-AUC", t.roc_auc.toFixed(3), base && `v2 baseline ${base.roc_auc.toFixed(3)}`], ["Recall @ 1% budget", pct(t.recall_at_1pct, 1), base && `v2 baseline ${pct(base.recall_at_1pct, 1)}`], ["Precision @ top 100", pct(t.precision_at_100), base && `v2 baseline ${pct(base.precision_at_100)}`]] : [0, 1, 2, 3].map(() => ["", "", ""])).map(([k, v, s], i) => (
            <div key={i} className="bg-bg-2 p-5">{c ? <><div className="text-xs text-fg-3">{k}</div><div className="tnum mt-1.5 font-mono text-[26px] tracking-tight">{v}</div><div className="mt-1 text-xs text-fg-3">{s}</div></> : <Skeleton className="h-16" />}</div>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card><CardHeader title="Alert budget trade-off" hint="held-out test window" right={<Segmented value={budget} onChange={setBudget} options={["0.5%", "1.0%", "2.0%"].map((v) => ({ value: v, label: v }))} />} />
            {b ? <div className="grid grid-cols-2 gap-6 px-5 pb-5 sm:grid-cols-4">
              {[["Threshold", b.threshold], ["Alerts", b.alerts], ["Precision", pct(b.precision, 1)], ["Recall", pct(b.recall, 1)]].map(([k, v]) => <div key={k}><div className="text-xs text-fg-3">{k}</div><div className="tnum mt-1 font-mono text-lg">{v}</div></div>)}
              <div className="col-span-full space-y-3 border-t border-line pt-4">
                {Object.entries(t!.recall_at_1pct_by_type).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[140px_1fr_48px] items-center gap-3 text-[13px]"><span className="text-fg-2">{human(k)}</span><div className="h-1.5 rounded-full bg-bg-3"><div className="h-full rounded-full bg-accent" style={{ width: `${v * 100}%`, opacity: 0.4 + v * 0.6 }} /></div><span className="tnum text-right font-mono text-xs">{pct(v)}</span></div>
                ))}
                <p className="text-[11px] text-fg-3">Account-day recall by manipulation type at the 1% budget. {c?.deployed_budget === budget && <Badge t="accent" className="ml-1">deployed</Badge>}</p>
              </div>
            </div> : <Skeleton className="mx-5 mb-5 h-40" />}
          </Card>
          <Card><CardHeader title="What the model looks at" hint="mean |SHAP|, global" />
            <div className="space-y-2 px-5 pb-5">{shap.map(([f, v]) => (
              <div key={f} className="grid grid-cols-[minmax(0,1fr)_100px_44px] items-center gap-3 text-[13px]"><span className="truncate text-fg-2">{label(f)}</span><div className="h-1.5 rounded-full bg-bg-3"><div className="h-full rounded-full bg-fg-2" style={{ width: `${(v / smax) * 100}%` }} /></div><span className="tnum text-right font-mono text-xs text-fg-3">{v.toFixed(2)}</span></div>
            ))}{!c && <Skeleton className="h-48" />}</div>
          </Card>
        </div>
        <Card className="overflow-hidden"><CardHeader title="Walk-forward cross-validation" hint={c ? `${c.data.folds?.length ?? 4} expanding folds · selected by mean PR-AUC` : ""} />
          <div className="overflow-x-auto"><table className="w-full text-[13px]">
            <thead className="text-left text-xs text-fg-3"><tr className="border-y border-line">{["Candidate", "PR-AUC", "± std", "ROC-AUC", "Recall @1%", "Prec @100", ""].map((h, i) => <th key={i} className={cn("px-5 py-2 font-normal", i > 0 && "text-right")}>{h}</th>)}</tr></thead>
            <tbody>{c && Object.entries(c.cv).sort((a, b) => b[1].pr_auc - a[1].pr_auc).map(([k, r]) => (
              <tr key={k} className={cn("border-b border-line/60", k === c.name && "bg-accent-soft")}>
                <td className="px-5 py-2.5 font-mono text-xs">{k}{k === c.name && <Badge t="accent" className="ml-2">selected</Badge>}{!r.eligible && <Badge t="muted" className="ml-2">ablation</Badge>}</td>
                {[r.pr_auc.toFixed(3), r.pr_auc_std.toFixed(3), r.roc_auc.toFixed(3), pct(r.recall_at_1pct, 1), pct(r.precision_at_100)].map((v, i) => <td key={i} className="tnum px-5 py-2.5 text-right font-mono text-xs">{v}</td>)}<td />
              </tr>))}</tbody>
          </table></div>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><CardHeader title="Feature drift" hint={drift.data ? `PSI · ${drift.data.current.join(" → ")} vs ${drift.data.reference.join(" → ")}` : ""} />
            <div className="space-y-2 px-5 pb-5">
              {psi.map(([f, v]) => (
                <div key={f} className="grid grid-cols-[minmax(0,1fr)_120px_52px] items-center gap-3 text-[13px]"><span className="truncate text-fg-2">{label(f)}</span>
                  <div className="relative h-1.5 rounded-full bg-bg-3"><div className={cn("h-full rounded-full", v > 0.25 ? "bg-red-500" : v > 0.1 ? "bg-accent" : "bg-fg-3")} style={{ width: `${Math.min(1, v / 0.3) * 100}%` }} /><span className="absolute -top-0.5 h-2.5 w-px bg-fg-3" style={{ left: `${(0.1 / 0.3) * 100}%` }} /></div>
                  <span className={cn("tnum text-right font-mono text-xs", v > 0.1 ? "text-accent" : "text-fg-3")}>{v.toFixed(3)}</span></div>
              ))}
              {drift.data && <p className="pt-2 text-[11px] text-fg-3">{drift.data.rule} · alert rate {pct(drift.data.alert_rate.reference, 2)} → {pct(drift.data.alert_rate.current, 2)} · {drift.data.watch.length} to watch, {drift.data.investigate.length} to investigate</p>}
              {drift.loading && <Skeleton className="h-48" />}
            </div>
          </Card>
          <Card><CardHeader title="Versions" icon={<GitCommit className="h-4 w-4" />} hint={fb.data ? `${fb.data.labelled_not_yet_trained_on} analyst labels waiting for retrain` : ""} />
            <div className="space-y-2 px-5 pb-5">
              {vers.data?.versions.map((v) => (
                <div key={v.version} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-bg-3"><Cpu className="h-4 w-4 text-fg-3" /></div>
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[13px] font-medium">{v.version}<span className="truncate font-mono text-xs font-normal text-fg-3">{v.name}</span></div>
                    <div className="font-mono text-[11px] text-fg-3">git {v.git_sha} · artifact {v.artifact_sha.slice(0, 10)} · {v.created_at.slice(0, 10)}</div></div>
                  {v.version === vers.data?.production ? <Badge t="accent"><Check className="h-3 w-3" />production</Badge> : <Button size="sm" disabled={busy} onClick={() => admin(() => api.promote(v.version), `Promoted ${v.version}`)}><Rocket className="h-3.5 w-3.5" />Promote</Button>}
                </div>
              ))}
              {vers.loading && <Skeleton className="h-16" />}
              {c && <div className="pt-2"><div className="mb-1.5 text-xs font-medium text-fg-3">Evaluation protocol</div><ul className="space-y-1 text-xs leading-relaxed text-fg-3">{c.protocol.filter((p) => p.includes("=") && !p.includes("[")).map((p, i) => { const [k, ...v] = p.trim().split("="); return <li key={i} className="flex gap-2"><span className="w-12 shrink-0 font-mono text-fg-2">{k.trim()}</span><span>{v.join("=").trim()}</span></li>; })}</ul></div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
