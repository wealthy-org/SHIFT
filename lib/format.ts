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

// The engine's persisted state can carry events from before a chain migration
// (e.g. testnet records still in a DB that's now pointed at mainnet). Anything
// older than the cutover is linked against the legacy explorer instead, so the
// link actually resolves rather than 404ing on the chain it never happened on.
const LEGACY_EXPLORER = process.env.NEXT_PUBLIC_LEGACY_EXPLORER_URL || "";
const MIGRATION_CUTOVER_TS = Number(process.env.NEXT_PUBLIC_MIGRATION_CUTOVER_TS || 0);

// `real` is only true once the bridge confirms the tx actually landed onchain
// (lib/chain/bridge.ts). Demo/simulated events carry a synthetic tx that was
// never broadcast anywhere, so they never get an explorer link — not even the
// legacy one.
export const explorerTx = (tx: string, ts?: number, real?: boolean) => {
  if (!real) return "";
  const base = ts && MIGRATION_CUTOVER_TS && ts < MIGRATION_CUTOVER_TS ? LEGACY_EXPLORER : EXPLORER;
  return base ? `${base.replace(/\/$/, "")}/tx/${tx}` : "";
};
export const ponsToken = (token: string) => (PONS ? `${PONS.replace(/\/$/, "")}/token/${token}` : "");
