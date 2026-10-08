// Mock Pons market. The real integration goes behind PonsAdapter; nothing
// outside this file knows how the market is simulated.
import { CONFIG } from "./config";
import type { Market, Profile } from "./types";
import { hex, poisson, rand, randn, seedOf } from "./util";

export const SUPPLY = 1e9;
const BASE_ETH = 0.6;

export interface PonsAdapter {
  readonly name: string;
  readonly capabilities: { creatorFeeRouting: boolean };
  launch(employeeWallet: string, ticker: string, profile: Profile): Market;
  readMarket(m: Market): { marketCap: number; liquidity: number; holders: number; price: number };
}

export const mockPons: PonsAdapter = {
  name: "MockPons (testnet simulation)",
  capabilities: { creatorFeeRouting: true },
  launch(wallet, ticker, profile) {
    const token = hex(`token:${wallet}:${ticker}`, 40);
    const market = hex(`market:${wallet}:${ticker}`, 40);
    return {
      token,
      market,
      profile,
      rng: { s: seedOf(token) },
      reserveEth: BASE_ETH,
      reserveTok: SUPPLY,
      k: BASE_ETH * SUPPLY,
      holders: {},
      traders: [],
      fundedBy: {},
      nextOrganic: 0,
      trades: [],
      liq: [],
      feesEth: 0,
      seq: 0,
      secMcap: [],
      secLiq: [],
    };
  },
  readMarket(m) {
    const price = m.reserveEth / m.reserveTok;
    return { price, marketCap: price * SUPPLY, liquidity: m.reserveEth, holders: Object.values(m.holders).filter((v) => v > 0).length };
  },
};

export const marketCap = (m: Market) => (m.reserveEth / m.reserveTok) * SUPPLY;
export const holderCount = (m: Market) => Object.values(m.holders).filter((v) => v > 1e-6).length;

// Each shift is measured on a clean microstructure so shifts are comparable.
export function rebase(m: Market) {
  m.reserveEth = BASE_ETH;
  m.reserveTok = SUPPLY;
  m.k = BASE_ETH * SUPPLY;
  m.holders = {};
  m.traders = [];
  m.trades = [];
  m.liq = [];
  m.secMcap = [];
  m.secLiq = [];
  m.feesEth = 0;
}

const PROFILES: Record<Profile, { rate: number; median: number; buyBias: number }> = {
  normal: { rate: 0.2, median: 0.1, buyBias: 0.62 },
  high: { rate: 0.55, median: 0.16, buyBias: 0.66 },
  low: { rate: 0.05, median: 0.04, buyBias: 0.55 },
  pumpdump: { rate: 0.06, median: 0.05, buyBias: 0.55 },
  wash: { rate: 0.05, median: 0.05, buyBias: 0.55 },
  liqmanip: { rate: 0.05, median: 0.05, buyBias: 0.55 },
};

function exec(m: Market, wallet: string, side: "buy" | "sell", ethAmt: number, t: number, ok = true, fundedBy?: string) {
  if (fundedBy && !m.fundedBy[wallet]) m.fundedBy[wallet] = fundedBy;
  if (!m.fundedBy[wallet]) m.fundedBy[wallet] = "org:" + wallet;
  if (!m.traders.includes(wallet)) m.traders.push(wallet);
  const id = `${m.token.slice(2, 8)}-${m.seq++}`;
  if (!ok) {
    m.trades.push({ id, t, wallet, side, eth: ethAmt, ok: false });
    return;
  }
  if (side === "buy") {
    const fee = (ethAmt * CONFIG.tradeFeeBps) / 10000;
    const inNet = ethAmt - fee;
    const newE = m.reserveEth + inNet;
    const newT = m.k / newE;
    m.holders[wallet] = (m.holders[wallet] || 0) + (m.reserveTok - newT);
    m.reserveEth = newE;
    m.reserveTok = newT;
    m.feesEth += (fee * CONFIG.creatorFeeSharePct) / 100;
    m.trades.push({ id, t, wallet, side, eth: ethAmt, ok: true });
  } else {
    // ethAmt is the target proceeds; clamp to what the wallet holds
    const bal = m.holders[wallet] || 0;
    if (bal <= 0) return;
    // tokens needed for ethAmt proceeds: solve k/(T+x) = E - ethAmt
    const targetE = Math.max(m.reserveEth - ethAmt, BASE_ETH * 0.2);
    let tokIn = m.k / targetE - m.reserveTok;
    if (tokIn > bal || tokIn <= 0) tokIn = bal;
    const newT = m.reserveTok + tokIn;
    const newE = m.k / newT;
    const out = m.reserveEth - newE;
    const fee = (out * CONFIG.tradeFeeBps) / 10000;
    m.holders[wallet] = bal - tokIn;
    m.reserveEth = newE;
    m.reserveTok = newT;
    m.feesEth += (fee * CONFIG.creatorFeeSharePct) / 100;
    m.trades.push({ id, t, wallet, side, eth: out, ok: true });
  }
  // the indexer sometimes delivers an event twice
  if (rand(m.rng) < 0.02) m.trades.push({ ...m.trades[m.trades.length - 1] });
}

