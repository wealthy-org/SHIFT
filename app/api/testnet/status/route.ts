import { handle } from "@/lib/api";
import { chainSummary } from "@/lib/chain/bridge";
import { CONTRACT_ADDRESSES } from "@/lib/chain/client";

export const dynamic = "force-dynamic";

export const GET = handle(async (ctx) => {
  const c = chainSummary(ctx.s);
  return {
    chainId: 46630,
    network: "Robinhood Chain Testnet",
    contracts: CONTRACT_ADDRESSES,
    signerActive: c.active,
    mode: c.mode,
    status: c.mode === "live" ? (c.active ? (c.failed ? "DEGRADED" : "LIVE") : "MISCONFIGURED_NO_SIGNER") : "DEMO",
    chain: c,
  };
});
