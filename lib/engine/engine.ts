import { CONFIG, RANK_NAMES, rankIndex } from "./config";
import { holderCount, marketCap, mockPons, rebase, stepMarket } from "./market";
import { cleanTrades, scoreShift } from "./scoring";
import type { ChainEvent, Employee, Epoch, Launch, Profile, Shift, Snapshot, State } from "./types";
import { canonical, eth, gwei, hex, leafHash, merkleProof, merkleRoot, rand, seedOf, sha256, verifyProof } from "./util";

const FIRST = ["Mara", "Ilya", "Noor", "Tomas", "Ada", "Sven", "Lio", "Rhea", "Bao", "Esme", "Dario", "Yara", "Kai", "Nia", "Omar", "Lena", "Joss", "Mina", "Teo", "Ines", "Ravi", "Zoe", "Anders", "Priya", "Marco", "Hana", "Felix", "Amara", "Leif", "Sana", "Niko", "Elio", "Tessa", "Ugo", "Vera", "Wren", "Idris", "Jun", "Clara", "Pavel"];
const LAST = ["Voss", "Brandt", "Kase", "Reyl", "Okonji", "Hale", "Marchetti", "Duval", "Lindqvist", "Toure", "Venn", "Feld", "Morrow", "Ashby", "Quill", "Strand", "Novak", "Okafor", "Bellamy", "Castell", "Drummond", "Ekwueme", "Fairchild", "Garrow", "Holloway", "Ivanek", "Jarrett", "Kowal", "Lachance", "Mercer", "Nakamura", "Oyelaran", "Pryce", "Rowan", "Sandoval", "Thorne", "Ulmer", "Vance", "Whitlock", "Yilmaz"];
export const DEPTS = ["Trading", "Research", "Engineering", "Operations", "Growth", "Risk"];
const PALETTE: [string, string][] = [["#C8F135", "#0F130E"], ["#2C3A28", "#C8F135"], ["#E4E7DA", "#1D231B"], ["#3A4436", "#E4E7DA"], ["#0F130E", "#C8F135"], ["#8FA34A", "#0F130E"], ["#E0A44A", "#1D231B"], ["#1D231B", "#E4E7DA"]];

const SEED_BOTS: [string, string, string, Profile][] = [
  ["Mara Voss", "$VOSS", "Trading", "normal"], ["Ilya Brandt", "$BRNDT", "Research", "low"], ["Noor Kase", "$KASE", "Engineering", "high"],
  ["Tomas Reyl", "$REYL", "Operations", "low"], ["Ada Okonji", "$OKO", "Growth", "high"], ["Sven Hale", "$HALE", "Risk", "low"],
  ["Lio Marchetti", "$LIO", "Trading", "normal"], ["Rhea Duval", "$DUVL", "Research", "normal"], ["Bao Lindqvist", "$LIND", "Engineering", "high"],
  ["Esme Toure", "$TOUR", "Operations", "low"], ["Dario Venn", "$VENN", "Growth", "normal"], ["Yara Feld", "$FELD", "Risk", "high"],
];

const CONTRACT: Record<string, string> = {
  "Employee Created": "EmployeeRegistry", "Token Launched": "PonsAdapter", "Shift Started": "ShiftManager", "Shift Finalized": "ShiftManager",
  "Shift Invalidated": "ShiftManager", "Rank Assigned": "RankManager", Promotion: "RankManager", "Payroll Funded": "PayrollVault",
  "Payroll Epoch Finalized": "PayrollDistributor", "Payroll Claimed": "PayrollDistributor",
};

export const epochMs = () => CONFIG.epochSeconds * 1000;
export const epochOf = (s: State, ts: number) => Math.floor((ts - s.t0) / epochMs()) + 1;
export const blockAt = (s: State, ts: number) => CONFIG.genesisBlock + Math.floor(((ts - s.t0) / 1000) * CONFIG.blocksPerSecond);
const logMsg = (s: State, ts: number, msg: string) => {
  s.log.push({ ts, msg });
  if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
};

export function emit(s: State, type: string, who: string, ts: number, x: Partial<ChainEvent> = {}): ChainEvent {
  const id = s.nextEventId++;
  const ev: ChainEvent = { id, type, contract: CONTRACT[type], who, block: blockAt(s, ts), ts, tx: hex(`${type}|${id}|${ts}|${who}`), ...x };
  s.events.push(ev);
  if (s.events.length > 4000) s.events.splice(0, s.events.length - 4000);
  return ev;
}

