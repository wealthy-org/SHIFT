import { keccak256, parseEventLogs, stringToHex, type Hex } from "viem";
import { CONFIG } from "../engine/config";
import { leafProof, settleClaim } from "../engine/engine";
import type { ChainJob, State } from "../engine/types";
import { gweiToWei } from "../engine/util";
import { EMPLOYEE_REGISTRY_ABI, PAYROLL_DISTRIBUTOR_ABI, PAYROLL_VAULT_ABI, SHIFT_MANAGER_ABI } from "./abi";
import { CONTRACT_ADDRESSES } from "./client";
import deployments from "../../contracts/deployments/46630.json";
import { chainOn, enqueue } from "./jobs";
import { signerService } from "./signer";

// The bridge turns engine decisions into transactions, one at a time and awaited.
// Every job is idempotent (it reads chain state first or maps a known revert to
// success), so a crash between "sent" and "confirmed" is safe to replay.

const G = globalThis as any;
const MAX_ATTEMPTS = 6;
const clip = (m: string) => m.replace(/\s+/g, " ").slice(0, 220);

function decode(e: any): { name?: string; args?: readonly unknown[]; msg: string } {
  const hit = e?.walk?.((x: any) => x?.data?.errorName);
  const msg = clip(String(e?.shortMessage || e?.message || e));
  if (hit) return { name: hit.data.errorName, args: hit.data.args, msg };
  return { msg };
}

async function send(address: Hex, abi: any, functionName: string, args: any[], value?: bigint) {
  const w = signerService.walletClient!;
  const hash = await w.writeContract({ address, abi, functionName, args, value, account: signerService.account!, chain: w.chain } as any);
  const rc = await signerService.publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (rc.status !== "success") throw new Error(`TX_REVERTED ${hash}`);
  return { hash, rc };
}

function realize(s: State, eventId: number | undefined, tx: string, block?: bigint) {
  if (eventId == null) return;
  const ev = s.events.find((x) => x.id === eventId);
  if (!ev) return;
  ev.tx = tx;
  ev.real = true;
  if (block) ev.block = Number(block);
}

type Dep = "ready" | "wait" | "dead";
function deps(s: State, j: ChainJob): Dep {
  const L = s.chain!;
  const find = (kind: string, ref: number) => L.jobs.find((x) => x.kind === kind && x.ref === ref && x.ref2 === undefined);
  const gate = (x?: ChainJob): Dep => (!x || x.status === "failed" ? "dead" : x.status === "confirmed" ? "ready" : "wait");
  switch (j.kind) {
    case "register":
    case "fundVault":
      return "ready";
    case "link": {
      const e = s.employees[j.ref];
      return e?.onchainId ? "ready" : gate(find("register", j.ref));
    }
    case "startShift": {
      const sh = s.shifts[j.ref];
      const e = s.employees[sh.employeeId];
      if (!e.chainLinked) return gate(find("link", e.employeeId));
      const open = L.jobs.some((x) => (x.kind === "finalizeShift" || x.kind === "invalidateShift") && x.id < j.id && (x.status === "queued" || x.status === "sent") && s.shifts[x.ref]?.employeeId === e.employeeId);
      return open ? "wait" : "ready";
    }
    case "finalizeShift":
    case "invalidateShift":
      return s.shifts[j.ref]?.onchainShiftId ? "ready" : gate(find("startShift", j.ref));
    case "finalizeEpoch":
      return gate(find("fundVault", j.ref));
    case "claim": {
      const st = s.epochs[j.ref]?.chainState;
      return st === "CONFIRMED" ? "ready" : st === "FAILED" || st === "SKIPPED" || !st ? "dead" : "wait";
    }
  }
}

const done = (j: ChainJob, tx?: string) => {
  j.status = "confirmed";
  j.tx = tx ?? j.tx;
  j.error = undefined;
  j.doneAt = Date.now();
};
const fail = (j: ChainJob, error: string) => {
  j.status = "failed";
  j.error = error;
  j.doneAt = Date.now();
};
const later = (j: ChainJob, ms: number) => {
  j.status = "queued";
  j.notBefore = Date.now() + ms;
};

