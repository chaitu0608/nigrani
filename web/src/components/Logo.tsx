export function Logo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="1" y="1" width="22" height="22" rx="6.5" className="fill-fg" />
      <circle cx="12" cy="12" r="4.6" stroke="var(--accent)" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="1.3" className="fill-bg" />
    </svg>
  );
}
