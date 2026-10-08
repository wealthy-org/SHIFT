import { handle } from "@/lib/api";
import { officeView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const GET = handle(({ s, now }) => officeView(s, now));
