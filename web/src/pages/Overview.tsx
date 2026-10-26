import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Activity, Network as NetIcon, TrendingUp, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useData } from "@/lib/hooks";
import { label, pct, human } from "@/lib/utils";
import { PageHeader } from "@/components/AppShell";
import { Badge, Button, Card, CardHeader, Kbd, ScoreBar, Skeleton, StatusPill } from "@/components/ui";
import { RiskTimeline } from "@/components/charts";

const fade = (i: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.04 * i, duration: 0.35, ease: [0.2, 0.7, 0.2, 1] as const } });

export default function Overview() {
  const nav = useNavigate();
  const stats = useData(() => api.stats()); const all = useData(() => api.alerts({ page_size: 200 }));
  const card = useData(() => api.card());
  const items = all.data?.items ?? []; const openItems = items.filter((a) => a.status !== "closed");
  const top = openItems[0]; const latest = items.reduce((m, a) => (a.date > m ? a.date : m), "");
  const topDetail = useData(() => (top ? api.alert(top.alert_id) : Promise.resolve(undefined)), [top?.alert_id]);
  const tl = useData(() => (top ? api.timeline(top.account, top.date, 30) : Promise.resolve(undefined)), [top?.alert_id]);
  const s = stats.data?.alerts_by_status ?? {}; const budget = card.data?.test?.selected?.alert_budget?.[card.data.deployed_budget];
  const byPattern = items.reduce<Record<string, number>>((m, a) => ((m[a.pattern] = (m[a.pattern] ?? 0) + 1), m), {});
  const events = items.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)).filter((a) => a.status !== "open").slice(0, 5);
  const statCards = [
    { label: "Needs review", value: (s.open ?? 0) + (s.assigned ?? 0), sub: `${s.open ?? 0} unassigned · ${s.assigned ?? 0} in progress` },
    { label: "Escalated", value: s.escalated ?? 0, sub: "awaiting compliance lead" },
    { label: "Closed", value: s.closed ?? 0, sub: stats.data?.analyst_precision != null ? `${pct(stats.data.analyst_precision)} confirmed true positive` : "no dispositions yet" },
    { label: "Precision at budget", value: budget ? pct(budget.precision) : "—", sub: budget ? `${budget.alerts} alerts/test window · recall ${pct(budget.recall)}` : "" },
  ];
  return (
    <div className="pb-16">
      <PageHeader title="Good to see you" sub={<>Surveillance window through <span className="font-mono text-fg-2">{latest || "…"}</span> · {items.length} alerts raised at the {card.data?.deployed_budget ?? "1.0%"} budget</>}
        right={<Button variant="primary" onClick={() => nav("/dashboard/queue")}>Start triage <Kbd className="border-transparent bg-bg/20 text-bg/70">G Q</Kbd></Button>} />
      <div className="space-y-5 px-6 lg:px-10">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          {statCards.map((c, i) => (
            <motion.div key={c.label} {...fade(i)} className="bg-bg-2 p-5">
              <div className="text-xs text-fg-3">{c.label}</div>
              {stats.loading || card.loading ? <Skeleton className="mt-2 h-8 w-16" /> : <div className="tnum mt-1.5 text-[28px] font-medium tracking-tight">{c.value}</div>}
              <div className="mt-1 truncate text-xs text-fg-3">{c.sub}</div>
            </motion.div>
          ))}
        </div>

        <motion.div {...fade(4)}>
          <Card className="overflow-hidden">
            <div className="grid lg:grid-cols-[1.05fr_1fr]">
              <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center gap-2"><Badge t="accent" dot>Today's top risk</Badge>{top && <span className="font-mono text-xs text-fg-3">{top.alert_id}</span>}</div>
                {!top ? <div className="space-y-3"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-24 w-full" /></div> : (<>
                  <h2 className="text-xl font-semibold tracking-tight">Account {top.account} · <span className="capitalize">{top.pattern === "pump" ? "pump & dump" : "network collusion"}</span></h2>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-fg-3"><ScoreBar score={top.score} threshold={topDetail.data?.explanation?.threshold} /><StatusPill status={top.status} />{top.assignee && <span>Owner <span className="text-fg-2">{top.assignee}</span></span>}</div>
                  <div className="mt-6 text-xs font-medium text-fg-3">Why the model flagged it</div>
                  <ul className="mt-2.5 space-y-2">
                    {(topDetail.data?.explanation?.top_reasons ?? []).slice(0, 4).map((r, i) => (
                      <li key={r.feature} className="flex items-center gap-3 text-[13px]">
                        <span className="tnum grid h-5 w-5 shrink-0 place-items-center rounded-md bg-bg-3 font-mono text-[10px] text-fg-3">{i + 1}</span>
                        <span className="flex-1 truncate">{label(r.feature)}</span><span className="tnum font-mono text-xs text-accent">+{r.shap.toFixed(2)}</span>
                      </li>
                    ))}
                    {topDetail.loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
                  </ul>
                  <div className="mt-6 flex gap-2"><Button variant="primary" onClick={() => nav(`/dashboard/queue/${top.alert_id}`)}>Investigate <ArrowRight className="h-3.5 w-3.5" /></Button><Button onClick={() => nav(`/dashboard/queue/${top.alert_id}?tab=network`)}><NetIcon className="h-3.5 w-3.5" />Network</Button></div>
                </>)}
              </div>
              <div className="p-6">
                <div className="mb-3 flex items-center justify-between text-xs"><span className="font-medium text-fg-3">30-day risk timeline</span><span className="flex items-center gap-3 text-fg-3"><span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-accent" />score</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-fg-3/40" />value</span></span></div>
                {tl.data ? <RiskTimeline tl={tl.data} focusDate={top?.date} height={250} /> : <Skeleton className="h-[250px] w-full" />}
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-3">
          <motion.div {...fade(5)}><Card className="h-full">
            <CardHeader title="Pattern mix" icon={<TrendingUp className="h-4 w-4" />} hint="by detection head" />
            <div className="space-y-4 px-5 pb-5">
              {Object.entries(byPattern).sort((a, b) => b[1] - a[1]).map(([p, n]) => (
                <Link to={`/dashboard/queue?pattern=${p}`} key={p} className="block group">
                  <div className="mb-1.5 flex justify-between text-[13px]"><span className="capitalize group-hover:text-accent">{p === "pump" ? "Pump & dump" : "Network (wash / circular)"}</span><span className="tnum font-mono text-xs text-fg-3">{n} · {pct(n / items.length)}</span></div>
                  <div className="h-1.5 rounded-full bg-bg-3"><motion.div initial={{ width: 0 }} animate={{ width: `${(n / items.length) * 100}%` }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }} className="h-full rounded-full bg-accent" /></div>
                </Link>
              ))}
              {all.loading && <Skeleton className="h-16 w-full" />}
            </div>
          </Card></motion.div>
          <motion.div {...fade(6)}><Card className="h-full">
            <CardHeader title="Recent activity" icon={<Activity className="h-4 w-4" />} />
            <ul className="px-2 pb-3">
              {events.map((a) => (
                <li key={a.alert_id}><Link to={`/dashboard/queue/${a.alert_id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] hover:bg-bg-3">
                  <StatusPill status={a.status} /><span className="flex-1 truncate text-fg-2">Account {a.account}{a.assignee && <span className="text-fg-3"> · {a.assignee}</span>}</span>
                  <span className="text-xs text-fg-3">{a.disposition ? human(a.disposition) : a.date.slice(5)}</span>
                </Link></li>
              ))}
            </ul>
          </Card></motion.div>
          <motion.div {...fade(7)}><Card className="h-full">
            <CardHeader title="Model health" icon={<ShieldCheck className="h-4 w-4" />} right={<Link to="/dashboard/model" className="flex items-center gap-1 text-xs text-fg-3 hover:text-fg">Details<ArrowUpRight className="h-3 w-3" /></Link>} />
            <div className="grid grid-cols-2 gap-4 px-5 pb-5">
              {card.data?.test?.selected ? ([["PR-AUC", card.data.test.selected.pr_auc.toFixed(3)], ["ROC-AUC", card.data.test.selected.roc_auc.toFixed(3)], ["Recall @ 1%", pct(card.data.test.selected.recall_at_1pct, 1)], ["Precision @ 100", pct(card.data.test.selected.precision_at_100)]] as const).map(([k, v]) => (
                <div key={k}><div className="text-xs text-fg-3">{k}</div><div className="tnum mt-1 font-mono text-lg">{v}</div></div>
              )) : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
              <p className="col-span-2 text-[11px] leading-relaxed text-fg-3">Held-out test window from {card.data?.data.test_start ?? "…"} · {card.data?.data.test_positives ?? "…"} manipulative account-days</p>
            </div>
          </Card></motion.div>
        </div>
      </div>
    </div>
  );
}
