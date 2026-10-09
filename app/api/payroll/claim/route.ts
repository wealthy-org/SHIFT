import { body, handle, owned } from "@/lib/api";
import { chainOn, enqueue } from "@/lib/chain/jobs";
import { waitForJob } from "@/lib/chain/bridge";
import { claim } from "@/lib/engine/engine";
export const dynamic = "force-dynamic";

// Demo mode verifies the Merkle proof locally. Live mode submits the claim to
// PayrollDistributor with the service key; the money goes to the wallet inside
// the leaf, so the service never holds custody.
export const POST = handle(async (ctx, req) => {
  const { employeeId, epochId } = await body(req);
  const e = owned(ctx, Number(employeeId));
  if (!chainOn()) {
    const l = claim(ctx.s, e.employeeId, Number(epochId), ctx.now);
    return { ok: true, tx: l.claimTx, amount: l.amount / 1e9 };
  }
  const ep = ctx.s.epochs[Number(epochId)];
  const leaf = ep?.leaves.find((l) => l.employeeId === e.employeeId);
  if (!ep || ep.status !== "FINALIZED") throw new Error("EPOCH_NOT_FINALIZED");
  if (!leaf) throw new Error("NOT_ELIGIBLE");
  if (leaf.claimedAt) throw new Error("ALREADY_CLAIMED");
  if (ep.chainState !== "CONFIRMED") throw new Error("EPOCH_NOT_CONFIRMED");
  const job = enqueue(ctx.s, "claim", ep.epochId, { ref2: e.employeeId })!;
  await waitForJob(job);
  if (job.status === "failed") throw new Error("CLAIM_FAILED");
  if (job.status !== "confirmed") throw new Error("CLAIM_PENDING");
  return { ok: true, tx: leaf.claimTx, amount: leaf.amount / 1e9 };
});
