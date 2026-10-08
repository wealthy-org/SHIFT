// Read models for the UI. Everything the frontend shows is derived here from
// engine state; the browser never owns shift or payroll state.
import { CONFIG, RANK_NAMES } from "./config";
import { blockAt, epochOf, getEpoch, leafProof, shareOf } from "./engine";
import { holderCount, marketCap } from "./market";
import { scoreShift } from "./scoring";
import type { Employee, Epoch, Shift, State } from "./types";
import { eth, short } from "./util";

const lastShift = (s: State, e: Employee): Shift | undefined => s.shifts[e.shiftIds[e.shiftIds.length - 1]];
const lastValid = (s: State, e: Employee) => [...e.shiftIds].reverse().map((i) => s.shifts[i]).find((x) => x?.status === "COMPLETED");
const elapsed = (sh: Shift, now: number) => Math.max(0, Math.min(CONFIG.shiftSeconds, Math.round((now - sh.startedAt) / 1000)));

export function statusOf(s: State, e: Employee, now: number) {
  const sh = lastShift(s, e);
  if (e.activeShiftId) return elapsed(s.shifts[e.activeShiftId], now) < CONFIG.snapshotSeconds ? "CLOCKED IN" : "WORKING";
  if (!sh) return "CLOCKED IN";
  if (e.promotedUntil && now < e.promotedUntil) return "PROMOTED";
  if (sh.status === "COMPLETED" && sh.epochId) {
    const l = s.epochs[sh.epochId]?.leaves.find((x) => x.employeeId === e.employeeId);
    if (l?.claimedAt) return "PAID";
  }
  return "SHIFT COMPLETE";
}

export function estimate(s: State, empId: number, now: number) {
  const cur = epochOf(s, now);
  const ep = getEpoch(s, cur);
  const pool = ((ep.feeRevenue + CONFIG.epochGrantEth * 1e9) * CONFIG.payrollPct) / 100 + s.vault.carry;
  let mine = 0;
  let total = 0;
  const sharesFor = (sh: Shift) => {
    if (sh.status === "COMPLETED") return sh.epochId === cur || (sh.epochId && s.epochs[sh.epochId]?.status === "OPEN") ? shareOf(sh.performanceScore, sh.finalRank) : 0;
    if (sh.status === "ACTIVE" || sh.status === "FINALIZING" || sh.status === "PENDING") {
      const sc = sh.snapshots.length ? sh.snapshots[sh.snapshots.length - 1].liveScore : 0;
      return shareOf(sc, Math.min(7, RANK_NAMES.length - 1, rankFor(sc)));
    }
    return 0;
  };
  for (const sh of Object.values(s.shifts)) {
    if (sh.startedAt < ep.startTime - CONFIG.shiftSeconds * 1000) continue;
    const open = sh.status === "COMPLETED" ? !!sh.epochId && s.epochs[sh.epochId]?.status === "OPEN" : sh.status !== "INVALID";
    if (!open) continue;
    const v = sharesFor(sh);
    total += v;
    if (sh.employeeId === empId) mine += v;
  }
  return { epochId: cur, poolGwei: pool, poolEth: pool / 1e9, shares: total > 0 ? mine / total : 0, payEth: total > 0 ? ((pool * mine) / total) / 1e9 : 0 };
}
const rankFor = (sc: number) => {
  let r = 0;
  CONFIG.ranks.forEach(([, m], i) => sc >= m && (r = i));
  return r;
};

export function deskOf(s: State, e: Employee, now: number) {
  const act = e.activeShiftId ? s.shifts[e.activeShiftId] : undefined;
  const last = lastShift(s, e);
  const m = s.markets[e.tokenAddress!];
  const shown = act || last;
  const score = act ? (act.snapshots.length ? act.snapshots[act.snapshots.length - 1].liveScore : 0) : last?.status === "COMPLETED" ? last.performanceScore : 0;
  const secs = act ? elapsed(act, now) : last ? CONFIG.shiftSeconds : 0;
  const snapsDone = act ? act.snapshots.length : last ? last.snapshots.length || CONFIG.expectedSnapshots - last.missing : 0;
  return {
    id: e.employeeId, code: e.code, name: e.displayName, ticker: e.ticker, c1: e.avatar[0], c2: e.avatar[1], wallet: e.wallet,
    status: statusOf(s, e, now), rank: RANK_NAMES[act ? rankFor(score) : e.currentRank], score, mcap: m ? marketCap(m) : 0, secs, snapsDone,
    pay: eth(e.totalPayrollEarned) + estimate(s, e.employeeId, now).payEth, test: e.testLabel || null, sim: e.bot || !!e.testLabel, shiftStatus: shown?.status || null,
  };
}

