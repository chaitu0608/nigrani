import { Bar, BarChart, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "motion/react";
import type { Explanation, Timeline } from "@/lib/api";
import { inr, label, num } from "@/lib/utils";

const fmtVal = (f: string, v: number) => (f.includes("share") || f.includes("balance") || f.includes("concentration") || f === "prior_net_5d" ? `${(v * 100).toFixed(0)}%` : Math.abs(v) >= 100 ? num(v, 0) : num(v, 2));

/** Horizontal SHAP contribution bars, hand-drawn so they look crafted rather than chart-default. */
export function ShapBars({ ex }: { ex: Explanation }) {
  const rows = ex.top_reasons; const max = Math.max(...rows.map((r) => Math.abs(r.shap)), 0.01);
  const total = rows.reduce((s, r) => s + r.shap, 0);
  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={r.feature} className="group grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_56px] items-center gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-bg-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] text-fg">{label(r.feature)}</div>
            <div className="truncate font-mono text-[11px] text-fg-3">{r.feature} = {fmtVal(r.feature, r.value)}</div>
          </div>
          <div className="relative h-2 rounded-full bg-bg-3">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(Math.abs(r.shap) / max) * 100}%` }} transition={{ delay: i * 0.04, type: "spring", bounce: 0, duration: 0.8 }}
              className={`absolute inset-y-0 rounded-full ${r.shap >= 0 ? "left-0 bg-accent" : "right-0 bg-fg-3"}`} style={{ opacity: 1 - i * 0.07 }} />
          </div>
          <div className={`tnum text-right font-mono text-xs ${r.shap >= 0 ? "text-fg" : "text-fg-3"}`}>{r.shap >= 0 ? "+" : ""}{r.shap.toFixed(2)}</div>
        </div>
      ))}
      <div className="mt-3 flex items-center justify-between border-t border-line px-2 pt-3 text-xs text-fg-3">
        <span>{ex.base}</span><span className="tnum font-mono">Σ top-{rows.length} = <span className="text-fg">+{total.toFixed(2)}</span> log-odds</span>
      </div>
    </div>
  );
}

function TipBox({ active, payload, label: l, threshold }: { active?: boolean; payload?: { payload: Timeline["days"][number] }[]; label?: string; threshold: number }) {
  if (!active || !payload?.length) return null; const d = payload[0].payload;
  return (
    <div className="min-w-44 rounded-xl border border-line-2 bg-bg-2/95 p-3 text-xs shadow-xl backdrop-blur">
      <div className="mb-2 font-mono text-fg-3">{l}</div>
      <div className="flex justify-between gap-6"><span className="text-fg-3">Risk score</span><span className={`tnum font-mono ${d.score >= threshold ? "text-accent" : "text-fg"}`}>{d.score.toFixed(4)}</span></div>
      <div className="flex justify-between gap-6"><span className="text-fg-3">Gross value</span><span className="tnum font-mono">{inr(d.gross_value)}</span></div>
      <div className="flex justify-between gap-6"><span className="text-fg-3">Trades</span><span className="tnum font-mono">{d.n_trades}</span></div>
      {d.top_symbols[0] && <div className="mt-2 border-t border-line pt-2 text-fg-3">Top: <span className="font-mono text-fg-2">{d.top_symbols.slice(0, 3).map((s) => s.symbol).join(" · ")}</span></div>}
    </div>
  );
}

export function RiskTimeline({ tl, focusDate, height = 260 }: { tl: Timeline; focusDate?: string; height?: number }) {
  const data = tl.days.map((d) => ({ ...d, short: d.date.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs><linearGradient id="vbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--fg-3)" stopOpacity={0.35} /><stop offset="1" stopColor="var(--fg-3)" stopOpacity={0.08} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fill: "var(--fg-3)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis yAxisId="v" hide />
        <YAxis yAxisId="s" orientation="left" domain={[0, 1]} tick={{ fill: "var(--fg-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => v.toFixed(1)} />
        <Tooltip content={<TipBox threshold={tl.threshold} />} cursor={{ fill: "var(--bg-3)" }} />
        <Bar yAxisId="v" dataKey="gross_value" radius={[3, 3, 0, 0]} maxBarSize={14}>
          {data.map((d) => <Cell key={d.date} fill={d.date === focusDate ? "var(--accent)" : "url(#vbar)"} fillOpacity={d.date === focusDate ? 0.35 : 1} />)}
        </Bar>
        <ReferenceLine yAxisId="s" y={tl.threshold} stroke="var(--accent)" strokeDasharray="3 4" strokeOpacity={0.7} label={{ value: `threshold ${tl.threshold}`, position: "insideTopRight", fill: "var(--fg-3)", fontSize: 10 }} />
        <Line yAxisId="s" type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={(p: { cx?: number; cy?: number; payload?: { score: number; date: string } }) => {
          const hit = p.payload && p.payload.score >= tl.threshold;
          return <circle key={p.payload?.date} cx={p.cx} cy={p.cy} r={hit ? 3.5 : 0} fill="var(--bg-2)" stroke="var(--accent)" strokeWidth={2} />;
        }} activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--bg-2)", strokeWidth: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function MiniBars({ data, height = 140 }: { data: { name: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={150} tick={{ fill: "var(--fg-2)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "var(--bg-3)" }} contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: 10, fontSize: 12 }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="var(--accent)" maxBarSize={10} />
      </BarChart>
    </ResponsiveContainer>
  );
}
