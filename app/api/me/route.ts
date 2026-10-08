import { handle, WALLET_RE } from "@/lib/api";
import { epochClock, meView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const GET = handle(({ s, now }, req) => {
  const wallet = new URL(req.url).searchParams.get("wallet") || "";
  if (!wallet) return { employee: null, launch: null, secsToEpoch: epochClock(s, now), cooldown: 0 };
  if (!WALLET_RE.test(wallet)) throw new Error("BAD_WALLET");
  return meView(s, wallet, now);
});
