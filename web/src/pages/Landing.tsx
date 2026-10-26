import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowRight, Bot, Boxes, BrainCircuit, Database, GitBranch, Moon, ScanSearch, Sun, UserCheck } from "lucide-react";
import mcpDoc from "../../../docs/mcp_demo.md?raw";
import { api, type Explanation } from "@/lib/api";
import { useData, useTheme } from "@/lib/hooks";
import { label, pct } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui";

/** Pull a real tools/call block out of docs/mcp_demo.md (generated from a live MCP session). */
function mcpCall(name: string) {
  const i = mcpDoc.indexOf(`## tools/call \`${name}\``); const head = mcpDoc.slice(i).split("\n")[0];
  const args = head.replace(`## tools/call \`${name}\` `, "");
  const body = mcpDoc.slice(i).split("```json")[1].split("```")[0];
  return { args, json: JSON.parse(body) };
}
const EX = mcpCall("explain_alert"); const exj = EX.json as Explanation & { alert_id: string };
const SNIPPET = `{
  "alert_id": "${exj.alert_id}",
  "score": ${exj.score},
  "threshold": ${exj.threshold},
  "pattern": "${exj.pattern}",
  "top_reasons": [
${exj.top_reasons.slice(0, 4).map((r) => `    { "feature": "${r.feature}", "value": ${r.value}, "shap": ${r.shap} }`).join(",\n")},
    …
  ]
}`;
const TOOL_COUNT = (mcpDoc.match(/## tools\/list \((\d+)\)/) ?? [])[1];

const up = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.6, ease: [0.2, 0.7, 0.2, 1] as const } };

