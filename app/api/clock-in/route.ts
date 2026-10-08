import { body, handle, WALLET_RE } from "@/lib/api";
import { createEmployee } from "@/lib/engine/engine";
import { meView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
// Idempotent: a wallet always maps to the same employee. Identity is never regenerated.
export const POST = handle(async ({ s, now }, req) => {
  const { wallet } = await body(req);
  if (!WALLET_RE.test(wallet || "")) throw new Error("BAD_WALLET");
  const e = createEmployee(s, wallet, now);
  return meView(s, e.wallet, now);
});
