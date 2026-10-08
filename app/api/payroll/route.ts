import { handle } from "@/lib/api";
import { payrollView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const GET = handle(({ s, now }, req) => payrollView(s, Number(new URL(req.url).searchParams.get("employeeId") || 0), now));