export default function Landing() {
  const { dark, toggle } = useTheme(); const card = useData(() => api.card());
  const t = card.data?.test.selected; const b = t?.alert_budget[card.data!.deployed_budget];
  const hero = useRef<HTMLDivElement>(null); const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 80]); const op = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-bg">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-6">
          <Link to="/" className="flex items-center gap-2.5"><Logo /><span className="font-semibold tracking-tight">Nigrani</span></Link>
          <nav className="hidden items-center gap-6 text-[13px] text-fg-2 md:flex">{[["How it works", "#how"], ["Patterns", "#patterns"], ["Results", "#results"], ["MCP copilot", "#mcp"]].map(([l, h]) => <a key={h} href={h} className="transition-colors hover:text-fg">{l}</a>)}</nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Link to="/dashboard"><Button variant="primary">Live demo <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
          </div>
        </div>
      </header>

      <section ref={hero} className="relative">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute left-1/2 top-[-200px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
        <motion.div style={{ y, opacity: op }} className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 text-center md:pt-28">
          <motion.a href="#how" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto inline-flex items-center gap-2 rounded-full border border-line-2 bg-bg-2/70 py-1 pl-1 pr-3 text-xs text-fg-2 backdrop-blur">
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">SEBI</span>Broker trade surveillance, explained<ArrowRight className="h-3 w-3" />
          </motion.a>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
            className="mx-auto mt-7 max-w-4xl text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] md:text-[72px]">
            Catch market manipulation.<br /><span className="bg-gradient-to-b from-fg-2 to-fg-3 bg-clip-text text-transparent">Explain every alert.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.7 }} className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-fg-2">
            SEBI requires every broker to surveil client trades for wash, circular and pump-and-dump activity. Rule engines drown analysts in alerts they can't justify.
            Nigrani ranks risk with ML, shows <em className="not-italic text-fg">why</em> with SHAP, and lets an AI copilot investigate through MCP.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }} className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/dashboard"><Button variant="primary" size="lg" className="h-11 px-5">Open the live dashboard <ArrowRight className="h-4 w-4" /></Button></Link>
            <a href="#mcp"><Button size="lg" className="h-11 px-5"><Bot className="h-4 w-4" />See the MCP copilot</Button></a>
          </motion.div>
          <HeroProduct />
        </motion.div>
      </section>

      <section id="results" className="border-y border-line bg-bg-2/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 md:grid-cols-4">
          {[
            [b ? pct(b.precision) : "—", "of alerts are real manipulation", `precision at the ${card.data?.deployed_budget ?? "1.0%"} alert budget`],
            [t ? pct(t.recall_at_1pct) : "—", "of manipulative account-days caught", "while reviewing only 1% of activity"],
            [t ? t.pr_auc.toFixed(2) : "—", "PR-AUC on unseen weeks", `vs ${card.data?.test.v2_baseline?.pr_auc.toFixed(2) ?? "—"} for the v2 baseline`],
            [t?.episode_recall_at_deployed_threshold ? `${Object.values(t.episode_recall_at_deployed_threshold).reduce((s, e) => s + e.detected, 0)}/${Object.values(t.episode_recall_at_deployed_threshold).reduce((s, e) => s + e.episodes, 0)}` : "—", "manipulation episodes detected", "in the held-out test window"],
          ].map(([v, l, s], i) => (
            <motion.div key={i} {...up} transition={{ ...up.transition, delay: i * 0.06 }} className="px-2 py-10 md:px-6">
              <div className="tnum text-[40px] font-semibold tracking-[-0.04em]">{v}</div><div className="mt-1 text-[13px] text-fg">{l}</div><div className="mt-0.5 text-xs text-fg-3">{s}</div>
            </motion.div>
          ))}
        </div>
        <p className="mx-auto max-w-6xl px-6 pb-6 text-[11px] text-fg-3 md:px-12">Live from <span className="font-mono">/v1/model/card</span>: walk-forward CV with embargo, test window from {card.data?.data.test_start ?? "…"} never seen during training or model selection. Synthetic market data; {card.data?.label_noise}.</p>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 py-28">
        <SectionHead eyebrow="How it works" title="From raw trades to a decision an analyst can defend." body="Every account-day becomes a feature vector built from the trade graph and the market. A pattern-aware model scores it, SHAP attributes the score, and the analyst, or Claude via MCP, takes it from there." />
        <Flow />
      </section>

      <section id="patterns" className="border-t border-line bg-bg-2/30">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <SectionHead eyebrow="What it catches" title="Three manipulation patterns, one model." body="Separate detection heads for network collusion and price manipulation, sharing graph and market features." />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { k: "wash", title: "Wash trading", body: "Linked accounts trade with each other, creating volume with no change in ownership.", art: <WashArt /> },
              { k: "circular", title: "Circular trading", body: "Shares rotate A → B → C → A to paint the tape and fake liquidity.", art: <CircularArt /> },
              { k: "pump_dump", title: "Pump and dump", body: "A KYC-linked ring buys an illiquid scrip in sync, runs the price, then exits.", art: <PumpArt /> },
            ].map((p, i) => (
              <motion.div key={p.k} {...up} transition={{ ...up.transition, delay: i * 0.08 }} className="group overflow-hidden rounded-2xl border border-line bg-bg-2 transition-colors hover:border-line-2">
                <div className="relative h-48 border-b border-line bg-bg">{p.art}</div>
                <div className="p-6">
                  <div className="flex items-baseline justify-between"><h3 className="text-[15px] font-medium tracking-tight">{p.title}</h3>{t && <span className="tnum font-mono text-xs text-accent">{pct(t.recall_at_1pct_by_type[p.k])} recall</span>}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-fg-3">{p.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="mcp" className="mx-auto max-w-6xl px-6 py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.15fr]">
          <motion.div {...up}>
            <div className="text-xs font-medium text-accent">AI copilot via MCP</div>
            <h2 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.035em]">Ask Claude to triage the queue. It uses the same API your analysts do.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-fg-2">Nigrani ships a Model Context Protocol server with {TOOL_COUNT} tools, resources and prompts. The copilot can list alerts, read SHAP drivers, walk the counterparty graph and draft a case note, with every write going through the same audit trail.</p>
            <ul className="mt-6 grid grid-cols-2 gap-3 text-[13px] text-fg-2">{["explain_alert", "get_counterparty_network", "escalate_alert", "draft_case_note"].map((x) => <li key={x} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-accent" /><code className="font-mono text-xs">{x}</code></li>)}</ul>
          </motion.div>
          <motion.div {...up} transition={{ ...up.transition, delay: 0.1 }} className="overflow-hidden rounded-2xl border border-line-2 bg-bg-2 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3"><span className="h-2.5 w-2.5 rounded-full bg-fg-3/30" /><span className="h-2.5 w-2.5 rounded-full bg-fg-3/30" /><span className="h-2.5 w-2.5 rounded-full bg-fg-3/30" /><span className="ml-3 font-mono text-[11px] text-fg-3">nigrani.mcp_server · stdio</span></div>
            <div className="space-y-4 p-5 font-mono text-[12px] leading-relaxed">
              <div className="flex gap-3"><span className="text-fg-3">›</span><div><span className="text-accent">tools/call</span> <span className="text-fg">explain_alert</span> <span className="text-fg-3">{EX.args}</span></div></div>
              <pre className="overflow-x-auto rounded-xl border border-line bg-bg p-4 text-fg-2">
{SNIPPET}</pre>
              <div className="flex gap-3 rounded-xl bg-accent-soft p-3 font-sans text-[13px] leading-relaxed text-fg-2"><Bot className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span>Account {exj.alert_id.split(":")[1]} scored {exj.score} against a {exj.threshold} threshold. The main drivers are a {label(exj.top_reasons[0].feature).toLowerCase()} and {label(exj.top_reasons[2].feature).toLowerCase()}, consistent with a coordinated pump. Want me to pull the counterparty network?</span></div>
              <p className="font-sans text-[11px] text-fg-3">Tool call and response verbatim from <span className="font-mono">docs/mcp_demo.md</span>, a recorded live session. The copilot reply is illustrative.</p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-line">
        <div className="pointer-events-none absolute bottom-[-260px] left-1/2 h-[480px] w-[800px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />
        <motion.div {...up} className="relative mx-auto max-w-3xl px-6 py-28 text-center">
          <h2 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.04em]">Fewer alerts. Better ones.<br /><span className="text-fg-3">Every one explained.</span></h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] text-fg-2">The demo runs on the real API with the production model: triage the queue, explore the network, open a case.</p>
          <Link to="/dashboard"><Button variant="primary" size="lg" className="mt-8 h-11 px-6">Launch live demo <ArrowRight className="h-4 w-4" /></Button></Link>
        </motion.div>
        <footer className="relative mx-auto flex max-w-6xl items-center justify-between border-t border-line px-6 py-6 text-xs text-fg-3"><span className="flex items-center gap-2"><Logo className="h-4 w-4" />Nigrani · निगरानी, “surveillance”</span><span>FastAPI · CatBoost · SHAP · MCP</span></footer>
      </section>
    </div>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (<motion.div {...up} className="max-w-2xl"><div className="text-xs font-medium text-accent">{eyebrow}</div><h2 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.035em]">{title}</h2><p className="mt-4 text-[15px] leading-relaxed text-fg-2">{body}</p></motion.div>);
}

