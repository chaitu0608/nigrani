import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Network } from "@/lib/api";
import { useTheme } from "@/lib/hooks";

type N = { id: number; focus: boolean; score: number; alert: boolean; acct_type: string; entity_id: number; x?: number; y?: number };
type L = { source: number | N; target: number | N; type: string; symbol?: string; days?: number };

export function NetworkGraph({ net, height = 460, onNode }: { net: Network; height?: number; onNode?: (id: number) => void }) {
  const box = useRef<HTMLDivElement>(null); const fg = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const [w, setW] = useState(600); const [hover, setHover] = useState<N | null>(null); const { dark } = useTheme();
  useEffect(() => { const ro = new ResizeObserver(([e]) => setW(e.contentRect.width)); if (box.current) ro.observe(box.current); return () => ro.disconnect(); }, []);
  const data = useMemo(() => ({ nodes: net.nodes.map((n) => ({ ...n })) as N[], links: net.edges.map((e) => ({ ...e })) as L[] }), [net]);
  const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const col = useMemo(() => ({ accent: css("--accent"), fg: css("--fg"), fg2: css("--fg-2"), fg3: css("--fg-3"), line: css("--line-2"), bg: css("--bg-2") }), [dark]); // eslint-disable-line react-hooks/exhaustive-deps
  const nbrs = useMemo(() => { const m = new Map<number, Set<number>>(); net.edges.forEach((e) => { (m.get(e.source) ?? m.set(e.source, new Set()).get(e.source)!).add(e.target); (m.get(e.target) ?? m.set(e.target, new Set()).get(e.target)!).add(e.source); }); return m; }, [net]);
  useEffect(() => { const f = fg.current; if (!f) return; f.d3Force("charge")?.strength(-90); f.d3Force("link")?.distance((l: L) => (l.type === "kyc" ? 30 : 60)); setTimeout(() => { f.zoomToFit(400, 60); setTimeout(() => { if (f.zoom() > 2.2) f.zoom(2.2, 300); }, 450); }, 900); }, [data]);
  const id = (x: number | N) => (typeof x === "object" ? x.id : x);
  const lit = (n: number) => !hover || hover.id === n || nbrs.get(hover.id)?.has(n);
  return (
    <div ref={box} className="relative overflow-hidden rounded-xl border border-line bg-bg" style={{ height }}>
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(var(--line-2)_1px,transparent_1px)] [background-size:18px_18px]" />
      <ForceGraph2D<N, L> ref={fg} graphData={data} width={w} height={height} backgroundColor="rgba(0,0,0,0)" cooldownTicks={120}
        nodeRelSize={4} onNodeHover={(n) => { setHover(n); if (box.current) box.current.style.cursor = n ? "pointer" : "grab"; }} onNodeClick={(n) => onNode?.(n.id)}
        linkColor={(l) => { const on = !hover || id(l.source) === hover.id || id(l.target) === hover.id; const c = l.type === "kyc" ? col.accent : l.type === "trade" ? col.fg2 : col.fg3; return on ? c + (l.type === "kyc" ? "cc" : "70") : c + "18"; }}
        linkWidth={(l) => (l.type === "kyc" ? 1.6 : l.type === "trade" ? 1.4 : 0.8)} linkLineDash={(l) => (l.type === "kyc" ? [3, 3] : null)}
        linkDirectionalParticles={(l) => (l.type === "trade" ? 2 : 0)} linkDirectionalParticleWidth={2} linkDirectionalParticleColor={() => col.accent}
        nodeCanvasObject={(n, ctx, k) => {
          const r = n.focus ? 7 : n.alert ? 5 : 3 + Math.min(2.5, n.score * 6); const on = lit(n.id); ctx.globalAlpha = on ? 1 : 0.18;
          if (n.focus) { ctx.beginPath(); ctx.arc(n.x!, n.y!, r + 6, 0, 2 * Math.PI); ctx.fillStyle = col.accent + "22"; ctx.fill(); ctx.beginPath(); ctx.arc(n.x!, n.y!, r + 3, 0, 2 * Math.PI); ctx.strokeStyle = col.accent + "66"; ctx.lineWidth = 1; ctx.stroke(); }
          ctx.beginPath(); ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
          ctx.fillStyle = n.focus ? col.accent : n.alert ? col.fg : col.bg; ctx.fill();
          ctx.lineWidth = n.focus ? 0 : 1.2; ctx.strokeStyle = n.alert ? col.fg : n.entity_id === net.nodes.find((x) => x.focus)?.entity_id ? col.accent : col.fg3; if (!n.focus) ctx.stroke();
          if (n.focus || n.alert || hover?.id === n.id || k > 2.2) {
            const fs = 11 / k; ctx.font = `${n.focus ? 600 : 500} ${fs}px Geist Variable, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "top";
            ctx.fillStyle = n.focus ? col.fg : col.fg2; ctx.fillText(String(n.id), n.x!, n.y! + r + 3 / k);
          }
          ctx.globalAlpha = 1;
        }}
        nodePointerAreaPaint={(n, c, ctx) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(n.x!, n.y!, 9, 0, 2 * Math.PI); ctx.fill(); }} />
      <div className="absolute left-3 top-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-line bg-bg-2/80 px-3 py-2 text-[11px] text-fg-2 backdrop-blur">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" />Focus</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-fg" />Alerted</span>
        <span className="flex items-center gap-1.5"><span className="h-px w-4 border-t border-dashed border-accent" />KYC link</span>
        <span className="flex items-center gap-1.5"><span className="h-px w-4 bg-fg-3" />Co-trade</span>
        <span className="flex items-center gap-1.5"><span className="h-px w-4 bg-fg-2" />Trade</span>
      </div>
      {hover && (
        <div className="absolute bottom-3 right-3 w-52 rounded-xl border border-line-2 bg-bg-2/95 p-3 text-xs shadow-xl backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between"><span className="font-medium">Account {hover.id}</span>{hover.alert && <span className="text-accent">alerted</span>}</div>
          <div className="flex justify-between text-fg-3"><span>Type</span><span className="text-fg-2">{hover.acct_type.replace(/_/g, " ")}</span></div>
          <div className="flex justify-between text-fg-3"><span>KYC entity</span><span className="font-mono text-fg-2">{hover.entity_id}</span></div>
          <div className="flex justify-between text-fg-3"><span>Score</span><span className="tnum font-mono text-fg-2">{hover.score.toFixed(4)}</span></div>
          <div className="flex justify-between text-fg-3"><span>Connections</span><span className="tnum font-mono text-fg-2">{nbrs.get(hover.id)?.size ?? 0}</span></div>
        </div>
      )}
    </div>
  );
}