export function officeView(s: State, now: number) {
  const emps = Object.values(s.employees).filter((e) => e.launchStatus === "LIVE");
  const desks = emps.map((e) => deskOf(s, e, now));
  const cur = getEpoch(s, epochOf(s, now));
  const est = estimate(s, 0, now);
  return {
    now, epochId: cur.epochId, payday: Math.max(0, Math.round((cur.endTime - now) / 1000)),
    onShift: desks.filter((d) => d.status === "WORKING" || d.status === "CLOCKED IN").length, total: emps.length, launches: emps.length, poolEth: est.poolEth, desks,
    simCount: desks.filter((d) => d.sim).length,
    network: { block: blockAt(s, now), name: "Robinhood Chain Testnet (simulated)" },
  };
}

export const epochClock = (s: State, now: number) => Math.max(0, Math.round((getEpoch(s, epochOf(s, now)).endTime - now) / 1000));

export function meView(s: State, wallet: string, now: number) {
  const id = s.byWallet[wallet.toLowerCase()];
  if (!id) return { employee: null };
  const e = s.employees[id];
  const l = s.launches[id];
  return {
    employee: { id, code: e.code, name: e.displayName, ticker: e.ticker, c1: e.avatar[0], c2: e.avatar[1], dept: e.department, badge: e.badge, wallet: e.wallet, token: e.tokenAddress || null, market: e.ponsMarketAddress || null, rank: RANK_NAMES[e.currentRank], launchStatus: e.launchStatus, hasShift: !!e.activeShiftId },
    launch: l ? { step: l.step, confirmations: l.confirmations, done: l.done, reverted: l.reverted, error: l.error || null } : null,
    secsToEpoch: Math.max(0, Math.round((getEpoch(s, epochOf(s, now)).endTime - now) / 1000)),
    cooldown: e.lastShiftEndedAt ? Math.max(0, Math.ceil((CONFIG.userCooldownSeconds * 1000 - (now - e.lastShiftEndedAt)) / 1000)) : 0,
  };
}

const evView = (s: State, ev: any, now: number) => ({ ...ev, final: blockAt(s, now) - ev.block >= CONFIG.confirmDepth, depth: Math.max(0, blockAt(s, now) - ev.block) });

export function employeeView(s: State, id: number, now: number) {
  const e = s.employees[id];
  if (!e) return null;
  const act = e.activeShiftId ? s.shifts[e.activeShiftId] : undefined;
  const sh = act || lastShift(s, e);
  const m = e.tokenAddress ? s.markets[e.tokenAddress] : undefined;
  const el = sh ? (act ? elapsed(act, now) : CONFIG.shiftSeconds) : 0;
  const done = !!sh && !act;
  const snaps = sh?.snapshots || [];
  const live = act ? (snaps.length ? snaps[snaps.length - 1].liveScore : 0) : sh?.status === "COMPLETED" ? sh.performanceScore : snaps.length ? snaps[snaps.length - 1].liveScore : 0;
  const est = estimate(s, id, now);
  const doneShift = sh && !act && sh.status === "COMPLETED";
  const last = snaps[snaps.length - 1];
  const history = [...e.shiftIds].reverse().slice(0, 25).map((i) => s.shifts[i]);
  const epochRows = Object.values(s.epochs).filter((ep) => ep.leaves.some((l) => l.employeeId === id)).sort((a, b) => b.epochId - a.epochId).slice(0, 25);
  const best = Math.max(e.currentRank, ...history.filter((x) => x.status === "COMPLETED").map((x) => x.finalRank), 0);
  const lr = lastValid(s, e);
  return {
    now,
    me: { id, code: e.code, name: e.displayName, ticker: e.ticker, c1: e.avatar[0], c2: e.avatar[1], dept: e.department, wallet: e.wallet, token: e.tokenAddress, market: e.ponsMarketAddress, test: e.testLabel || null, sim: e.bot || !!e.testLabel, profile: e.profile },
    status: statusOf(s, e, now), rank: RANK_NAMES[act ? rankFor(live) : e.currentRank], best: RANK_NAMES[best], launchStatus: e.launchStatus,
    shift: sh ? {
      id: sh.shiftId, code: sh.code, status: sh.status, active: !!act, done, elapsed: el, left: CONFIG.shiftSeconds - el, snaps: snaps.length, missing: sh.missing,
      score: live, projectedRank: RANK_NAMES[rankFor(live)], payEth: doneShift ? eth(sh.payrollAmount) || est.payEth : est.payEth, payFinal: !!(doneShift && sh.payrollAmount),
      perf: [0, ...snaps.map((x) => x.liveScore)], mcap: [m ? 0.6 : 0, ...snaps.map((x) => x.mcapEnd)],
      volume: last?.volume || 0, liquidity: last?.liquidity || 0, holders: (last?.holders || 0) + (last?.uniqueTraders || 0),
      flags: sh.flags, invalidReason: sh.invalidReason || null, components: sh.components || (act && m && snaps.length ? scoreShift(snaps, m, el, { live: true }).components : null), resultHash: sh.resultHash || null,
    } : null,
    totals: { payroll: eth(e.totalPayrollEarned), shifts: e.totalShifts, bestScore: e.bestPerformanceScore },
    cooldown: e.lastShiftEndedAt ? Math.max(0, Math.ceil((CONFIG.userCooldownSeconds * 1000 - (now - e.lastShiftEndedAt)) / 1000)) : 0,
    result: lr && lr.finalizedAt ? { shiftId: lr.shiftId, code: lr.code, promoted: lr.promoted, from: RANK_NAMES[lr.prevRank], to: RANK_NAMES[lr.finalRank], score: lr.performanceScore, at: lr.finalizedAt, fresh: now - lr.finalizedAt < 60000 } : null,
    history: history.map((x) => ({ id: x.shiftId, code: x.code, startedAt: x.startedAt, score: x.performanceScore, rank: x.status === "COMPLETED" ? RANK_NAMES[x.finalRank] : "-", payroll: eth(x.payrollAmount), settled: !!x.payrollAmount, status: x.status, reason: x.invalidReason || null, flags: x.flags.map((f) => f.code), hash: x.resultHash })),
    promotions: e.rankHistory.slice().reverse().map((p) => ({ from: RANK_NAMES[p.from], to: RANK_NAMES[p.to], score: p.score, ts: p.ts, tx: p.tx })),
    payrolls: epochRows.map((ep) => payRow(ep, id)),
    proofs: s.events.filter((x) => x.employeeId === id).slice(-40).reverse().map((x) => evView(s, x, now)),
    estimate: est,
  };
}
const payRow = (ep: Epoch, id: number) => {
  const l = ep.leaves.find((x) => x.employeeId === id)!;
  return { epochId: ep.epochId, shares: ep.totalShares ? l.shares / ep.totalShares : 0, amount: eth(l.amount), claimed: !!l.claimedAt, claimTx: l.claimTx || null, finalizedAt: ep.finalizedAt, root: ep.merkleRoot };
};