function HeroProduct() {
  const max = Math.max(...exj.top_reasons.map((r) => r.shap));
  return (
    <motion.div initial={{ opacity: 0, y: 40, rotateX: 12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.3, duration: 1, ease: [0.2, 0.7, 0.2, 1] }} style={{ perspective: 1200 }}
      className="relative mx-auto mt-16 max-w-4xl text-left">
      <div className="absolute -inset-px rounded-[20px] bg-gradient-to-b from-line-2 to-transparent" />
      <div className="relative overflow-hidden rounded-[20px] border border-line bg-bg-2/90 shadow-[0_40px_120px_-40px_rgba(0,0,0,.5)] backdrop-blur">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative h-2 w-2 rounded-full bg-accent" /></span>
          <span className="text-[13px] font-medium">Account {exj.alert_id.split(":")[1]}</span><span className="rounded-md border border-line-2 px-1.5 py-0.5 text-[11px] text-fg-2">pump &amp; dump</span>
          <span className="ml-auto font-mono text-xs text-fg-3">{exj.alert_id}</span><span className="tnum rounded-md bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent">{exj.score}</span>
        </div>
        <div className="grid md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-2.5 p-5">
            <div className="mb-1 text-xs text-fg-3">Why this alert fired</div>
            {exj.top_reasons.slice(0, 5).map((r, i) => (
              <div key={r.feature} className="grid grid-cols-[minmax(0,1fr)_120px_40px] items-center gap-3 text-[13px]">
                <span className="truncate text-fg-2">{label(r.feature)}</span>
                <div className="h-1.5 rounded-full bg-bg-3"><motion.div initial={{ width: 0 }} animate={{ width: `${(r.shap / max) * 100}%` }} transition={{ delay: 0.8 + i * 0.08, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }} className="h-full rounded-full bg-accent" style={{ opacity: 1 - i * 0.12 }} /></div>
                <span className="tnum text-right font-mono text-xs text-fg">+{r.shap.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="relative hidden border-l border-line md:block"><MiniNet /></div>
        </div>
      </div>
    </motion.div>
  );
}

function MiniNet() {
  const pts = [[50, 50], [22, 28], [78, 24], [84, 66], [30, 78], [58, 86], [14, 56]];
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
      {pts.slice(1).map(([x, y], i) => <motion.line key={i} x1={50} y1={50} x2={x} y2={y} stroke="var(--accent)" strokeOpacity={i < 3 ? 0.7 : 0.25} strokeWidth={0.4} strokeDasharray={i < 3 ? "1.2 1.2" : undefined} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1 + i * 0.1, duration: 0.6 }} />)}
      <line x1={22} y1={28} x2={78} y2={24} stroke="var(--fg-3)" strokeOpacity={0.3} strokeWidth={0.3} />
      {pts.map(([x, y], i) => <motion.circle key={i} cx={x} cy={y} r={i === 0 ? 3.2 : 1.8} fill={i === 0 ? "var(--accent)" : i < 4 ? "var(--fg)" : "var(--bg-2)"} stroke="var(--fg-3)" strokeWidth={i === 0 || i < 4 ? 0 : 0.4} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9 + i * 0.06, type: "spring" }} />)}
      <circle cx={50} cy={50} r={6} fill="none" stroke="var(--accent)" strokeOpacity={0.3} strokeWidth={0.4} />
      <text x={50} y={60} textAnchor="middle" fontSize={3.2} fill="var(--fg-2)" fontFamily="Geist Mono Variable">{exj.alert_id.split(":")[1]}</text>
    </svg>
  );
}

