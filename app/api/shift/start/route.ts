import { body, handle, owned } from "@/lib/api";
import { startShift } from "@/lib/engine/engine";
import { meView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const POST = handle(async ({ s, now }, req) => {
  const { employeeId, wallet } = await body(req);
  const e = owned(s, Number(employeeId), wallet);
  startShift(s, e, now);
  return meView(s, e.wallet, now);
});
