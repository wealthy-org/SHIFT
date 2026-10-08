import { handle } from "@/lib/api";
import { leaderboardView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const GET = handle(({ s, now }, req) => {
  const q = new URL(req.url).searchParams;
  return leaderboardView(s, now, q.get("view") || "Current shift", q.get("sort") || "Performance score");
});