export function newState(now: number): State {
  const t0 = now - CONFIG.warmupSeconds * 1000;
  const s: State = {
    v: 1, t0, lastStep: t0, rng: { s: 0x5eed }, nextEmployeeId: 247, nextShiftId: 1, nextEventId: 1,
    employees: {}, byWallet: {}, tickers: {}, markets: {}, shifts: {}, epochs: {}, events: [], launches: {},
    vault: { funded: 0, claimed: 0, carry: 0 }, treasury: 0, toggles: { rpcDown: false, failNextLaunch: false }, log: [],
  };
  SEED_BOTS.slice(0, CONFIG.botCount).forEach(([name, ticker, dept, profile], i) => {
    const wallet = hex(`bot:${name}`, 40);
    const e = createEmployee(s, wallet, t0, { name, ticker, dept, bot: true, profile });
    launchNow(s, e, t0);
    e.nextShiftAt = t0 + 5000 + i * 22000;
  });
  logMsg(s, t0, "Testnet genesis: 12 simulated employees hired");
  return s;
}

// ---------- identity (deterministic, stored permanently) ----------
export function createEmployee(s: State, wallet: string, ts: number, o: { name?: string; ticker?: string; dept?: string; bot?: boolean; profile?: Profile; testLabel?: string } = {}): Employee {
  const existing = s.byWallet[wallet.toLowerCase()];
  if (existing) return s.employees[existing];
  const h = seedOf(wallet.toLowerCase());
  const hh = { s: h };
  const name = o.name || `${FIRST[Math.floor(rand(hh) * FIRST.length)]} ${LAST[Math.floor(rand(hh) * LAST.length)]}`;
  const last = name.split(" ").pop()!.toUpperCase();
  let base = o.ticker?.replace("$", "") || (last.length > 4 ? last.slice(0, 3) + last.slice(-1) : last);
  let ticker = base;
  for (let n = 2; s.tickers[ticker]; n++) ticker = base.slice(0, 4) + n;
  const id = s.nextEmployeeId++;
  const pal = PALETTE[h % PALETTE.length];
  const e: Employee = {
    employeeId: id, code: `EMP-${String(id).padStart(4, "0")}`, wallet: wallet.toLowerCase(), displayName: name, ticker: "$" + ticker,
    avatar: pal, avatarURI: `shift://avatar/${id}/${pal[0].slice(1)}-${pal[1].slice(1)}`, department: o.dept || DEPTS[h % DEPTS.length],
    badge: "New hire", joinedAt: ts, currentRank: 0, totalShifts: 0, totalPayrollEarned: 0, bestPerformanceScore: 0,
    launchStatus: "NONE", bot: !!o.bot, testLabel: o.testLabel, profile: o.profile || "normal", shiftIds: [], rankHistory: [],
  };
  s.employees[id] = e;
  s.byWallet[e.wallet] = id;
  s.tickers[ticker] = id;
  emit(s, "Employee Created", e.displayName, ts, { employeeId: id, payload: { employeeId: id, wallet: e.wallet, ticker: e.ticker } });
  return e;
}

// ---------- Pons launch ----------
function launchNow(s: State, e: Employee, ts: number) {
  const m = mockPons.launch(e.wallet, e.ticker, e.profile);
  s.markets[m.token] = m;
  e.tokenAddress = m.token;
  e.ponsMarketAddress = m.market;
  e.launchStatus = "LIVE";
  emit(s, "Token Launched", e.displayName, ts, { employeeId: e.employeeId, payload: { token: m.token, ponsMarket: m.market, ticker: e.ticker } });
}

