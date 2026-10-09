// Run: npx tsx scripts/bridge-sim.mts
// Offline end-to-end test of the engine -> bridge pipeline against an in-memory model of the contracts.
process.env.DATA_MODE = "live";
process.env.SHIFT_BOTS = "0";
process.env.SIGNER_PRIVATE_KEY = "0x" + "11".repeat(32);

import { encodeAbiParameters, encodeEventTopics, keccak256, concatHex, type Hex } from "viem";

let VNOW = 1_800_000_000_000;
Date.now = () => VNOW;

const A = await import("../lib/chain/abi.ts");
const { signerService } = await import("../lib/chain/signer.ts");
const { pumpChain } = await import("../lib/chain/bridge.ts");
const { enqueue } = await import("../lib/chain/jobs.ts");
const E = await import("../lib/engine/engine.ts");
const { merkleRoot: _m } = await import("../lib/engine/util.ts");
void _m;

// ---------- fake chain ----------
const ts = () => Math.floor(VNOW / 1000);
let blockNo = 1000;
const reg = { next: 1, byWallet: new Map<string, number>(), linked: new Set<number>() };
const sm = { next: 1, shifts: new Map<number, any>(), active: new Map<number, number>(), lastEnd: new Map<number, number>() };
const vault = { unallocated: 0n, treasury: 0n, balance: 0n };
const dist = { epochs: new Map<number, any>(), claimed: new Set<string>(), balance: 0n };
const wallets = new Map<string, bigint>();
const txs = new Map<string, any>();
const log: string[] = [];

const revert = (name: string, args: any[] = []) => {
  const e: any = new Error(`reverted: ${name}`);
  e.data = { errorName: name, args };
  e.walk = (fn: any) => (fn(e) ? e : undefined);
  return e;
};
const mkLog = (abi: readonly any[], eventName: string, args: any, address: string) => {
  const item = abi.find((x) => x.type === "event" && x.name === eventName)!;
  const topics = encodeEventTopics({ abi: [item] as any, eventName, args } as any);
  const nonIdx = item.inputs.filter((i: any) => !i.indexed);
  const data = nonIdx.length ? encodeAbiParameters(nonIdx, nonIdx.map((i: any) => args[i.name])) : "0x";
  return { address, topics, data, blockNumber: BigInt(blockNo), transactionHash: "0x", logIndex: 0, blockHash: "0x", transactionIndex: 0, removed: false };
};

// Independent re-implementation of the contract-side merkle check (OZ commutative keccak).
const leafOf = (epochId: bigint, emp: bigint, wallet: string, amt: bigint) =>
  keccak256(keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }, { type: "address" }, { type: "uint256" }], [epochId, emp, wallet as Hex, amt])));
const verify = (proof: Hex[], root: Hex, leaf: Hex) => {
  let h = leaf;
  for (const p of proof) h = h.toLowerCase() < p.toLowerCase() ? keccak256(concatHex([h, p])) : keccak256(concatHex([p, h]));
  return h.toLowerCase() === root.toLowerCase();
};

const ADDR = (await import("../lib/chain/client.ts")).CONTRACT_ADDRESSES;
const lc = (a: string) => a.toLowerCase();

