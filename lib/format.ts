export const pad = (n: number) => String(n).padStart(2, "0");
export const mmss = (x: number) => pad(Math.floor(Math.max(0, x) / 60)) + ":" + pad(Math.floor(Math.max(0, x) % 60));
export const short = (a?: string | null) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "");
export const ago = (ts: number, now: number) => {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return "Just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
export const LIME = "#C8F135";
export const LIME_INK = "var(--lime-ink)";
export const CHIP: Record<string, [string, string, string]> = {
  "CLOCKED IN": ["transparent", "var(--ink-soft)", "var(--line-x)"],
  WORKING: ["rgba(200,241,53,0.12)", LIME_INK, "rgba(200,241,53,0.35)"],
  PROMOTED: [LIME, "#0F130E", LIME],
  "SHIFT COMPLETE": ["var(--chip)", "var(--ink)", "var(--line-strong)"],
  PAID: ["#E4E7DA", "#0F130E", "#E4E7DA"],
};
export const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_URL || "";
export const PONS = process.env.NEXT_PUBLIC_PONS_URL || "";
export const explorerTx = (tx: string) => (EXPLORER ? `${EXPLORER.replace(/\/$/, "")}/tx/${tx}` : "");
export const ponsToken = (token: string) => (PONS ? `${PONS.replace(/\/$/, "")}/token/${token}` : "");
