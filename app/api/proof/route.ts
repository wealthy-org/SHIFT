import { handle } from "@/lib/api";
import { proofView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const GET = handle(({ s, now }, req) => {
  const id = new URL(req.url).searchParams.get("employeeId");
  return proofView(s, id ? Number(id) : null, now);
});