async function execute(s: State, j: ChainJob) {
  const pub = signerService.publicClient;
  const addr = CONTRACT_ADDRESSES;
  const now = Date.now();

  if (j.kind === "register") {
    const e = s.employees[j.ref];
    const known = (await pub.readContract({ address: addr.employeeRegistry, abi: EMPLOYEE_REGISTRY_ABI, functionName: "employeeIdOf", args: [e.wallet as Hex] })) as bigint;
    if (known > 0n) {
      e.onchainId = Number(known);
      return done(j);
    }
    const { hash, rc } = await send(addr.employeeRegistry, EMPLOYEE_REGISTRY_ABI, "createEmployee", [e.wallet, keccak256(stringToHex(e.avatarURI)), e.avatarURI]);
    const log = parseEventLogs({ abi: EMPLOYEE_REGISTRY_ABI, logs: rc.logs, eventName: "EmployeeCreated" })[0];
    if (!log) throw new Error("NO_EMPLOYEE_EVENT");
    e.onchainId = Number(log.args.employeeId);
    realize(s, j.eventId, hash, rc.blockNumber);
    return done(j, hash);
  }

  if (j.kind === "link") {
    const e = s.employees[j.ref];
    if (!e.tokenAddress || !e.ponsMarketAddress) return later(j, 3000);
    try {
      const { hash, rc } = await send(addr.employeeRegistry, EMPLOYEE_REGISTRY_ABI, "linkToken", [BigInt(e.onchainId!), e.tokenAddress, e.ponsMarketAddress]);
      e.chainLinked = true;
      realize(s, j.eventId, hash, rc.blockNumber);
      return done(j, hash);
    } catch (err) {
      if (decode(err).name === "TokenAlreadyLinked") {
        e.chainLinked = true;
        return done(j);
      }
      throw err;
    }
  }

  if (j.kind === "startShift") {
    const sh = s.shifts[j.ref];
    const e = s.employees[sh.employeeId];
    try {
      const { hash, rc } = await send(addr.shiftManager, SHIFT_MANAGER_ABI, "startShift", [BigInt(e.onchainId!)]);
      const log = parseEventLogs({ abi: SHIFT_MANAGER_ABI, logs: rc.logs, eventName: "ShiftStarted" })[0];
      if (!log) throw new Error("NO_SHIFT_EVENT");
      sh.onchainShiftId = Number(log.args.shiftId);
      sh.startBlock = Number(rc.blockNumber);
      realize(s, j.eventId, hash, rc.blockNumber);
      return done(j, hash);
    } catch (err) {
      const d = decode(err);
      if (d.name === "ShiftAlreadyActive") {
        sh.onchainShiftId = Number(d.args![1]);
        return done(j);
      }
      if (d.name === "CooldownActive") return later(j, 4000);
      throw err;
    }
  }

  if (j.kind === "finalizeShift" || j.kind === "invalidateShift") {
    const sh = s.shifts[j.ref];
    const id = BigInt(sh.onchainShiftId!);
    try {
      if (j.kind === "finalizeShift") {
        const score10 = Math.round(sh.performanceScore * 10);
        const { hash, rc } = await send(addr.shiftManager, SHIFT_MANAGER_ABI, "finalizeShift", [id, score10, sh.resultHash as Hex]);
        const log = parseEventLogs({ abi: SHIFT_MANAGER_ABI, logs: rc.logs, eventName: "ShiftFinalized" })[0];
        if (log && Number(log.args.rank) !== sh.finalRank) s.log.push({ ts: Date.now(), msg: `RANK MISMATCH ${sh.code}: chain ${log.args.rank}, local ${sh.finalRank}` });
        for (const ev of s.events) if (ev.shiftId === sh.shiftId && ["Shift Finalized", "Rank Assigned", "Promotion"].includes(ev.type)) realize(s, ev.id, hash, rc.blockNumber);
        sh.endBlock = Number(rc.blockNumber);
        return done(j, hash);
      }
      const code = keccak256(stringToHex(sh.flags[0]?.code || "INVALID"));
      const { hash, rc } = await send(addr.shiftManager, SHIFT_MANAGER_ABI, "invalidateShift", [id, code, sh.invalidReason || "invalid"]);
      for (const ev of s.events) if (ev.shiftId === sh.shiftId && ev.type === "Shift Invalidated") realize(s, ev.id, hash, rc.blockNumber);
      return done(j, hash);
    } catch (err) {
      const d = decode(err);
      if (d.name === "ShiftTooShort") return later(j, Math.max(2, Number(d.args![2]) - Number(d.args![1]) + 2) * 1000);
      if (d.name === "ShiftNotActive") {
        const ok = j.kind === "finalizeShift" ? ((await pub.readContract({ address: addr.shiftManager, abi: SHIFT_MANAGER_ABI, functionName: "verifyResult", args: [id, sh.resultHash as Hex] })) as boolean) : true;
        if (ok) return done(j);
        return fail(j, "SHIFT_CLOSED_WITH_DIFFERENT_RESULT");
      }
      throw err;
    }
  }

  if (j.kind === "fundVault") {
    const ep = s.epochs[j.ref];
    const need = gweiToWei(ep.payrollPool);
    const [un, bps] = await Promise.all([
      pub.readContract({ address: addr.payrollVault, abi: PAYROLL_VAULT_ABI, functionName: "unallocated" }) as Promise<bigint>,
      pub.readContract({ address: addr.payrollVault, abi: PAYROLL_VAULT_ABI, functionName: "payrollBps" }) as Promise<number>,
    ]);
    if (un >= need) return done(j);
    const value = ((need - un) * 10_000n) / BigInt(bps) + 1n;
    const { hash, rc } = await send(addr.payrollVault, PAYROLL_VAULT_ABI, "fund", [`SHIFT epoch ${ep.epochId}`], value);
    ep.fundTx = hash;
    realize(s, j.eventId, hash, rc.blockNumber);
    return done(j, hash);
  }

  if (j.kind === "finalizeEpoch") {
    const ep = s.epochs[j.ref];
    const chain = (await pub.readContract({ address: addr.payrollDistributor, abi: PAYROLL_DISTRIBUTOR_ABI, functionName: "getEpoch", args: [BigInt(ep.epochId)] })) as any;
    if (chain.finalizedAt > 0n) {
      if (String(chain.merkleRoot).toLowerCase() !== String(ep.merkleRoot).toLowerCase()) {
        ep.chainState = "FAILED";
        return fail(j, "EPOCH_ID_TAKEN_ONCHAIN: bump the engine state or reset the epoch counter");
      }
      ep.claimsOpenAt = Number(chain.claimsOpenAt) * 1000;
      ep.chainState = "CONFIRMED";
      return done(j);
    }
    try {
      const { hash, rc } = await send(addr.payrollDistributor, PAYROLL_DISTRIBUTOR_ABI, "finalizeEpoch", [BigInt(ep.epochId), ep.merkleRoot as Hex, gweiToWei(ep.payrollPool)]);
      const log = parseEventLogs({ abi: PAYROLL_DISTRIBUTOR_ABI, logs: rc.logs, eventName: "PayrollEpochFinalized" })[0];
      if (log) ep.claimsOpenAt = Number(log.args.claimsOpenAt) * 1000;
      ep.finalizeTx = hash;
      ep.chainState = "CONFIRMED";
      realize(s, j.eventId, hash, rc.blockNumber);
      return done(j, hash);
    } catch (err) {
      const d = decode(err);
      if (d.name === "InsufficientUnallocated") return later(j, 5000);
      if (j.attempts >= MAX_ATTEMPTS) ep.chainState = "FAILED";
      throw err;
    }
  }

  if (j.kind === "claim") {
    const ep = s.epochs[j.ref];
    const leaf = ep.leaves.find((l) => l.employeeId === j.ref2)!;
    if (leaf.claimedAt) return done(j, leaf.claimTx);
    if (now < (ep.claimsOpenAt || 0)) return later(j, Math.min(5000, (ep.claimsOpenAt || 0) - now + 500));
    const cid = BigInt(leaf.chainEmployeeId!);
    const already = (await pub.readContract({ address: addr.payrollDistributor, abi: PAYROLL_DISTRIBUTOR_ABI, functionName: "claimed", args: [BigInt(ep.epochId), cid] })) as boolean;
    if (already) {
      await syncClaim(s, ep.epochId, j.ref2!);
      return done(j, leaf.claimTx);
    }
    const pr = leafProof(ep, j.ref2!)!;
    try {
      const { hash, rc } = await send(addr.payrollDistributor, PAYROLL_DISTRIBUTOR_ABI, "claim", [BigInt(ep.epochId), cid, leaf.wallet, gweiToWei(leaf.amount), pr.proof]);
      settleClaim(s, j.ref2!, ep.epochId, Date.now(), hash, Number(rc.blockNumber));
      return done(j, hash);
    } catch (err) {
      const d = decode(err);
      if (d.name === "ClaimsNotOpen") return later(j, 3000);
      if (d.name === "AlreadyClaimed") {
        await syncClaim(s, ep.epochId, j.ref2!);
        return done(j, leaf.claimTx);
      }
      throw err;
    }
  }
}