function sellAll(m: Market, wallet: string, t: number, fraction = 1) {
  const bal = m.holders[wallet] || 0;
  if (bal <= 0) return;
  const tokIn = bal * fraction;
  const newT = m.reserveTok + tokIn;
  const newE = m.k / newT;
  const out = m.reserveEth - newE;
  m.holders[wallet] = bal - tokIn;
  m.reserveEth = newE;
  m.reserveTok = newT;
  m.trades.push({ id: `${m.token.slice(2, 8)}-${m.seq++}`, t, wallet, side: "sell", eth: out, ok: true });
}

function addLiq(m: Market, ethAmt: number, wallet: string, t: number) {
  const f = (m.reserveEth + ethAmt) / m.reserveEth;
  m.reserveEth *= f;
  m.reserveTok *= f;
  m.k = m.reserveEth * m.reserveTok;
  m.liq.push({ t, kind: "add", eth: ethAmt, wallet });
}
function removeLiq(m: Market, ethAmt: number, wallet: string, t: number) {
  const target = Math.max(m.reserveEth - ethAmt, BASE_ETH * 0.5);
  const f = target / m.reserveEth;
  m.reserveEth *= f;
  m.reserveTok *= f;
  m.k = m.reserveEth * m.reserveTok;
  m.liq.push({ t, kind: "remove", eth: ethAmt, wallet });
}

const W = (m: Market, tag: string) => hex(`${m.token}:${tag}`, 40);

// One virtual second of trading. `el` is shift-elapsed seconds.
export function stepMarket(m: Market, el: number) {
  const P = PROFILES[m.profile];
  const r = m.rng;
  const live = el < CONFIG.shiftSeconds;

  if (live) {
    const lam = P.rate * (el < 30 ? 1.5 : 1);
    const n = poisson(r, lam);
    for (let i = 0; i < n; i++) {
      const fresh = m.traders.length < 3 || rand(r) < 0.35;
      const wallet = fresh ? hex(`${m.token}:o:${m.nextOrganic++}`, 40) : m.traders[Math.floor(rand(r) * m.traders.length)];
      const size = P.median * Math.exp(0.6 * randn(r));
      const bal = m.holders[wallet] || 0;
      const sell = bal > 0 && rand(r) > P.buyBias + (el > 240 ? -0.1 : 0);
      const ok = rand(r) > 0.03;
      if (sell) exec(m, wallet, "sell", size * (0.5 + rand(r)), el, ok);
      else exec(m, wallet, "buy", size, el, ok);
    }
  }

  if (m.profile === "pumpdump") {
    const whale = W(m, "whale");
    if (el >= 100 && el < 103) exec(m, whale, "buy", 1.6, el);
    if (el === 112) sellAll(m, whale, el, 0.6);
    if (el === 113) sellAll(m, whale, el, 1);
  }
  if (m.profile === "wash" && live) {
    const w = W(m, "washer");
    if (el % 2 === 0 && el > 5) {
      if ((m.holders[w] || 0) > 0) sellAll(m, w, el, 1);
      else exec(m, w, "buy", 0.7, el);
    }
    const cl = [1, 2, 3].map((i) => W(m, "cl" + i));
    const phase = el % 6;
    if (el > 10 && phase === 0) cl.forEach((c, i) => i < 2 && exec(m, c, "buy", 0.5, el, true, "cluster:A"));
    if (el > 10 && phase === 3) cl.forEach((c, i) => i < 2 && sellAll(m, c, el, 1));
    if (el > 10 && phase === 4) exec(m, cl[2], "buy", 0.2, el, true, "cluster:A");
    if (el > 10 && phase === 5) sellAll(m, cl[2], el, 1);
  }
  if (m.profile === "liqmanip") {
    const lp = W(m, "lp");
    if (el === 266) addLiq(m, 8, lp, el);
    if (el === 304) removeLiq(m, 8, lp, el);
  }
  m.secMcap.push(marketCap(m));
  m.secLiq.push(m.reserveEth);
}