export function leaderboardView(s: State, now: number, view: string, sort: string) {
  const cutoff = { "24 hours": 24 * 3600e3, "7 days": 7 * 24 * 3600e3, "All time": Infinity }[view as string];
  const rows: any[] = [];
  for (const e of Object.values(s.employees)) {
    if (e.launchStatus !== "LIVE") continue;
    const mine = e.shiftIds.map((i) => s.shifts[i]);
    let r: any;
    if (!cutoff) {
      const act = e.activeShiftId ? s.shifts[e.activeShiftId] : undefined;
      const sh = act || lastValid(s, e);
      if (!sh) continue;
      const last = sh.snapshots[sh.snapshots.length - 1];
      r = { score: act ? last?.liveScore || 0 : sh.performanceScore, mcap: act ? (sh.snapshots.reduce((a, x) => a + x.mcapTwa, 0) / CONFIG.expectedSnapshots) : sh.averageMarketCap, vol: act ? last?.volume || 0 : sh.volume, pay: act ? estimate(s, e.employeeId, now).payEth : eth(sh.payrollAmount), best: act ? rankFor(last?.liveScore || 0) : sh.finalRank };
    } else {
      const w = mine.filter((x) => x.status === "COMPLETED" && now - (x.finalizedAt || 0) <= cutoff);
      if (!w.length) continue;
      const sum = (f: (x: Shift) => number) => w.reduce((a, x) => a + f(x), 0);
      r = { score: sum((x) => x.performanceScore) / w.length, mcap: sum((x) => x.averageMarketCap) / w.length, vol: sum((x) => x.volume), pay: eth(sum((x) => x.payrollAmount)), best: Math.max(...w.map((x) => x.finalRank)) };
    }
    rows.push({ id: e.employeeId, name: e.displayName, ticker: e.ticker, c1: e.avatar[0], c2: e.avatar[1], test: e.testLabel || null, sim: e.bot || !!e.testLabel, shifts: e.totalShifts, ...r });
  }
  const key = { "Performance score": "score", "Payroll earned": "pay", "Highest rank": "best", "Average market cap": "mcap", Volume: "vol" }[sort as string] || "score";
  rows.sort((a, b) => b[key] - a[key] || b.score - a.score);
  return { key, rows: rows.map((r, i) => ({ ...r, pos: i + 1, rank: RANK_NAMES[key === "best" ? r.best : rankFor(r.score)] })) };
}

