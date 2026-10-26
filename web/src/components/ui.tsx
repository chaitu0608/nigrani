import * as React from "react";
import * as DialogP from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[13px] font-medium transition-[background,color,border,box-shadow,transform] duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 select-none",
  {
    variants: {
      variant: {
        primary: "bg-fg text-bg hover:opacity-90 shadow-[0_1px_0_rgba(255,255,255,.1)_inset]",
        accent: "bg-accent text-accent-fg hover:brightness-110",
        secondary: "bg-bg-2 border border-line-2 text-fg hover:bg-bg-3",
        ghost: "text-fg-2 hover:text-fg hover:bg-bg-3",
        danger: "bg-bg-2 border border-line-2 text-fg hover:border-red-500/40 hover:text-red-500",
      },
      size: { sm: "h-7 px-2.5 text-xs", md: "h-8 px-3", lg: "h-10 px-4 text-sm", icon: "h-8 w-8" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);
export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>>(
  ({ className, variant, size, ...p }, ref) => <button ref={ref} className={cn(button({ variant, size }), className)} {...p} />,
);
Button.displayName = "Button";

export const Kbd = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <kbd className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-2 bg-bg-3 px-1 font-mono text-[10.5px] text-fg-3 leading-none", className)}>{children}</kbd>
);

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-bg-2 shadow-card", className)} {...p}>{children}</div>;
}
export function CardHeader({ title, hint, right, icon }: { title: string; hint?: React.ReactNode; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-fg-3">{icon}</span>}
        <h3 className="text-[13px] font-medium tracking-tight">{title}</h3>
        {hint && <span className="truncate text-xs text-fg-3">{hint}</span>}
      </div>
      {right}
    </div>
  );
}

const tone: Record<string, string> = {
  neutral: "text-fg-2 bg-bg-3 border-line-2",
  accent: "text-accent bg-accent-soft border-accent/20",
  muted: "text-fg-3 bg-transparent border-line-2",
  solid: "text-bg bg-fg border-transparent",
};
export function Badge({ children, t = "neutral", dot, className }: { children: React.ReactNode; t?: keyof typeof tone; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-md border px-1.5 text-[11px] font-medium capitalize leading-none", tone[t], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const statusTone: Record<string, keyof typeof tone> = { open: "neutral", assigned: "neutral", escalated: "accent", closed: "muted", under_review: "neutral", str_filed: "accent", closed_no_action: "muted" };
export function StatusPill({ status }: { status: string }) {
  const icon: Record<string, React.ReactNode> = {
    open: <svg viewBox="0 0 14 14" className="h-3 w-3"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>,
    assigned: <svg viewBox="0 0 14 14" className="h-3 w-3"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M7 3.5A3.5 3.5 0 0 1 7 10.5Z" fill="currentColor" /></svg>,
    escalated: <svg viewBox="0 0 14 14" className="h-3 w-3"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M7 3.5A3.5 3.5 0 1 1 3.5 7H7Z" fill="currentColor" /></svg>,
    closed: <svg viewBox="0 0 14 14" className="h-3 w-3"><circle cx="7" cy="7" r="6" fill="currentColor" /><path d="M4.5 7.2l1.7 1.7 3.4-3.6" stroke="var(--bg-2)" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>,
  };
  return <span className={cn("inline-flex items-center gap-1.5 text-xs capitalize", status === "escalated" ? "text-accent" : status === "closed" ? "text-fg-3" : "text-fg-2")}>{icon[status] ?? icon.open}{status.replace(/_/g, " ")}</span>;
}
export { statusTone };

export function ScoreBar({ score, threshold, className }: { score: number; threshold?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-1 w-14 overflow-hidden rounded-full bg-bg-3">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.max(2, score * 100)}%`, opacity: 0.35 + score * 0.65 }} />
        {threshold != null && <div className="absolute inset-y-0 w-px bg-fg-3" style={{ left: `${threshold * 100}%` }} />}
      </div>
      <span className="tnum font-mono text-xs text-fg">{score.toFixed(3)}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-md bg-bg-3 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-fg/[.04] before:to-transparent", className)} />;
}

export function Empty({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-line-2 bg-bg-3 text-fg-3">{icon}</div>
      <div className="text-sm font-medium">{title}</div>
      {body && <p className="max-w-xs text-xs leading-relaxed text-fg-3">{body}</p>}
      {action}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn("h-8 w-full rounded-lg border border-line-2 bg-bg-2 px-2.5 text-[13px] text-fg placeholder:text-fg-3 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/15", className)} {...p} />
));
Input.displayName = "Input";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn("min-h-24 w-full resize-none rounded-lg border border-line-2 bg-bg-2 px-3 py-2 text-[13px] leading-relaxed text-fg placeholder:text-fg-3 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/15", className)} {...p} />
));
Textarea.displayName = "Textarea";

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  const id = React.useId();
  return (
    <div className={cn("inline-flex h-8 items-center rounded-lg border border-line bg-bg-2 p-0.5", className)}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cn("relative h-full rounded-md px-2.5 text-xs font-medium transition-colors", value === o.value ? "text-fg" : "text-fg-3 hover:text-fg-2")}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-md border border-line-2 bg-bg-3" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Dialog({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <DialogP.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogP.Portal forceMount>
            <DialogP.Overlay asChild><motion.div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /></DialogP.Overlay>
            <DialogP.Content asChild>
              <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 4 }} transition={{ type: "spring", bounce: 0.1, duration: 0.35 }}
                className={cn("fixed left-1/2 top-[18%] z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-line-2 bg-bg-2 p-5 shadow-2xl outline-none", className)}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <DialogP.Title className="text-[15px] font-medium tracking-tight">{title}</DialogP.Title>
                    {description && <DialogP.Description className="mt-1 text-xs leading-relaxed text-fg-3">{description}</DialogP.Description>}
                  </div>
                  <DialogP.Close className="rounded-md p-1 text-fg-3 hover:bg-bg-3 hover:text-fg"><X className="h-4 w-4" /></DialogP.Close>
                </div>
                {children}
              </motion.div>
            </DialogP.Content>
          </DialogP.Portal>
        )}
      </AnimatePresence>
    </DialogP.Root>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs text-fg-3">{label}</span>
      <span className="tnum text-2xl font-medium tracking-tight">{value}</span>
      {sub && <span className="text-xs text-fg-3">{sub}</span>}
    </div>
  );
}

export function useHotkey(key: string, fn: (e: KeyboardEvent) => void, deps: React.DependencyList = [], opts: { meta?: boolean } = {}) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (!opts.meta && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (opts.meta ? (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key : !e.metaKey && !e.ctrlKey && !e.altKey && e.key === key) {
        if (document.querySelector("[role=dialog][data-state=open]") && !opts.meta) return;
        e.preventDefault(); fn(e);
      }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
