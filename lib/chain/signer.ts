import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ACTIVE_CHAIN } from "./client";

// One key, three roles (FINALIZER, PAYROLL, REGISTRAR). It can score shifts and
// publish roots but never move vault funds, which is enforced by the contracts.
export class SignerService {
  readonly account;
  readonly walletClient;
  readonly publicClient;

  constructor() {
    // viem's http() throws synchronously if given an empty string (not lazily, on first
    // use) — and this class is built as a module-level singleton, so that throw happens
    // the moment anything imports this file, including Next's build-time page-data
    // collection for API routes. Passing undefined instead defers to viem's own default
    // and only errors when a call is actually attempted, so a missing/misconfigured
    // NEXT_PUBLIC_RPC_URL doesn't take the whole build down.
    const rpc = ACTIVE_CHAIN.rpcUrls.default.http[0] || undefined;
    this.publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http(rpc) });
    const key = process.env.SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
    if (key && /^0x[0-9a-fA-F]{64}$/.test(key)) {
      this.account = privateKeyToAccount(key);
      this.walletClient = createWalletClient({ account: this.account, chain: ACTIVE_CHAIN, transport: http(rpc) });
    }
  }

  hasSigner(): boolean {
    return !!this.account && !!this.walletClient;
  }
  get address(): `0x${string}` | undefined {
    return this.account?.address;
  }
}

const G = globalThis as any;
export const signerService: SignerService = (G.__shiftSigner ||= new SignerService());
