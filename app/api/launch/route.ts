import { body, handle, owned } from "@/lib/api";
import { startLaunch } from "@/lib/engine/engine";
import { meView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const POST = handle(async ({ s, now }, req) => {
  const { employeeId, wallet } = await body(req);
  const e = owned(s, Number(employeeId), wallet);
  startLaunch(s, e.employeeId, now);
  return meView(s, e.wallet, now);
});
