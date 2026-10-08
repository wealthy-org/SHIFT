// Read model for the 3D office. One snapshot carries everything the scene needs,
// so the client never has to call the chain per character or per frame.
import { CONFIG, RANK_NAMES } from "./config";
import { blockAt, epochOf, getEpoch } from "./engine";
import type { ChainEvent, Employee, State } from "./types";
import { seedOf } from "./util";
import { deskOf, estimate, statusOf } from "./views";

export const DESKS_PER_FLOOR = 16;

// Distinct generated looks. Picked deterministically from the employee id, so a
// person looks the same on every refresh and on every screen.
const SHIRTS = ["#3E5A8A", "#8A4F3E", "#4E7A5A", "#7A6A3E", "#5A4E7A", "#2F6F6F", "#9A5B6F", "#6B7A3E", "#3E6E8A", "#8A6E3E", "#5E5E66", "#7A3E4E"];
const SKINS = ["#F1C9A5", "#D9A47E", "#B57A55", "#8A5A3C", "#6B4430", "#E8B894"];
const HAIR = ["#1E1A16", "#3B2A1E", "#6B4A2B", "#C9A15A", "#2C2C30", "#8A3B2A", "#D8D2C4"];

export type Pose = "reception" | "working" | "break" | "seated";

const OFFICE_TYPE: Record<string, string> = {
  "Employee Created": "employee.created",
  "Token Launched": "token.launched",
  "Shift Started": "shift.started",
  "Shift Finalized": "shift.completed",
  Promotion: "rank.updated",
  "Payroll Epoch Finalized": "payroll.finalized",
  "Payroll Claimed": "payroll.claimed",
  "Shift Invalidated": "state.reverted",
};

function lookOf(e: Employee) {
  const h = seedOf(`look:${e.employeeId}:${e.wallet}`);
  return {
    shirt: SHIRTS[h % SHIRTS.length],
    skin: SKINS[(h >>> 4) % SKINS.length],
    hair: HAIR[(h >>> 8) % HAIR.length],
    style: (h >>> 12) % 4,
    acc: (h >>> 16) % 3,
  };
}

function poseOf(s: State, e: Employee): { pose: Pose; pending: boolean } {
  if (e.launchStatus === "LAUNCHING") return { pose: "reception", pending: true };
  if (e.launchStatus !== "LIVE") return { pose: "reception", pending: false };
  if (e.activeShiftId) {
    const st = s.shifts[e.activeShiftId]?.status;
    return { pose: "working", pending: st === "PENDING" };
  }
  return { pose: e.shiftIds.length ? "break" : "seated", pending: false };
}

