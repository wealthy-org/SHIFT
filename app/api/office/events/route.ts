import { handle } from "@/lib/api";
import { officeScene } from "@/lib/engine/office3d";
export const dynamic = "force-dynamic";
// Incremental replay for a client that reconnects: everything after its cursor.
export const GET = handle(({ s, now }, req) => {
  const after = Number(new URL(req.url).searchParams.get("after") || 0);
  if (!Number.isFinite(after) || after < 0) throw new Error("BAD_CURSOR");
  const scene = officeScene(s, now);
  return { seq: scene.seq, events: scene.events.filter((e) => e.seq > after).reverse() };
});