export function startLaunch(s: State, empId: number, now: number): Launch {
  const e = s.employees[empId];
  if (!e) throw new Error("UNKNOWN_EMPLOYEE");
  if (e.launchStatus === "LIVE") throw new Error("ALREADY_LAUNCHED");
  if (s.launches[empId] && !s.launches[empId].done) return s.launches[empId];
  const l: Launch = { employeeId: empId, startedAt: now, willRevert: s.toggles.failNextLaunch, step: 0, confirmations: 0, done: false, reverted: false };
  s.toggles.failNextLaunch = false;
  e.launchStatus = "LAUNCHING";
  s.launches[empId] = l;
  return l;
}
function tickLaunches(s: State, now: number) {
  for (const l of Object.values(s.launches)) {
    if (l.done) continue;
    const e = s.employees[l.employeeId];
    const sec = (now - l.startedAt) / 1000;
    l.step = sec < 0.7 ? 0 : sec < 1.4 ? 1 : sec < 4.2 ? 2 : 3;
    l.confirmations = sec < 2.1 ? 0 : Math.min(3, Math.floor((sec - 1.4) / 0.7));
    if (l.willRevert && sec >= 2.1) {
      l.done = true; l.reverted = true; l.error = "Pons launch reverted. Nothing was recorded.";
      e.launchStatus = "REVERTED";
      logMsg(s, now, `Launch reverted for ${e.code} (simulated)`);
    } else if (sec >= 4.2) {
      l.done = true; l.step = 4;
      launchNow(s, e, now);
      startShift(s, e, now, true);
    }
  }
}

// ---------- shifts ----------
export function startShift(s: State, e: Employee, now: number, skipCooldown = false): Shift {
  if (e.launchStatus !== "LIVE" || !e.tokenAddress) throw new Error("NO_CONFIRMED_LAUNCH");
  if (e.activeShiftId) throw new Error("SHIFT_ALREADY_ACTIVE");
  if (!skipCooldown && e.lastShiftEndedAt && now - e.lastShiftEndedAt < CONFIG.userCooldownSeconds * 1000) throw new Error("COOLDOWN");
  const m = s.markets[e.tokenAddress];
  rebase(m);
  const id = s.nextShiftId++;
  const sh: Shift = {
    shiftId: id, code: "S-" + (id + 0x3a00).toString(16).toUpperCase(), employeeId: e.employeeId, tokenAddress: e.tokenAddress, startedAt: now,
    status: "PENDING", startBlock: blockAt(s, now), snapshots: [], missing: 0, averageMarketCap: 0, volume: 0, rawVolume: 0, uniqueTraders: 0,
    holderCount: 0, liquidity: 0, performanceScore: 0, finalRank: e.currentRank, prevRank: e.currentRank, promoted: false, flags: [], payrollAmount: 0,
  };
  s.shifts[id] = sh;
  e.shiftIds.push(id);
  e.activeShiftId = id;
  e.promotedUntil = undefined;
  emit(s, "Shift Started", e.displayName, now, { employeeId: e.employeeId, shiftId: id, payload: { shiftId: sh.code, startBlock: sh.startBlock } });
  return sh;
}

function snapshot(s: State, sh: Shift, m: ReturnType<typeof Object>, el: number, now: number) {
  const mk = m as any;
  const from = Math.max(0, el - CONFIG.snapshotSeconds);
  const series: number[] = mk.secMcap.slice(from, el);
  const liqs: number[] = mk.secLiq.slice(from, el);
  const c = cleanTrades(mk.trades, mk.fundedBy, el);
  const snap: Snapshot = {
    n: sh.snapshots.length + 1, t: el, ts: now, block: blockAt(s, now),
    mcapTwa: series.reduce((a, v) => a + v, 0) / Math.max(1, series.length), mcapMin: Math.min(...series), mcapMax: Math.max(...series), mcapEnd: marketCap(mk),
    volume: c.volume, uniqueTraders: c.traders, holders: holderCount(mk), liquidity: mk.reserveEth, liquidityMin: Math.min(...liqs), trades: c.counted.length, liveScore: 0,
  };
  sh.snapshots.push(snap);
  snap.liveScore = scoreShift(sh.snapshots, mk, el, { live: true }).score;
}

function stepShift(s: State, e: Employee, sh: Shift, now: number) {
  const m = s.markets[sh.tokenAddress];
  const el = Math.round((now - sh.startedAt) / 1000);
  if (sh.status === "PENDING") {
    sh.status = "ACTIVE";
    return;
  }
  stepMarket(m, el);
  const fee = m.feesEth;
  m.feesEth = 0;
  if (fee) getEpoch(s, epochOf(s, now)).feeRevenue += fee * 1e9;
  if (sh.status === "ACTIVE" && el % CONFIG.snapshotSeconds === 0 && el <= CONFIG.shiftSeconds) {
    if (s.toggles.rpcDown) {
      sh.missing++;
      logMsg(s, now, `Snapshot ${el / 20} missed for ${sh.code}: RPC unavailable`);
    } else snapshot(s, sh, m, el, now);
  }
  if (sh.status === "ACTIVE" && el >= CONFIG.shiftSeconds) {
    sh.status = "FINALIZING";
    sh.endedAt = now;
    sh.endBlock = blockAt(s, now);
    sh.epochId = epochOf(s, now);
  } else if (sh.status === "FINALIZING" && el >= CONFIG.shiftSeconds + CONFIG.finalizeTailSeconds) {
    finalizeShift(s, e, sh, m, now);
  }
}

