import { body, handle, owned } from "@/lib/api";
import { claim } from "@/lib/engine/engine";
export const dynamic = "force-dynamic";
// Verifies the Merkle proof against the published root; replays are rejected.
export const POST = handle(async (ctx, req) => {
  const { employeeId, epochId } = await body(req);
  const e = owned(ctx, Number(employeeId));
  const l = claim(ctx.s, e.employeeId, Number(epochId), ctx.now);
  return { ok: true, tx: l.claimTx, amount: l.amount / 1e9 };
});