function Flow() {
  const steps = [
    { icon: Database, title: "Trades", body: "Every fill, counterparty and KYC record" },
    { icon: GitBranch, title: "Graph + features", body: "28 signals: cycles, co-trading, price impact" },
    { icon: BrainCircuit, title: "Model", body: "CatBoost pattern heads, 1% alert budget" },
    { icon: ScanSearch, title: "SHAP", body: "Per-alert reasons in plain language" },
    { icon: UserCheck, title: "Analyst or Claude", body: "Triage, case, STR draft, feedback" },
  ];
  return (
    <div className="relative mt-16">
      <svg className="pointer-events-none absolute left-0 right-0 top-[38px] hidden h-2 w-full md:block" preserveAspectRatio="none" viewBox="0 0 100 2"><line x1="10" y1="1" x2="90" y2="1" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="0.15" className="flow-dash" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.5 }} /></svg>
      <div className="grid gap-6 md:grid-cols-5">
        {steps.map((s, i) => (
          <motion.div key={s.title} {...up} transition={{ ...up.transition, delay: i * 0.1 }} className="relative text-center">
            <div className="relative mx-auto grid h-[76px] w-[76px] place-items-center rounded-2xl border border-line-2 bg-bg-2 shadow-card">
              <motion.div className="absolute inset-0 rounded-2xl border border-accent" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.5, repeatDelay: 0 }} />
              <s.icon className="h-6 w-6 text-fg" strokeWidth={1.5} />
            </div>
            <div className="mt-2 font-mono text-[10px] text-fg-3">0{i + 1}</div>
            <div className="mt-1 text-[14px] font-medium tracking-tight">{s.title}</div>
            <div className="mx-auto mt-1 max-w-[180px] text-xs leading-relaxed text-fg-3">{s.body}</div>
          </motion.div>
        ))}
      </div>
      <motion.div {...up} className="mx-auto mt-14 flex max-w-xl items-center justify-center gap-2 rounded-full border border-line bg-bg-2 px-4 py-2 text-xs text-fg-3"><Boxes className="h-3.5 w-3.5 text-accent" />One service layer behind the dashboard, the REST API and the MCP server</motion.div>
    </div>
  );
}

