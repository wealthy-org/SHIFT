import { handle } from "@/lib/api";
import { chainSummary } from "@/lib/chain/bridge";
import { CONTRACT_ADDRESSES } from "@/lib/chain/client";

export const dynamic = "force-dynamic";

export const GET = handle(async (ctx) => {
  const c = chainSummary(ctx.s);
  return {
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0),
    network: process.env.NEXT_PUBLIC_CHAIN_NAME || "",
    contracts: CONTRACT_ADDRESSES,
    signerActive: c.active,
    mode: c.mode,
    status: c.mode === "live" ? (c.active ? (c.failed ? "DEGRADED" : "LIVE") : "MISCONFIGURED_NO_SIGNER") : "DEMO",
    chain: c,
  };
});
