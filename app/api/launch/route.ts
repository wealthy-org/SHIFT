import { body, handle, owned } from "@/lib/api";
import { startLaunch } from "@/lib/engine/engine";
import { meView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const POST = handle(async (ctx, req) => {
  const e = owned(ctx, Number((await body(req)).employeeId));
  startLaunch(ctx.s, e.employeeId, ctx.now);
  return meView(ctx.s, e.wallet, ctx.now);
});
