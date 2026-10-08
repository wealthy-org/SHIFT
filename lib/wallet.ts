"use client";

import { getAddress } from "viem";

// Minimal EIP-1193 wallet access. No wallet SDK: SHIFT only needs an address,
// one signature to prove ownership, and the right network selected.
type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<any>; on?: (e: string, h: (...a: any[]) => void) => void; removeListener?: (e: string, h: (...a: any[]) => void) => void };

export const CHAIN = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0),
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || "Robinhood Chain Testnet",
  rpc: process.env.NEXT_PUBLIC_RPC_URL || "",
  explorer: process.env.NEXT_PUBLIC_EXPLORER_URL || "",
  symbol: process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "ETH",
};

export const provider = (): Eip1193 | null => (typeof window !== "undefined" ? ((window as any).ethereum ?? null) : null);
export const hasWallet = () => !!provider();

export class WalletError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

// Wallets reject with 4001 when the person dismisses the prompt. That is not a failure.
const wrap = (e: any): WalletError => {
  const code = e?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return new WalletError("REJECTED", "You dismissed the wallet prompt.");
  if (code === -32002) return new WalletError("PENDING", "Your wallet already has a pending request. Open it and finish there.");
  return new WalletError("WALLET_ERROR", e?.message || "Your wallet could not complete the request.");
};

export async function requestAccount(): Promise<string> {
  const p = provider();
  if (!p) throw new WalletError("NO_WALLET", "No EVM wallet found in this browser.");
  try {
    const accounts: string[] = await p.request({ method: "eth_requestAccounts" });
    if (!accounts?.length) throw new WalletError("NO_ACCOUNT", "Your wallet returned no account.");
    // Keep the EIP-55 checksum form. Wallets such as Phantom refuse to sign when
    // the address passed to personal_sign does not match theirs character for character.
    return getAddress(accounts[0]);
  } catch (e) {
    throw e instanceof WalletError ? e : wrap(e);
  }
}

export async function currentChainId(): Promise<number | null> {
  const p = provider();
  if (!p) return null;
  try {
    return Number(await p.request({ method: "eth_chainId" }));
  } catch {
    return null;
  }
}

// Asks the wallet to switch, and offers to add the network if it does not know it yet.
export async function ensureChain(): Promise<void> {
  const p = provider();
  if (!p || !CHAIN.id) return;
  const hex = "0x" + CHAIN.id.toString(16);
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (e: any) {
    if (e?.code !== 4902 && e?.code !== -32603) throw wrap(e);
    if (!CHAIN.rpc) throw new WalletError("NO_RPC", `Add ${CHAIN.name} to your wallet manually: this build has no RPC URL configured.`);
    try {
      await p.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hex,
          chainName: CHAIN.name,
          rpcUrls: [CHAIN.rpc],
          nativeCurrency: { name: CHAIN.symbol, symbol: CHAIN.symbol, decimals: 18 },
          ...(CHAIN.explorer ? { blockExplorerUrls: [CHAIN.explorer] } : {}),
        }],
      });
    } catch (err) {
      throw wrap(err);
    }
  }
}

export async function signMessage(address: string, message: string): Promise<string> {
  const p = provider();
  if (!p) throw new WalletError("NO_WALLET", "No EVM wallet found in this browser.");
  try {
    return await p.request({ method: "personal_sign", params: [message, address] });
  } catch (e) {
    throw wrap(e);
  }
}

export function onAccountsChanged(handler: (accounts: string[]) => void): () => void {
  const p = provider();
  if (!p?.on) return () => {};
  p.on("accountsChanged", handler);
  return () => p.removeListener?.("accountsChanged", handler);
}
