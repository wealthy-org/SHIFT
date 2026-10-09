import { handle } from "@/lib/api";
import { CONTRACT_ADDRESSES } from "@/lib/chain/client";
import { signerService } from "@/lib/chain/signer";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  return {
    chainId: 46630,
    network: "Robinhood Chain Testnet",
    contracts: CONTRACT_ADDRESSES,
    signerActive: signerService.hasSigner(),
    status: "READY",
  };
});
