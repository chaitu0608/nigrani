import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Briefcase, Cpu, Gauge, Inbox, KeyRound, Menu, Moon, Search, Sun, X } from "lucide-react";
import { api, getKey, setKey } from "@/lib/api";
import { refreshAll, useData, useMedia, useTheme } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { Button, Dialog, Input, Kbd } from "./ui";
import { toast } from "sonner";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: Gauge, end: true, key: "o" },
  { to: "/dashboard/queue", label: "Alert queue", icon: Inbox, key: "q" },
  { to: "/dashboard/cases", label: "Cases", icon: Briefcase, key: "c" },
  { to: "/dashboard/model", label: "Model", icon: Cpu, key: "m" },
];

export function AppShell() {
  const [palette, setPalette] = useState(false); const [keyOpen, setKeyOpen] = useState(false); const [mobile, setMobile] = useState(false);
  const { dark, toggle } = useTheme(); const loc = useLocation(); const nav = useNavigate(); const wide = useMedia("(min-width: 1024px)");
  const me = useData(() => api.me(), [keyOpen]); const stats = useData(() => api.stats());
  const g = useRef(0);
  useEffect(() => setMobile(false), [loc.pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || document.querySelector("[role=dialog]")) return;
      if (e.key === "g") { g.current = Date.now(); return; }
      if (Date.now() - g.current < 800) { const n = NAV.find((x) => x.key === e.key); if (n) { nav(n.to); g.current = 0; } }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [nav]);
  const open = (stats.data?.alerts_by_status.open ?? 0) + (stats.data?.alerts_by_status.assigned ?? 0) + (stats.data?.alerts_by_status.escalated ?? 0);
  const side = (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-line bg-bg px-3 py-4">
      <Link to="/" className="mb-6 flex items-center gap-2.5 px-2"><Logo /><span className="text-[15px] font-semibold tracking-tight">Nigrani</span><span className="ml-auto rounded-md border border-line-2 px-1.5 py-0.5 font-mono text-[10px] text-fg-3">v1</span></Link>
      <button onClick={() => setPalette(true)} className="mb-5 flex h-8 items-center gap-2 rounded-lg border border-line bg-bg-2 px-2.5 text-[13px] text-fg-3 transition hover:border-line-2 hover:text-fg-2">
        <Search className="h-3.5 w-3.5" /><span className="flex-1 text-left">Search…</span><Kbd>⌘K</Kbd>
      </button>
      <nav className="space-y-0.5">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn("relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors", isActive ? "text-fg" : "text-fg-2 hover:bg-bg-3 hover:text-fg")}>
            {({ isActive }) => (<>
              {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-bg-3 shadow-[inset_0_0_0_1px_var(--line-2)]" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
              <n.icon className="relative h-4 w-4" strokeWidth={1.75} /><span className="relative flex-1">{n.label}</span>
              {n.key === "q" && open > 0 && <span className="relative tnum rounded-md bg-accent-soft px-1.5 py-0.5 font-mono text-[10.5px] text-accent">{open}</span>}
            </>)}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        <div className="rounded-xl border border-line bg-bg-2 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium"><span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>Model online</div>
          <p className="text-[11px] leading-relaxed text-fg-3">pattern_heads_catboost_v3 · 1.0% alert budget</p>
        </div>
        <div className="flex items-center gap-2 px-1">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-accent to-fg-3 text-[11px] font-semibold uppercase text-accent-fg">{me.data?.user?.[0] ?? "·"}</div>
          <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13px] font-medium capitalize">{me.data?.user ?? "…"}</div><div className="text-[11px] capitalize text-fg-3">{me.data?.role ?? (me.error ? "invalid key" : "")}</div></div>
          <Button variant="ghost" size="icon" onClick={() => setKeyOpen(true)} title="API key"><KeyRound className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
        </div>
      </div>
    </aside>
  );
  return (
    <div className="flex h-full">
      {wide ? side : (
        <AnimatePresence>{mobile && (<>
          <motion.div className="fixed inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobile(false)} />
          <motion.div className="fixed inset-y-0 left-0 z-50" initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}>{side}</motion.div>
        </>)}</AnimatePresence>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {!wide && (
          <header className="flex h-12 items-center gap-3 border-b border-line px-4">
            <Button variant="ghost" size="icon" onClick={() => setMobile(true)}>{mobile ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</Button>
            <Logo /><span className="font-semibold tracking-tight">Nigrani</span>
            <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setPalette(true)}><Search className="h-4 w-4" /></Button>
          </header>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname.split("/").slice(0, 3).join("/")} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }} className="h-full">
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette open={palette} setOpen={setPalette} />
      <KeyDialog open={keyOpen} setOpen={setKeyOpen} />
    </div>
  );
}

function KeyDialog({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const [v, setV] = useState(getKey()); useEffect(() => { if (open) setV(getKey()); }, [open]);
  const save = async () => {
    setKey(v.trim()); try { const m = await api.me(); toast.success(`Signed in as ${m.user}`, { description: `Role: ${m.role}` }); setOpen(false); refreshAll(); }
    catch (e) { toast.error("Key rejected", { description: (e as Error).message }); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen} title="API key" description="Requests go to the Nigrani API with this X-API-Key. Demo keys: analyst-dev-key (analyst), admin-dev-key (admin).">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
        <Input value={v} onChange={(e) => setV(e.target.value)} className="font-mono" autoFocus />
        <div className="flex flex-wrap gap-1.5">{["analyst-dev-key", "admin-dev-key"].map((k) => <button type="button" key={k} onClick={() => setV(k)} className="rounded-md border border-line-2 px-2 py-1 font-mono text-[11px] text-fg-2 hover:bg-bg-3">{k}</button>)}</div>
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit">Save key</Button></div>
      </form>
    </Dialog>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-6 pt-8 lg:px-10">
      <div><h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>{sub && <p className="mt-1 text-[13px] text-fg-3">{sub}</p>}</div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