function finalizeShift(s: State, e: Employee, sh: Shift, m: any, now: number) {
  const r = scoreShift(sh.snapshots, m, CONFIG.shiftSeconds);
  sh.averageMarketCap = r.avgMcap; sh.volume = r.volume; sh.rawVolume = r.rawVolume; sh.uniqueTraders = r.uniqueTraders;
  sh.holderCount = r.holders; sh.liquidity = r.liquidity; sh.performanceScore = r.score; sh.components = r.components; sh.flags = r.flags;
  sh.finalizedAt = now;
  const missing = Math.max(sh.missing, CONFIG.expectedSnapshots - sh.snapshots.length);
  sh.missing = missing;
  e.activeShiftId = undefined;
  e.lastShiftEndedAt = now;
  if (e.bot) e.nextShiftAt = now + (CONFIG.botCooldownSeconds[0] + rand(s.rng) * (CONFIG.botCooldownSeconds[1] - CONFIG.botCooldownSeconds[0])) * 1000;
  m.secMcap = []; m.secLiq = [];
  const reason = missing > CONFIG.maxMissingSnapshots ? `${missing} snapshots missing` : r.excludedShare >= CONFIG.invalidExcludedShare ? `${Math.round(r.excludedShare * 100)}% of volume excluded as manipulation` : "";
  const sub = canonical(sh.snapshots.map((x) => ({ ...x, liveScore: undefined })));
  if (reason) {
    sh.status = "INVALID";
    sh.invalidReason = reason;
    emit(s, "Shift Invalidated", e.displayName, now, { employeeId: e.employeeId, shiftId: sh.shiftId, payload: { shiftId: sh.code, reason, flags: sh.flags.map((f) => f.code) } });
    logMsg(s, now, `${sh.code} flagged INVALID: ${reason}`);
    return;
  }
  sh.status = "COMPLETED";
  sh.finalRank = r.rank;
  sh.prevRank = e.currentRank;
  sh.promoted = r.rank > e.currentRank;
  const pkg = { shiftId: sh.code, token: sh.tokenAddress, startBlock: sh.startBlock, endBlock: sh.endBlock, snapshotsHash: "0x" + sha256(sub), performanceScore: r.score, rank: RANK_NAMES[r.rank] };
  sh.resultPackage = pkg;
  sh.resultHash = "0x" + sha256(canonical(pkg));
  e.totalShifts++;
  e.bestPerformanceScore = Math.max(e.bestPerformanceScore, r.score);
  const ev = emit(s, "Shift Finalized", e.displayName, now, { employeeId: e.employeeId, shiftId: sh.shiftId, payload: { ...pkg, resultHash: sh.resultHash } });
  emit(s, "Rank Assigned", e.displayName, now, { employeeId: e.employeeId, shiftId: sh.shiftId, payload: { rank: RANK_NAMES[r.rank], score: r.score } });
  if (sh.promoted) {
    const p = emit(s, "Promotion", e.displayName, now, { employeeId: e.employeeId, shiftId: sh.shiftId, payload: { from: RANK_NAMES[e.currentRank], to: RANK_NAMES[r.rank], score: r.score } });
    e.rankHistory.push({ shiftId: sh.shiftId, from: e.currentRank, to: r.rank, score: r.score, ts: now, tx: p.tx });
    e.currentRank = r.rank;
    e.promotedUntil = now + 25000;
  }
  void ev;
  const keep = Object.values(s.shifts).filter((x) => x.snapshots.length);
  if (keep.length > CONFIG.keepSnapshotsForShifts) keep.sort((a, b) => a.startedAt - b.startedAt).slice(0, keep.length - CONFIG.keepSnapshotsForShifts).forEach((x) => (x.snapshots = []));
}

