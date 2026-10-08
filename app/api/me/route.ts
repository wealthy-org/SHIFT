import { handle } from "@/lib/api";
import { epochClock, meView } from "@/lib/engine/views";
export const dynamic = "force-dynamic";
export const GET = handle(({ s, now, wallet }) =>
  wallet ? meView(s, wallet, now) : { employee: null, launch: null, secsToEpoch: epochClock(s, now), cooldown: 0 },
);