function exec(address: string, fn: string, args: any[], value?: bigint) {
  const logs: any[] = [];
  const a = lc(address);
  if (a === lc(ADDR.employeeRegistry)) {
    if (fn === "createEmployee") {
      const w = lc(args[0]);
      if (reg.byWallet.has(w)) throw revert("AlreadyEmployed", [w, BigInt(reg.byWallet.get(w)!)]);
      const id = reg.next++;
      reg.byWallet.set(w, id);
      logs.push(mkLog(A.EMPLOYEE_REGISTRY_ABI, "EmployeeCreated", { employeeId: BigInt(id), wallet: args[0], metadataHash: args[1], metadataURI: args[2] }, address));
    } else if (fn === "linkToken") {
      const id = Number(args[0]);
      if (id >= reg.next) throw revert("UnknownEmployee", [args[0]]);
      if (reg.linked.has(id)) throw revert("TokenAlreadyLinked", [args[0]]);
      reg.linked.add(id);
    } else throw new Error("unknown registry fn " + fn);
  } else if (a === lc(ADDR.shiftManager)) {
    if (fn === "startShift") {
      const id = Number(args[0]);
      if (id >= reg.next) throw revert("UnknownEmployee", [args[0]]);
      if (!reg.linked.has(id)) throw revert("NoConfirmedLaunch", [args[0]]);
      if (sm.active.get(id)) throw revert("ShiftAlreadyActive", [args[0], BigInt(sm.active.get(id)!)]);
      const last = sm.lastEnd.get(id) ?? 0;
      if (last && ts() < last + 20) throw revert("CooldownActive", [args[0], BigInt(last + 20)]);
      const sid = sm.next++;
      sm.shifts.set(sid, { emp: id, startedAt: ts(), status: "ACTIVE" });
      sm.active.set(id, sid);
      logs.push(mkLog(A.SHIFT_MANAGER_ABI, "ShiftStarted", { shiftId: BigInt(sid), employeeId: BigInt(id), startTime: BigInt(ts()), startBlock: BigInt(blockNo) }, address));
    } else if (fn === "finalizeShift") {
      const sid = Number(args[0]);
      const s = sm.shifts.get(sid);
      if (!s) throw revert("UnknownShift", [args[0]]);
      if (s.status !== "ACTIVE") throw revert("ShiftNotActive", [args[0], 1]);
      const el = ts() - s.startedAt;
      if (el < 300) throw revert("ShiftTooShort", [args[0], BigInt(el), 300n]);
      const t = [0, 150, 300, 450, 600, 750, 880, 960];
      let rank = 0;
      t.forEach((x, i) => { if (args[1] >= x) rank = i; });
      Object.assign(s, { status: "COMPLETED", resultHash: args[2], score: args[1], rank });
      sm.active.delete(s.emp);
      sm.lastEnd.set(s.emp, ts());
      logs.push(mkLog(A.SHIFT_MANAGER_ABI, "ShiftFinalized", { shiftId: BigInt(sid), employeeId: BigInt(s.emp), scoreX10: args[1], rank, resultHash: args[2] }, address));
    } else if (fn === "invalidateShift") {
      const s = sm.shifts.get(Number(args[0]));
      if (!s || s.status !== "ACTIVE") throw revert("ShiftNotActive", [args[0], 1]);
      s.status = "INVALID";
      sm.active.delete(s.emp);
      sm.lastEnd.set(s.emp, ts());
    } else throw new Error("unknown sm fn " + fn);
  } else if (a === lc(ADDR.payrollVault)) {
    if (fn !== "fund") throw new Error("unknown vault fn " + fn);
    if (!value) throw revert("ZeroAmount");
    const toP = (value * 7000n) / 10000n;
    vault.unallocated += toP;
    vault.treasury += value - toP;
    vault.balance += value;
  } else if (a === lc(ADDR.payrollDistributor)) {
    if (fn === "finalizeEpoch") {
      const id = Number(args[0]);
      if (dist.epochs.get(id)) throw revert("EpochAlreadyFinalized", [args[0]]);
      if (args[2] > vault.unallocated) throw revert("InsufficientUnallocated", [args[2], vault.unallocated]);
      vault.unallocated -= args[2];
      vault.balance -= args[2];
      dist.balance += args[2];
      dist.epochs.set(id, { root: args[1], pool: args[2], claimed: 0n, finalizedAt: ts(), claimsOpenAt: ts() + 10 });
      logs.push(mkLog(A.PAYROLL_DISTRIBUTOR_ABI, "PayrollEpochFinalized", { epochId: args[0], payrollPool: args[2], merkleRoot: args[1], claimsOpenAt: BigInt(ts() + 10) }, address));
    } else if (fn === "claim") {
      const [epochId, emp, wallet, amount, proof] = args;
      const e = dist.epochs.get(Number(epochId));
      if (!e) throw revert("EpochNotFinalized", [epochId]);
      if (ts() < e.claimsOpenAt) throw revert("ClaimsNotOpen", [epochId, BigInt(e.claimsOpenAt)]);
      if (dist.claimed.has(`${epochId}:${emp}`)) throw revert("AlreadyClaimed", [epochId, emp]);
      if (!verify(proof, e.root, leafOf(epochId, emp, wallet, amount))) throw revert("InvalidProof", [epochId, emp]);
      if (amount > e.pool - e.claimed) throw revert("ExceedsPool", [epochId, amount, e.pool - e.claimed]);
      dist.claimed.add(`${epochId}:${emp}`);
      e.claimed += amount;
      dist.balance -= amount;
      wallets.set(lc(wallet), (wallets.get(lc(wallet)) ?? 0n) + amount);
      logs.push(mkLog(A.PAYROLL_DISTRIBUTOR_ABI, "PayrollClaimed", { epochId, employeeId: emp, wallet, amount }, address));
    } else throw new Error("unknown dist fn " + fn);
  } else throw new Error("unknown address " + address);
  return logs;
}