/** Mirrors a claim that already happened onchain (e.g. submitted from a wallet) into local state. */
async function syncClaim(s: State, epochId: number, empId: number) {
  const ep = s.epochs[epochId];
  const leaf = ep.leaves.find((l) => l.employeeId === empId)!;
  let tx: string | undefined;
  let block: number | undefined;
  try {
    const pub = signerService.publicClient;
    const head = await pub.getBlockNumber();
    const from = BigInt(Math.max(deployments.deployedAtBlock, Number(head) - 90_000));
    const logs = await pub.getLogs({
      address: CONTRACT_ADDRESSES.payrollDistributor,
      event: PAYROLL_DISTRIBUTOR_ABI.find((x) => x.type === "event" && x.name === "PayrollClaimed") as any,
      args: { epochId: BigInt(epochId), employeeId: BigInt(leaf.chainEmployeeId!) },
      fromBlock: from,
    } as any);
    if (logs[0]) {
      tx = logs[0].transactionHash;
      block = Number(logs[0].blockNumber);
    }
  } catch {}
  settleClaim(s, empId, epochId, Date.now(), tx, block);
}

function backfill(s: State) {
  for (const e of Object.values(s.employees)) {
    if (e.bot || e.testLabel) continue;
    const has = (kind: string) => s.chain!.jobs.some((j) => j.kind === kind && j.ref === e.employeeId && j.ref2 === undefined);
    if (!e.onchainId && !has("register")) enqueue(s, "register", e.employeeId);
    if (!e.chainLinked && e.launchStatus === "LIVE" && e.tokenAddress && !has("link")) enqueue(s, "link", e.employeeId);
  }
}

