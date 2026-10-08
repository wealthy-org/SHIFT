import { body, handle, owned } from "@/lib/api";
import { claim } from "@/lib/engine/engine";
export const dynamic = "force-dynamic";
// Verifies the Merkle proof against the published root; replays are rejected.
export const POST = handle(async ({ s, now }, req) => {
  const { employeeId, wallet, epochId } = await body(req);
  const e = owned(s, Number(employeeId), wallet);
  const l = claim(s, e.employeeId, Number(epochId), now);
  return { ok: true, tx: l.claimTx, amount: l.amount / 1e9 };
});
