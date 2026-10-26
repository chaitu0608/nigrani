import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Briefcase, Cpu, Gauge, Home, Inbox, Moon, Search, Sun, Zap } from "lucide-react";
import { api, type Alert } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Kbd } from "./ui";

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const nav = useNavigate(); const { dark, toggle } = useTheme();
  const [alerts, setAlerts] = useState<Alert[]>([]); const [q, setQ] = useState("");
  useEffect(() => { if (open) { setQ(""); api.alerts({ page_size: 200, status: undefined }).then((p) => setAlerts(p.items)).catch(() => {}); } }, [open]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(!open); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, setOpen]);
  const go = (p: string) => { setOpen(false); nav(p); };
  const Item = ({ onSelect, icon, children, hint, value }: { onSelect: () => void; icon: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode; value?: string }) => (
    <Command.Item value={value} onSelect={onSelect} className="group flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-[13px] text-fg-2 data-[selected=true]:bg-bg-3 data-[selected=true]:text-fg">
      <span className="text-fg-3 group-data-[selected=true]:text-fg">{icon}</span><span className="flex-1 truncate">{children}</span>{hint}
    </Command.Item>
  );
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setOpen(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
            className="w-full max-w-[620px] overflow-hidden rounded-2xl border border-line-2 bg-bg-2/95 shadow-2xl backdrop-blur-xl" onMouseDown={(e) => e.stopPropagation()}>
            <Command loop label="Command palette" filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="h-4 w-4 text-fg-3" />
                <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Search alerts, accounts, or jump to…" className="h-13 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3" />
                <Kbd>esc</Kbd>
              </div>
              <Command.List className="max-h-[380px] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3">
                <Command.Empty className="py-10 text-center text-sm text-fg-3">No results for “{q}”</Command.Empty>
                <Command.Group heading="Navigate">
                  <Item value="overview home" onSelect={() => go("/dashboard")} icon={<Gauge className="h-4 w-4" />} hint={<span className="flex gap-1"><Kbd>G</Kbd><Kbd>O</Kbd></span>}>Overview</Item>
                  <Item value="alert queue inbox" onSelect={() => go("/dashboard/queue")} icon={<Inbox className="h-4 w-4" />} hint={<span className="flex gap-1"><Kbd>G</Kbd><Kbd>Q</Kbd></span>}>Alert queue</Item>
                  <Item value="cases board" onSelect={() => go("/dashboard/cases")} icon={<Briefcase className="h-4 w-4" />} hint={<span className="flex gap-1"><Kbd>G</Kbd><Kbd>C</Kbd></span>}>Case board</Item>
                  <Item value="model card versions drift" onSelect={() => go("/dashboard/model")} icon={<Cpu className="h-4 w-4" />} hint={<span className="flex gap-1"><Kbd>G</Kbd><Kbd>M</Kbd></span>}>Model</Item>
                  <Item value="landing home page" onSelect={() => go("/")} icon={<Home className="h-4 w-4" />}>Landing page</Item>
                </Command.Group>
                <Command.Group heading="Actions">
                  <Item value="toggle theme dark light" onSelect={() => { toggle(); setOpen(false); }} icon={dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}>Switch to {dark ? "light" : "dark"} theme</Item>
                  <Item value="open highest risk alert top" onSelect={() => { const a = alerts.filter((x) => x.status !== "closed")[0]; if (a) go(`/dashboard/queue/${a.alert_id}`); }} icon={<Zap className="h-4 w-4" />}>Open highest-risk open alert</Item>
                </Command.Group>
                <Command.Group heading={`Alerts · ${alerts.length}`}>
                  {alerts.slice(0, q ? 200 : 6).map((a) => (
                    <Item key={a.alert_id} value={`${a.alert_id} account ${a.account} ${a.pattern} ${a.status}`} onSelect={() => go(`/dashboard/queue/${a.alert_id}`)} icon={<ArrowRight className="h-4 w-4" />}
                      hint={<span className="flex items-center gap-3 text-xs text-fg-3"><span className="capitalize">{a.pattern}</span><span className="tnum font-mono text-fg-2">{a.score.toFixed(3)}</span></span>}>
                      <span className="text-fg">Account {a.account}</span><span className="ml-2 font-mono text-xs text-fg-3">{a.date}</span>
                    </Item>
                  ))}
                </Command.Group>
              </Command.List>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[11px] text-fg-3">
                <span className="flex items-center gap-2"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate <Kbd>↵</Kbd> open</span>
                <span>Nigrani · ⌘K</span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