// ---------- payroll epochs ----------
export function getEpoch(s: State, id: number): Epoch {
  let ep = s.epochs[id];
  if (!ep) {
    ep = { epochId: id, startTime: s.t0 + (id - 1) * epochMs(), endTime: s.t0 + id * epochMs(), status: "OPEN", grossRevenue: 0, feeRevenue: 0, carryIn: 0, payrollPool: 0, treasuryAmount: 0, totalShares: 0, leaves: [], shiftIds: [] };
    s.epochs[id] = ep;
  }
  return ep;
}
export const shareOf = (score: number, rank: number) => (score / 100) * CONFIG.rankPayMultiplier[rank] * Math.min(1, CONFIG.shiftSeconds / CONFIG.epochSeconds);

function finalizeEpoch(s: State, ep: Epoch, now: number) {
  const shifts = Object.values(s.shifts).filter((x) => x.epochId === ep.epochId && x.status === "COMPLETED");
  const gross = Math.round(ep.feeRevenue) + gwei(CONFIG.epochGrantEth);
  ep.feeRevenue = Math.round(ep.feeRevenue);
  ep.grossRevenue = gross;
  const pool = Math.floor((gross * CONFIG.payrollPct) / 100) + s.vault.carry;
  ep.carryIn = s.vault.carry;
  ep.payrollPool = pool;
  ep.treasuryAmount = gross - Math.floor((gross * CONFIG.payrollPct) / 100);
  s.treasury += ep.treasuryAmount;
  const by: Record<number, number> = {};
  shifts.forEach((x) => (by[x.employeeId] = (by[x.employeeId] || 0) + shareOf(x.performanceScore, x.finalRank)));
  const ids = Object.keys(by).map(Number).sort((a, b) => a - b);
  const total = ids.reduce((a, i) => a + by[i], 0);
  ep.totalShares = total;
  ep.leaves = ids.map((id) => ({ employeeId: id, wallet: s.employees[id].wallet, shares: by[id], amount: Math.floor((pool * by[id]) / total) }));
  const distributed = ep.leaves.reduce((a, l) => a + l.amount, 0);
  s.vault.carry = pool - distributed;
  s.vault.funded += gross;
  shifts.forEach((x) => {
    const l = ep.leaves.find((q) => q.employeeId === x.employeeId)!;
    x.payrollAmount = Math.floor((l.amount * shareOf(x.performanceScore, x.finalRank)) / by[x.employeeId]);
  });
  ep.leaves.forEach((l) => (s.employees[l.employeeId].totalPayrollEarned += l.amount));
  ep.shiftIds = shifts.map((x) => x.shiftId);
  ep.merkleRoot = merkleRoot(ep.leaves.map((l) => leafHash(ep.epochId, l.employeeId, l.wallet, l.amount)));
  ep.status = "FINALIZED";
  ep.finalizedAt = now;
  ep.claimsOpenAt = now + CONFIG.claimDelaySeconds * 1000;
  ep.fundTx = emit(s, "Payroll Funded", "PayrollVault", now, { epochId: ep.epochId, payload: { epochId: ep.epochId, grossRevenue: eth(gross), feeRevenue: eth(ep.feeRevenue), testnetGrant: CONFIG.epochGrantEth } }).tx;
  ep.finalizeTx = emit(s, "Payroll Epoch Finalized", `Epoch ${ep.epochId}`, now, { epochId: ep.epochId, payload: { epochId: ep.epochId, payrollPool: eth(pool), merkleRoot: ep.merkleRoot, employees: ep.leaves.length } }).tx;
}

export function leafProof(ep: Epoch, employeeId: number) {
  const hashes = ep.leaves.map((l) => leafHash(ep.epochId, l.employeeId, l.wallet, l.amount));
  const i = ep.leaves.findIndex((l) => l.employeeId === employeeId);
  if (i < 0) return null;
  return { leaf: hashes[i], proof: merkleProof(hashes, i), index: i };
}

export function claim(s: State, empId: number, epochId: number, now: number, supplied?: { proof: string[]; amount: number }) {
  const ep = s.epochs[epochId];
  if (!ep || ep.status !== "FINALIZED") throw new Error("EPOCH_NOT_FINALIZED");
  if (now < (ep.claimsOpenAt || 0)) throw new Error("CLAIM_NOT_OPEN");
  const leaf = ep.leaves.find((l) => l.employeeId === empId);
  if (!leaf) throw new Error("NOT_ELIGIBLE");
  const pr = leafProof(ep, empId)!;
  const amount = supplied?.amount ?? leaf.amount;
  const proof = supplied?.proof ?? pr.proof;
  if (!verifyProof(leafHash(epochId, empId, leaf.wallet, amount), proof, ep.merkleRoot!)) throw new Error("INVALID_PROOF");
  if (leaf.claimedAt) throw new Error("ALREADY_CLAIMED");
  leaf.claimedAt = now;
  const e = s.employees[empId];
  leaf.claimTx = emit(s, "Payroll Claimed", e.displayName, now, { epochId, employeeId: empId, payload: { epochId, employeeId: empId, wallet: leaf.wallet, amount: eth(amount) } }).tx;
  s.vault.claimed += amount;
  return leaf;
}

