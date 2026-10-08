import { body, handle } from "@/lib/api";
import { assertAdmin } from "@/lib/auth";
import { claim, reorg, spawnTest } from "@/lib/engine/engine";
import type { Profile } from "@/lib/engine/types";
import { testnetView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";

export const GET = handle(({ s, now }, req) => {
  assertAdmin(req);
  return testnetView(s, now);
});

// Testnet-only scenario controls (phase 6 of the brief). Admin token required.
export const POST = handle(async ({ s, now }, req) => {
  assertAdmin(req);
  const { action, profile } = await body(req);
  const out: any = {};
  if (action === "spawn") spawnTest(s, profile as Profile, now);
  else if (action === "rpc") s.toggles.rpcDown = !s.toggles.rpcDown;
  else if (action === "failLaunch") s.toggles.failNextLaunch = !s.toggles.failNextLaunch;
  else if (action === "reorg") out.reorged = reorg(s, now);
  else if (action === "doubleClaim") {
    const ep = Object.values(s.epochs).filter((e) => e.status === "FINALIZED" && e.leaves.some((l) => l.claimedAt)).sort((a, b) => b.epochId - a.epochId)[0];
    if (!ep) throw new Error("NO_CLAIMED_EPOCH");
    const l = ep.leaves.find((x) => x.claimedAt)!;
    const tries: Record<string, string> = {};
    const attempt = (name: string, fn: () => void) => { try { fn(); tries[name] = "ACCEPTED (bug)"; } catch (e: any) { tries[name] = "rejected: " + e.message; } };
    attempt("replay claim", () => claim(s, l.employeeId, ep.epochId, now));
    attempt("forged amount", () => claim(s, l.employeeId, ep.epochId, now, { proof: [], amount: l.amount + 1 }));
    out.tries = tries;
    out.epoch = ep.epochId;
  } else throw new Error("UNKNOWN_ACTION");
  return { ...out, ...testnetView(s, now) };
});