const nodeAnim = (d: number) => ({ initial: { scale: 0 }, whileInView: { scale: 1 }, viewport: { once: true }, transition: { delay: d, type: "spring" as const, bounce: 0.4 } });
function WashArt() {
  return (
    <svg viewBox="0 0 300 190" className="h-full w-full">
      <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent)" /></marker></defs>
      <path d="M100 80 C 130 50, 170 50, 200 80" fill="none" stroke="var(--accent)" strokeWidth="1.5" className="flow-dash" markerEnd="url(#ah)" />
      <path d="M200 110 C 170 140, 130 140, 100 110" fill="none" stroke="var(--accent)" strokeWidth="1.5" className="flow-dash" markerEnd="url(#ah)" />
      <rect x="112" y="88" width="76" height="14" rx="7" fill="var(--bg-3)" /><text x="150" y="98" textAnchor="middle" fontSize="8" fill="var(--fg-3)" fontFamily="Geist Mono Variable">same KYC entity</text>
      {[[85, 95], [215, 95]].map(([x, y], i) => <motion.g key={i} {...nodeAnim(i * 0.15)} style={{ transformOrigin: `${x}px ${y}px` }}><circle cx={x} cy={y} r="18" fill="var(--bg-2)" stroke="var(--fg-3)" strokeOpacity=".5" /><circle cx={x} cy={y} r="6" fill={i ? "var(--fg)" : "var(--accent)"} /></motion.g>)}
      <text x="150" y="40" textAnchor="middle" fontSize="9" fill="var(--fg-2)" fontFamily="Geist Mono Variable">BUY 500 SYM014</text><text x="150" y="160" textAnchor="middle" fontSize="9" fill="var(--fg-2)" fontFamily="Geist Mono Variable">SELL 500 SYM014</text>
    </svg>
  );
}
function CircularArt() {
  const P = [[150, 40], [225, 145], [75, 145]];
  return (
    <svg viewBox="0 0 300 190" className="h-full w-full">
      <defs><marker id="ah2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent)" /></marker></defs>
      {P.map(([x, y], i) => { const [x2, y2] = P[(i + 1) % 3]; const mx = x + (x2 - x) * 0.18, my = y + (y2 - y) * 0.18, ex = x + (x2 - x) * 0.82, ey = y + (y2 - y) * 0.82; return <path key={i} d={`M${mx} ${my} L${ex} ${ey}`} stroke="var(--accent)" strokeWidth="1.5" className="flow-dash" markerEnd="url(#ah2)" />; })}
      <circle cx="150" cy="110" r="22" fill="none" stroke="var(--line-2)" strokeDasharray="2 3" />
      <text x="150" y="113" textAnchor="middle" fontSize="8" fill="var(--fg-3)" fontFamily="Geist Mono Variable">in_cycle</text>
      {P.map(([x, y], i) => <motion.g key={i} {...nodeAnim(i * 0.12)} style={{ transformOrigin: `${x}px ${y}px` }}><circle cx={x} cy={y} r="15" fill="var(--bg-2)" stroke="var(--fg-3)" strokeOpacity=".5" /><text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--fg)">{"ABC"[i]}</text></motion.g>)}
    </svg>
  );
}
function PumpArt() {
  const px = [60, 61, 60, 62, 61, 63, 70, 82, 95, 104, 98, 76, 62, 58];
  const pts = px.map((p, i) => `${30 + i * 18},${165 - (p - 50) * 2.2}`).join(" ");
  return (
    <svg viewBox="0 0 300 190" className="h-full w-full">
      {px.map((_, i) => <rect key={i} x={24 + i * 18} y={i >= 5 && i <= 9 ? 140 : i >= 10 && i <= 12 ? 150 : 165} width="10" height={i >= 5 && i <= 9 ? 30 : i >= 10 && i <= 12 ? 20 : 5} rx="2" fill={i >= 5 && i <= 9 ? "var(--accent)" : "var(--fg-3)"} opacity={i >= 5 && i <= 9 ? 0.35 : 0.25} />)}
      <motion.polyline points={pts} fill="none" stroke="var(--fg)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: "easeInOut" }} />
      <line x1="120" x2="120" y1="20" y2="170" stroke="var(--accent)" strokeDasharray="2 3" strokeOpacity=".6" /><text x="124" y="30" fontSize="8" fill="var(--accent)" fontFamily="Geist Mono Variable">ring buys in sync</text>
      <line x1="210" x2="210" y1="20" y2="170" stroke="var(--fg-3)" strokeDasharray="2 3" strokeOpacity=".6" /><text x="214" y="30" fontSize="8" fill="var(--fg-3)" fontFamily="Geist Mono Variable">dump</text>
    </svg>
  );
}