async function reconcileClaims(s: State) {
  let budget = 8;
  for (const ep of Object.values(s.epochs)) {
    if (ep.chainState !== "CONFIRMED") continue;
    for (const l of ep.leaves) {
      if (l.claimedAt || !l.chainEmployeeId || budget <= 0) continue;
      if (s.chain!.jobs.some((j) => j.kind === "claim" && j.ref === ep.epochId && j.ref2 === l.employeeId && (j.status === "queued" || j.status === "sent"))) continue;
      budget--;
      const c = (await signerService.publicClient.readContract({ address: CONTRACT_ADDRESSES.payrollDistributor, abi: PAYROLL_DISTRIBUTOR_ABI, functionName: "claimed", args: [BigInt(ep.epochId), BigInt(l.chainEmployeeId)] })) as boolean;
      if (c) await syncClaim(s, ep.epochId, l.employeeId);
    }
  }
}

/** Called once a second from the engine clock. Never throws, never runs two jobs at once. */
export function pumpChain(s: State) {
  if (!chainOn() || G.__chainBusy) return;
  const L = (s.chain ||= { jobs: [], nextJobId: 1 });
  const wall = Date.now();
  if (wall - (G.__chainBackfill || 0) > 10_000) {
    G.__chainBackfill = wall;
    backfill(s);
  }
  let job: ChainJob | undefined;
  for (const j of L.jobs) {
    if ((j.status !== "queued" && j.status !== "sent") || j.notBefore > wall) continue;
    const d = deps(s, j);
    if (d === "dead") {
      fail(j, "DEPENDENCY_FAILED");
      if (j.kind === "finalizeEpoch" && s.epochs[j.ref]) s.epochs[j.ref].chainState = "FAILED";
      continue;
    }
    if (d === "ready") {
      job = j;
      break;
    }
  }
  if (!job && wall - (G.__chainRecon || 0) > 20_000) {
    G.__chainRecon = wall;
    G.__chainBusy = true;
    reconcileClaims(s).catch((e) => console.error("[chain] reconcile", decode(e).msg)).finally(() => (G.__chainBusy = false));
    return;
  }
  if (!job) return;
  const j = job;
  G.__chainBusy = true;
  j.status = "sent";
  j.attempts++;
  execute(s, j)
    .catch((err) => {
      const d = decode(err);
      const text = d.name ? `${d.name}${d.args?.length ? "(" + d.args.join(",") + ")" : ""}` : d.msg;
      console.error(`[chain] ${j.kind}#${j.id} attempt ${j.attempts}: ${text}`);
      j.error = text;
      if (/insufficient funds|exceeds the balance|AccessControlUnauthorized/i.test(text) || j.attempts >= MAX_ATTEMPTS) fail(j, text);
      else later(j, Math.min(60_000, 3000 * 2 ** j.attempts));
    })
    .finally(() => {
      G.__chainBusy = false;
    });
}

/** Resolves when the job leaves the queue or the timeout hits. Used by the claim route. */
export async function waitForJob(job: ChainJob, ms = 50_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms && (job.status === "queued" || job.status === "sent")) await new Promise((r) => setTimeout(r, 700));
  return job;
}

export const chainSummary = (s: State) => {
  const jobs = s.chain?.jobs ?? [];
  const count = (st: string) => jobs.filter((j) => j.status === st).length;
  return { mode: CONFIG.dataMode, active: chainOn(), signer: signerService.address ?? null, queued: count("queued") + count("sent"), confirmed: count("confirmed"), failed: count("failed"), recent: jobs.slice(-25).reverse() };
};
