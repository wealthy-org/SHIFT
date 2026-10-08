// Deterministic scoring from the raw snapshot trail + indexed trades.
// Same inputs always give the same score, flags and result hash.
import { CONFIG, rankIndex } from "./config";
import type { Flag, LiqEvent, Market, Snapshot, Trade } from "./types";
import { short } from "./util";

const norm = (x: number, ref: number) => 100 * Math.min(1, Math.log1p(Math.max(0, x)) / Math.log1p(ref));
const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

export interface ScoreResult {
  score: number;
  rank: number;
  components: Record<string, number>;
  avgMcap: number;
  volume: number;
  rawVolume: number;
  uniqueTraders: number;
  holders: number;
  liquidity: number;
  flags: Flag[];
  excludedShare: number;
}

export function cleanTrades(trades: Trade[], fundedBy: Record<string, string>, shiftEnd: number) {
  const flags: Flag[] = [];
  const seen = new Set<string>();
  const valid: Trade[] = [];
  let dup = 0;
  let failed = 0;
  for (const t of trades) {
    if (t.t > shiftEnd) continue;
    if (seen.has(t.id)) {
      dup++;
      continue;
    }
    seen.add(t.id);
    if (!t.ok) {
      failed++;
      continue;
    }
    valid.push(t);
  }
  const rawVolume = valid.reduce((a, t) => a + t.eth, 0);
  if (dup) flags.push({ code: "DUPLICATE_EVENTS", severity: "low", detail: `${dup} duplicate indexed events dropped`, wallets: [], excludedVolume: 0 });
  if (failed) flags.push({ code: "FAILED_TRADES", severity: "low", detail: `${failed} failed or reverted trades ignored`, wallets: [], excludedVolume: 0 });

  const byW: Record<string, Trade[]> = {};
  valid.forEach((t) => (byW[t.wallet] ||= []).push(t));
  const excluded = new Set<string>();

  // same-wallet self trading and wash volume
  for (const [w, ts] of Object.entries(byW)) {
    let flips = 0;
    let alt = 0;
    for (let i = 1; i < ts.length; i++) {
      if (ts[i].side === ts[i - 1].side) continue;
      alt++;
      if (ts[i].t - ts[i - 1].t <= 10) flips++;
    }
    const buy = ts.filter((t) => t.side === "buy").reduce((a, t) => a + t.eth, 0);
    const sell = ts.filter((t) => t.side === "sell").reduce((a, t) => a + t.eth, 0);
    const gross = buy + sell;
    const net = Math.abs(buy - sell);
    if (flips >= 3) {
      excluded.add(w);
      flags.push({ code: "SELF_TRADING", severity: "high", detail: `${short(w)} flipped buy/sell ${flips}x within 10s`, wallets: [short(w)], excludedVolume: gross });
    } else if (rawVolume > 0 && gross / rawVolume > 0.35 && net / gross < 0.15 && alt >= 3) {
      excluded.add(w);
      flags.push({ code: "WASH_VOLUME", severity: "high", detail: `${short(w)} produced ${((gross / rawVolume) * 100).toFixed(0)}% of volume with near-zero net`, wallets: [short(w)], excludedVolume: gross });
    }
  }
  // sybil clusters (wallets with a shared funder) and circular flow
  const clusters: Record<string, string[]> = {};
  Object.keys(byW).forEach((w) => (clusters[fundedBy[w] || w] ||= []).push(w));
  const sybilCollapse: Record<string, string> = {};
  for (const [c, ws] of Object.entries(clusters)) {
    if (ws.length < 3 || c.startsWith("org:")) continue;
    const all = ws.flatMap((w) => byW[w]);
    const buy = all.filter((t) => t.side === "buy").reduce((a, t) => a + t.eth, 0);
    const sell = all.filter((t) => t.side === "sell").reduce((a, t) => a + t.eth, 0);
    const gross = buy + sell;
    ws.forEach((w) => (sybilCollapse[w] = c));
    const alreadyExcl = ws.every((w) => excluded.has(w));
    ws.forEach((w) => excluded.add(w));
    flags.push({ code: "SYBIL_CLUSTER", severity: "high", detail: `${ws.length} wallets share one funder and were counted as 1 trader`, wallets: ws.map(short), excludedVolume: alreadyExcl ? 0 : gross });
    if (gross > 0 && Math.abs(buy - sell) / gross < 0.2) flags.push({ code: "CIRCULAR_TRADING", severity: "high", detail: `cluster flow nets to ${(Math.abs(buy - sell)).toFixed(2)} ETH on ${gross.toFixed(2)} ETH gross`, wallets: ws.map(short), excludedVolume: 0 });
  }
  const counted = valid.filter((t) => !excluded.has(t.wallet));
  const volume = counted.reduce((a, t) => a + t.eth, 0);
  const traders = new Set(counted.map((t) => sybilCollapse[t.wallet] || t.wallet)).size;
  return { flags, volume, rawVolume, traders, excluded, counted };
}