// ---------- the clock ----------
export function step(s: State, now: number) {
  s.lastStep = now;
  tickLaunches(s, now);
  getEpoch(s, epochOf(s, now));
  for (const e of Object.values(s.employees)) {
    if (e.activeShiftId) stepShift(s, e, s.shifts[e.activeShiftId], now);
    else if (e.bot && e.launchStatus === "LIVE" && e.nextShiftAt && e.nextShiftAt <= now) {
      e.nextShiftAt = undefined;
      startShift(s, e, now, true);
    }
  }
  for (const ep of Object.values(s.epochs)) {
    if (ep.status === "OPEN" && now >= ep.endTime + CONFIG.epochFinalizeDelaySeconds * 1000) finalizeEpoch(s, ep, now);
  }
  // optional automated claim service for simulated employees
  for (const ep of Object.values(s.epochs)) {
    if (ep.status !== "FINALIZED" || now < (ep.claimsOpenAt || 0) || now - ep.finalizedAt! > 180000) continue;
    for (const l of ep.leaves) {
      const e = s.employees[l.employeeId];
      if (l.claimedAt || !(e.bot || e.testLabel)) continue;
      if (now >= ep.claimsOpenAt! + (5 + ((l.employeeId * 7) % 35)) * 1000) claim(s, l.employeeId, ep.epochId, now);
    }
  }
}

// Catch up to `now`. Long gaps (server was off) are not replayed: live shifts
// that lost snapshots are finalized as invalid, matching the failure rules.
export function advance(s: State, now: number) {
  const gap = now - s.lastStep;
  if (gap > 600_000 && s.lastStep > s.t0) {
    for (const sh of Object.values(s.shifts)) {
      if (sh.status === "ACTIVE" || sh.status === "FINALIZING" || sh.status === "PENDING") {
        const e = s.employees[sh.employeeId];
        sh.status = "INVALID"; sh.invalidReason = "indexer offline during shift"; sh.endedAt = now; sh.finalizedAt = now;
        e.activeShiftId = undefined; e.lastShiftEndedAt = now;
        if (e.bot) e.nextShiftAt = now + 10000;
      }
    }
    for (const l of Object.values(s.launches)) if (!l.done) { l.done = true; l.reverted = true; l.error = "Launch interrupted"; s.employees[l.employeeId].launchStatus = "REVERTED"; }
    s.lastStep = now - 1000;
    logMsg(s, now, `Backend resumed after ${Math.round(gap / 60000)} min offline`);
  }
  let n = 0;
  while (s.lastStep + 1000 <= now && n++ < 20000) step(s, s.lastStep + 1000);
}

// ---------- testnet console ----------
export function spawnTest(s: State, profile: Profile, now: number) {
  const n = Object.values(s.employees).filter((e) => e.testLabel).length + 1;
  const label = { normal: "Normal launch", high: "High volume", low: "Low volume", pumpdump: "Pump then dump", wash: "Wash trading", liqmanip: "Liquidity manipulation" }[profile];
  const e = createEmployee(s, hex(`test:${profile}:${n}:${now}`, 40), now, { profile, testLabel: label, name: `Test ${label.split(" ")[0]} ${n}`, ticker: `T${profile.slice(0, 2).toUpperCase()}${n}` });
  launchNow(s, e, now);
  startShift(s, e, now, true);
  logMsg(s, now, `Spawned ${label} employee ${e.code}`);
  return e;
}
export function reorg(s: State, now: number) {
  const head = blockAt(s, now);
  let n = 0;
  s.events.forEach((ev) => {
    if (head - ev.block < CONFIG.confirmDepth) {
      ev.tx = hex(`reorg|${ev.tx}|${now}`);
      n++;
    }
  });
  logMsg(s, now, `Simulated reorg: ${n} unconfirmed events re-mined with new tx hashes; finalized state untouched`);
  return n;
}
