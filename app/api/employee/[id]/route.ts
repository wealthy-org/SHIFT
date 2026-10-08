import { handle } from "@/lib/api";
import { employeeView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const GET = handle(({ s, now }, req) => {
  const id = Number(new URL(req.url).pathname.split("/").pop());
  const v = employeeView(s, id, now);
  if (!v) throw new Error("UNKNOWN_EMPLOYEE");
  return v;
});
