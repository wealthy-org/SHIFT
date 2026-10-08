import { handle } from "@/lib/api";
import { officeScene } from "@/lib/engine/office3d";
export const dynamic = "force-dynamic";
// Public: watching the office never needs a wallet.
export const GET = handle(({ s, now }) => officeScene(s, now));