let nonce = 0;
const fakeWallet: any = {
  chain: {},
  async writeContract({ address, functionName, args, value }: any) {
    await Promise.resolve();
    const logs = exec(address, functionName, args, value);
    blockNo++;
    const hash = keccak256(("0x" + (++nonce).toString(16).padStart(8, "0")) as Hex);
    logs.forEach((l) => (l.transactionHash = hash));
    txs.set(hash, { logs });
    log.push(`${functionName}`);
    return hash;
  },
};
const fakePub: any = {
  async waitForTransactionReceipt({ hash }: any) {
    return { status: "success", logs: txs.get(hash).logs, blockNumber: BigInt(blockNo) };
  },
  async readContract({ address, functionName, args }: any) {
    const a = lc(address);
    if (functionName === "employeeIdOf") return BigInt(reg.byWallet.get(lc(args[0])) ?? 0);
    if (functionName === "unallocated") return vault.unallocated;
    if (functionName === "payrollBps") return 7000;
    if (functionName === "claimed") return dist.claimed.has(`${args[0]}:${args[1]}`);
    if (functionName === "verifyResult") { const s = sm.shifts.get(Number(args[0])); return s?.status === "COMPLETED" && s.resultHash === args[1]; }
    if (functionName === "getEpoch") { const e = dist.epochs.get(Number(args[0])); return e ? { merkleRoot: e.root, pool: e.pool, claimed: e.claimed, finalizedAt: BigInt(e.finalizedAt), claimsOpenAt: BigInt(e.claimsOpenAt) } : { merkleRoot: "0x" + "00".repeat(32), pool: 0n, claimed: 0n, finalizedAt: 0n, claimsOpenAt: 0n }; }
    throw new Error("unknown read " + functionName + " " + a);
  },
  async getBlockNumber() { return BigInt(blockNo); },
  async getLogs() { return []; },
};
(signerService as any).walletClient = fakeWallet;
(signerService as any).publicClient = fakePub;
(signerService as any).account = { address: "0x" + "aa".repeat(20) };

// ---------- drive the engine ----------
const s = E.newState(VNOW);
const wallet = "0x" + "12".repeat(20);
const sleep = () => new Promise((r) => setImmediate(r));
const step = async () => {
  VNOW += 1000;
  E.advance(s, VNOW);
  pumpChain(s);
  for (let i = 0; i < 4; i++) await sleep();
};

const emp = E.createEmployee(s, wallet, VNOW);
for (let i = 0; i < 6; i++) await step();
E.startLaunch(s, emp.employeeId, VNOW);
let shift1: number | undefined;
for (let i = 0; i < 1500; i++) {
  await step();
  if (!emp.activeShiftId && emp.chainLinked && emp.lastShiftEndedAt && VNOW - emp.lastShiftEndedAt > 20500 && emp.shiftIds.length < 3) E.startShift(s, emp, VNOW);
}
const fails: string[] = [];
const ok = (c: any, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails.push(m); };

ok(emp.onchainId === 1, `registered onchain (id ${emp.onchainId})`);
ok(emp.chainLinked, "token linked");
const myShifts = Object.values(s.shifts).filter((x) => x.employeeId === emp.employeeId);
ok(myShifts.length >= 2, `ran ${myShifts.length} shifts`);
ok(myShifts.every((x) => x.status === "INVALID" || x.onchainShiftId), "every shift mapped to an onchain id");
const done = myShifts.filter((x) => x.status === "COMPLETED");
ok(done.length >= 1 && done.every((x) => sm.shifts.get(x.onchainShiftId!)?.status === "COMPLETED"), "completed shifts finalized onchain");
ok(done.every((x) => sm.shifts.get(x.onchainShiftId!)?.rank === x.finalRank), "onchain rank equals local rank");
ok(done.every((x) => sm.shifts.get(x.onchainShiftId!)?.resultHash === x.resultHash), "resultHash anchored matches");
const realEvents = s.events.filter((e) => e.real).map((e) => e.type);
ok(realEvents.includes("Employee Created") && realEvents.includes("Shift Started") && realEvents.includes("Shift Finalized"), "events carry real tx hashes: " + [...new Set(realEvents)].join(","));
const eps = Object.values(s.epochs).filter((e) => e.status === "FINALIZED" && e.leaves.length);
ok(eps.length >= 1 && eps.every((e) => e.chainState === "CONFIRMED"), `epochs with pay confirmed onchain (${eps.length})`);
ok(eps.every((e) => dist.epochs.get(e.epochId)?.pool === BigInt(e.payrollPool) * 1_000_000_000n), "onchain pool equals local pool");

// claim through the same path the API route uses
const ep = eps[0];
const j = enqueue(s, "claim", ep.epochId, { ref2: emp.employeeId })!;
for (let i = 0; i < 40 && j.status !== "confirmed" && j.status !== "failed"; i++) await step();
ok(j.status === "confirmed", `claim job ${j.status} ${j.error ?? ""}`);
ok((wallets.get(wallet) ?? 0n) === BigInt(ep.leaves[0].amount) * 1_000_000_000n, `wallet received ${Number(wallets.get(wallet) ?? 0n) / 1e18} ETH`);
ok(!!ep.leaves[0].claimedAt && s.events.some((e) => e.type === "Payroll Claimed" && e.real), "claim mirrored locally with real tx");
ok(s.chain!.jobs.every((x) => x.status === "confirmed" || x.status === "queued"), "no failed jobs: " + s.chain!.jobs.filter((x) => x.status === "failed").map((x) => x.kind + ":" + x.error).join(","));
console.log("calls:", log.length, "vault balance", vault.balance, "dist balance", dist.balance);
void shift1;
console.log(fails.length ? `\n${fails.length} FAILED` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
