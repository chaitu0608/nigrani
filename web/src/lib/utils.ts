import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));
export const pct = (x: number | undefined, d = 0) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
export const num = (x: number | undefined, d = 2) => (x == null ? "—" : x.toLocaleString("en-IN", { maximumFractionDigits: d }));
export const inr = (x: number) => (x >= 1e7 ? `₹${(x / 1e7).toFixed(2)} Cr` : x >= 1e5 ? `₹${(x / 1e5).toFixed(1)} L` : `₹${Math.round(x).toLocaleString("en-IN")}`);
export const human = (s: string) => s.replace(/_/g, " ");
export function ago(ts: string) {
  const t = new Date(ts.endsWith("Z") || ts.includes("+") ? ts : ts + "Z").getTime();
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`; return `${Math.round(s / 86400)}d ago`;
}
export const FEATURE_LABEL: Record<string, string> = {
  mkt_ret_3d: "3-day price run-up (bps)", illiquid_share: "Share of value in illiquid scrips", entity_peers_same_side: "KYC-linked peers on same side",
  sync_peers_5d: "Accounts trading in sync (5d)", mkt_vol_z: "Symbol volume z-score", prior_net_5d: "Net position built over 5d",
  sym_day_volume_share: "Share of symbol's daily volume", impact_bps: "Price impact (bps)", in_cycle: "Sits in a counterparty cycle",
  cp_round_trip_share: "Round-trip share with counterparties", counterparty_share: "Value traded with internal counterparties",
  top_cp_concentration: "Top counterparty concentration", repeat_cp_trades: "Repeat trades with same counterparty", cp_degree: "Counterparty degree",
  gross_value: "Gross traded value", n_trades: "Number of trades", n_symbols: "Symbols traded", buy_sell_balance: "Buy/sell balance",
  value_z_vs_own_history: "Value vs own history (z)", co_trader_overlap: "Co-trader overlap", px_dev_bps: "Deviation from VWAP (bps)",
  crowd_5d: "Crowding in symbol (5d)", reversal_score: "Position reversal", streak_days: "Same-side streak (days)", coord_entry: "Coordinated entry",
  entity_size: "KYC entity size", entity_peers_5d: "Entity peers active (5d)", sym_conc: "Symbol concentration",
};
export const label = (f: string) => FEATURE_LABEL[f] ?? human(f);