export function scoreShift(snaps: Snapshot[], m: Market, shiftEnd: number, opts: { live?: boolean } = {}): ScoreResult {
  const total = CONFIG.expectedSnapshots;
  const c = cleanTrades(m.trades, m.fundedBy, shiftEnd);
  const flags = c.flags.slice();

  // spike-resistant, time-weighted market cap: clamp each interval to 2x the median
  const twas = snaps.map((s) => s.mcapTwa);
  const med = median(twas);
  const clamped = twas.map((v) => Math.min(v, Math.max(med * 2, 0.01)));
  if (twas.some((v, i) => v > clamped[i] * 1.01)) {
    const spk = snaps.filter((s) => s.mcapMax > med * 3 && s.mcapEnd < s.mcapMax * 0.7);
    if (spk.length) flags.push({ code: "SHORT_SPIKE", severity: "low", detail: `price spiked to ${Math.max(...spk.map((s) => s.mcapMax)).toFixed(1)} ETH cap and reverted; interval values clamped`, wallets: [], excludedVolume: 0 });
  }
  const avgMcap = clamped.reduce((a, v) => a + v, 0) / total; // un-recorded intervals count as zero while live

  // transient liquidity: added late in the shift, pulled right after the close
  const liqMin = snaps.length ? Math.min(...snaps.map((s) => s.liquidityMin)) : 0;
  const lateAdds = m.liq.filter((l: LiqEvent) => l.kind === "add" && l.t >= shiftEnd - 40);
  const pulled = m.liq.filter((l: LiqEvent) => l.kind === "remove" && l.t > shiftEnd - 5);
  if (!opts.live && lateAdds.length && pulled.length) {
    flags.push({ code: "LIQUIDITY_IN_OUT", severity: "high", detail: `${lateAdds.reduce((a, l) => a + l.eth, 0).toFixed(1)} ETH liquidity added late and withdrawn after close`, wallets: lateAdds.map((l) => short(l.wallet)), excludedVolume: 0 });
  }
  const liquidity = snaps.length ? snaps[snaps.length - 1].liquidity : 0;

  const holders = snaps.length ? snaps[snaps.length - 1].holders : 0;
  const peakHolders = Math.max(1, ...snaps.map((s) => s.holders));
  const participants = (holders + c.traders) / 2;
  const mcs = snaps.map((s) => s.mcapTwa);
  let peak = 0;
  let dd = 0;
  mcs.forEach((v) => {
    peak = Math.max(peak, v);
    if (peak > 0) dd = Math.max(dd, (peak - v) / peak);
  });
  const activity = Math.min(1, c.counted.length / 25);
  const stability = (100 * (0.5 * (1 - dd) + 0.5 * (holders / peakHolders))) * activity;

  const components = {
    marketCap: norm(avgMcap, CONFIG.refs.marketCap),
    volume: norm(c.volume, CONFIG.refs.volume),
    participants: norm(participants, CONFIG.refs.participants),
    liquidity: norm(liqMin, CONFIG.refs.liquidity),
    stability,
  };
  const w = CONFIG.weights;
  let score =
    components.marketCap * w.marketCap +
    components.volume * w.volume +
    components.participants * w.participants +
    components.liquidity * w.liquidity +
    components.stability * w.stability;
  if (flags.some((f) => f.code === "LIQUIDITY_IN_OUT")) score = score - components.liquidity * w.liquidity; // transient liquidity earns nothing
  score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
  const excludedShare = c.rawVolume > 0 ? 1 - c.volume / c.rawVolume : 0;
  return { score, rank: rankIndex(score), components, avgMcap, volume: c.volume, rawVolume: c.rawVolume, uniqueTraders: c.traders, holders, liquidity, flags, excludedShare };
}
