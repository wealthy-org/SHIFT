import { body, handle, owned } from "@/lib/api";
import { startShift } from "@/lib/engine/engine";
import { meView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const POST = handle(async (ctx, req) => {
  const e = owned(ctx, Number((await body(req)).employeeId));
  startShift(ctx.s, e, ctx.now);
  return meView(ctx.s, e.wallet, ctx.now);
});