export function officeScene(s: State, now: number) {
  const head = blockAt(s, now);
  const all = Object.values(s.employees).sort((a, b) => a.employeeId - b.employeeId);

  // Desks are assigned by hire order among launched employees, so the layout is
  // stable across refreshes and reconnects.
  const live = all.filter((e) => e.launchStatus === "LIVE");
  const deskIndex = new Map(live.map((e, i) => [e.employeeId, i]));

  const employees = all.map((e) => {
    const d = deskOf(s, e, now);
    const { pose, pending } = poseOf(s, e);
    const act = e.activeShiftId ? s.shifts[e.activeShiftId] : undefined;
    const last = act || s.shifts[e.shiftIds[e.shiftIds.length - 1]];
    const snap = act?.snapshots[act.snapshots.length - 1];
    const est = estimate(s, e.employeeId, now);
    return {
      id: e.employeeId,
      code: e.code,
      name: e.displayName,
      ticker: e.ticker,
      wallet: e.wallet,
      token: e.tokenAddress || null,
      dept: e.department,
      look: lookOf(e),
      desk: deskIndex.has(e.employeeId) ? deskIndex.get(e.employeeId)! : -1,
      pose,
      pending,
      status: e.launchStatus === "LIVE" ? statusOf(s, e, now) : e.launchStatus === "LAUNCHING" ? "LAUNCHING" : "HIRED",
      rank: d.rank,
      rankIndex: RANK_NAMES.indexOf(d.rank),
      score: d.score,
      mcap: d.mcap,
      volume: snap?.volume ?? last?.volume ?? 0,
      holders: snap ? snap.holders + snap.uniqueTraders : last?.holderCount ?? 0,
      shiftCode: last?.code ?? null,
      shiftStatus: last?.status ?? null,
      secs: d.secs,
      left: act ? Math.max(0, CONFIG.shiftSeconds - d.secs) : 0,
      snaps: d.snapsDone,
      estPay: est.payEth,
      earned: e.totalPayrollEarned / 1e9,
      promoted: !!(e.promotedUntil && now < e.promotedUntil),
      sim: e.bot || !!e.testLabel,
      updatedAt: snap?.ts ?? last?.finalizedAt ?? last?.startedAt ?? e.joinedAt,
    };
  });

  const working = employees.filter((x) => x.pose === "working");
  const next = working.filter((x) => x.left > 0).sort((a, b) => a.left - b.left)[0];
  const cur = getEpoch(s, epochOf(s, now));
  const lastFinal = Object.values(s.epochs).filter((x) => x.status === "FINALIZED").sort((a, b) => b.epochId - a.epochId)[0];
  const claimable = !!lastFinal && now >= (lastFinal.claimsOpenAt || 0) && lastFinal.leaves.some((l) => !l.claimedAt) && now - (lastFinal.finalizedAt || 0) < 180_000;
  const finalEvents = s.events.filter((ev) => head - ev.block >= CONFIG.confirmDepth);

  const events = s.events
    .filter((ev) => OFFICE_TYPE[ev.type])
    .slice(-30)
    .reverse()
    .map((ev: ChainEvent) => ({
      seq: ev.id,
      type: OFFICE_TYPE[ev.type],
      label: ev.type,
      who: ev.who,
      employeeId: ev.employeeId ?? null,
      chainId: 46630,
      block: ev.block,
      tx: ev.tx,
      confirmation: head - ev.block >= CONFIG.confirmDepth ? "confirmed" : "pending",
      ts: ev.ts,
      extra: ev.type === "Promotion" ? `to ${ev.payload?.to}` : ev.type === "Payroll Claimed" ? `${Number(ev.payload?.amount ?? 0).toFixed(3)} ETH` : ev.type === "Token Launched" ? ev.payload?.ticker ?? "" : "",
      to: ev.type === "Promotion" ? ev.payload?.to ?? null : null,
    }));

  const top = [...working].sort((a, b) => b.score - a.score).slice(0, 3).map((x) => ({ id: x.id, name: x.name, score: x.score, rank: x.rank }));

  return {
    now,
    seq: s.nextEventId - 1,
    floors: Math.max(1, Math.ceil(live.length / DESKS_PER_FLOOR)),
    desksPerFloor: DESKS_PER_FLOOR,
    employees,
    events,
    hud: {
      active: working.length,
      total: all.length,
      nextShift: next ? { secs: next.left, name: next.name } : null,
      epochId: cur.epochId,
      epochSecs: Math.max(0, Math.round((cur.endTime - now) / 1000)),
      poolEth: estimate(s, 0, now).poolEth,
      chain: s.toggles.rpcDown ? "delayed" : "connected",
      head,
      finalizedBlock: finalEvents.length ? finalEvents[finalEvents.length - 1].block : head,
      top,
    },
    board: {
      epochId: claimable ? lastFinal.epochId : cur.epochId,
      poolEth: claimable ? lastFinal.payrollPool / 1e9 : estimate(s, 0, now).poolEth,
      status: claimable ? "Claimable" : "Estimated",
    },
    stale: s.toggles.rpcDown,
    // The market and ledger behind this office are SHIFT's testnet simulation,
    // not the deployed contracts yet. The UI must say so.
    simulated: true,
  };
}

export type OfficeScene = ReturnType<typeof officeScene>;
export type OfficeEmployee = OfficeScene["employees"][number];
export type OfficeEvent = OfficeScene["events"][number];