export function payrollView(s: State, empId: number, now: number) {
  const cur = getEpoch(s, epochOf(s, now));
  const est = estimate(s, empId, now);
  const finalized = Object.values(s.epochs).filter((ep) => ep.status === "FINALIZED").sort((a, b) => b.epochId - a.epochId);
  const mineFinal = finalized.filter((ep) => ep.leaves.some((l) => l.employeeId === empId));
  const unclaimed = mineFinal.filter((ep) => !ep.leaves.find((l) => l.employeeId === empId)!.claimedAt).sort((a, b) => a.epochId - b.epochId)[0];
  let stage = 0;
  let focus: any = { epochId: cur.epochId, pool: est.poolEth, shares: est.shares, amount: est.payEth };
  const emp = s.employees[empId];
  const hasOpen = !!emp && Object.values(s.shifts).some((x) => x.employeeId === empId && (x.status === "ACTIVE" || x.status === "FINALIZING" || x.status === "PENDING" || (x.status === "COMPLETED" && x.epochId && s.epochs[x.epochId]?.status === "OPEN")));
  if (unclaimed) {
    const l = unclaimed.leaves.find((x) => x.employeeId === empId)!;
    stage = now >= unclaimed.claimsOpenAt! ? 2 : 1;
    focus = { epochId: unclaimed.epochId, pool: eth(unclaimed.payrollPool), shares: l.shares / unclaimed.totalShares, amount: eth(l.amount), proof: leafProof(unclaimed, empId), root: unclaimed.merkleRoot, opensIn: Math.max(0, Math.ceil((unclaimed.claimsOpenAt! - now) / 1000)) };
  } else if (!hasOpen && mineFinal.length) {
    const ep = mineFinal[0];
    const l = ep.leaves.find((x) => x.employeeId === empId)!;
    stage = 3;
    focus = { epochId: ep.epochId, pool: eth(ep.payrollPool), shares: l.shares / ep.totalShares, amount: eth(l.amount), root: ep.merkleRoot, claimTx: l.claimTx };
  }
  const history = finalized.slice(0, 8).map((ep) => {
    const l = ep.leaves.find((x) => x.employeeId === empId);
    return { epochId: ep.epochId, pool: eth(ep.payrollPool), root: ep.merkleRoot, at: ep.finalizedAt, mine: l ? eth(l.amount) : null, claimed: !!l?.claimedAt, employees: ep.leaves.length };
  });
  return {
    now, stage, focus, secsToEpoch: Math.max(0, Math.round((cur.endTime - now) / 1000)), currentEpoch: cur.epochId, poolEth: est.poolEth, history,
    vault: { funded: eth(s.vault.funded), claimed: eth(s.vault.claimed), carry: eth(s.vault.carry), treasury: eth(s.treasury) },
    config: { payrollPct: CONFIG.payrollPct, treasuryPct: CONFIG.treasuryPct, epochSeconds: CONFIG.epochSeconds, grant: CONFIG.epochGrantEth },
  };
}

export function proofView(s: State, empId: number | null, now: number) {
  const list = s.events.slice(-80).reverse().map((ev) => {
    const v: any = evView(s, ev, now);
    const p = ev.payload;
    if (ev.type === "Shift Finalized" && p) {
      const { resultHash, ...pkg } = p;
      v.pkg = pkg;
      v.resultHash = resultHash;
    }
    v.you = empId != null && ev.employeeId === empId;
    return v;
  });
  return { now, head: blockAt(s, now), confirmDepth: CONFIG.confirmDepth, events: list };
}

export function testnetView(s: State, now: number) {
  const eps = Object.values(s.epochs).filter((e) => e.status === "FINALIZED");
  const overpaid = eps.filter((e) => e.leaves.reduce((a, l) => a + l.amount, 0) > e.payrollPool).length;
  const claimedSum = eps.flatMap((e) => e.leaves).reduce((a, l) => a + (l.claimedAt ? l.amount : 0), 0);
  const shifts = Object.values(s.shifts);
  return {
    now, toggles: s.toggles, head: blockAt(s, now),
    invariants: {
      epochsFinalized: eps.length, overpaidEpochs: overpaid,
      vaultFunded: eth(s.vault.funded), vaultClaimed: eth(s.vault.claimed), claimedMatchesLeaves: claimedSum === s.vault.claimed, carry: eth(s.vault.carry),
      activeShifts: shifts.filter((x) => x.status === "ACTIVE" || x.status === "FINALIZING").length, invalidShifts: shifts.filter((x) => x.status === "INVALID").length,
      completedShifts: shifts.filter((x) => x.status === "COMPLETED").length,
    },
    tests: Object.values(s.employees).filter((e) => e.testLabel).map((e) => {
      const sh = lastShift(s, e);
      return { id: e.employeeId, code: e.code, label: e.testLabel, status: sh?.status, score: sh?.performanceScore, flags: sh?.flags.map((f) => f.code) || [], reason: sh?.invalidReason || null, rawVolume: sh?.rawVolume, counted: sh?.volume };
    }),
    log: s.log.slice(-25).reverse(),
  };
}
void short;
