"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { WalletError, ensureChain, hasWallet, onAccountsChanged, requestAccount, signMessage } from "./wallet";

export function useApi<T = any>(url: string | null, ms = 1000, keepPrev = false, headers?: Record<string, string>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const headerKey = JSON.stringify(headers ?? null);
  const load = useCallback(async () => {
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store", headers });
      const j = await r.json();
      if (!alive.current) return;
      if (!r.ok) setError(j.error || "ERROR");
      else {
        setError(null);
        setData(j);
      }
    } catch {
      if (alive.current) setError("OFFLINE");
    }
  }, [url, headerKey]);
  useEffect(() => {
    alive.current = true;
    if (!keepPrev) setData(null);
    load();
    const id = setInterval(load, ms);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load, ms]);
  return { data, error, reload: load };
}

export async function post<T = any>(url: string, body?: any, headers?: Record<string, string>): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "ERROR");
  return j;
}

// The session lives in an HttpOnly cookie, so /api/me is the only source of truth
// for who is signed in. The browser never stores an address it can act on.
export function useMe(ms = 1000) {
  const { data, reload } = useApi<any>("/api/me", ms);
  const [signingIn, setSigningIn] = useState(false);
  const me = data?.employee || null;

  const connect = useCallback(async () => {
    setSigningIn(true);
    try {
      const address = await requestAccount();
      // Signing in does not depend on the network, and some wallets (Phantom) cannot
      // add custom chains. Try to switch, but never block sign-in on it.
      await ensureChain().catch(() => {});
      const r = await fetch(`/api/auth/nonce?address=${address}`, { cache: "no-store" });
      const { message } = await r.json();
      if (!message) throw new WalletError("NONCE_FAILED", "Could not start sign-in. Try again.");
      const signature = await signMessage(address, message);
      await post("/api/auth/verify", { address, signature, message });
      await reload();
    } finally {
      setSigningIn(false);
    }
  }, [reload]);

  const disconnect = useCallback(async () => {
    await post("/api/auth/logout").catch(() => {});
    await reload();
  }, [reload]);

  // Switching accounts in the wallet must not leave the old session open.
  useEffect(() => {
    if (!me) return;
    return onAccountsChanged((accounts) => {
      if (accounts[0]?.toLowerCase() !== me.wallet) void disconnect();
    });
  }, [me, disconnect]);

  return {
    me,
    wallet: me?.wallet ?? null,
    ready: !!data,
    loaded: !!data,
    signingIn,
    hasWallet: hasWallet(),
    launch: data?.launch || null,
    secsToEpoch: data?.secsToEpoch ?? null,
    cooldown: data?.cooldown ?? 0,
    connect,
    disconnect,
    reload,
  };
}

export const ERRORS: Record<string, string> = {
  COOLDOWN: "Cooldown active, try again in a moment.",
  SHIFT_ALREADY_ACTIVE: "A shift is already running.",
  NO_CONFIRMED_LAUNCH: "Launch your token on Pons first.",
  ALREADY_CLAIMED: "Already claimed. Double claims are rejected.",
  CLAIM_NOT_OPEN: "Claims for this epoch are not open yet.",
  EPOCH_NOT_FINALIZED: "This epoch is not finalized yet.",
  INVALID_PROOF: "Merkle proof did not verify against the published root.",
  WALLET_MISMATCH: "This wallet does not own that employee.",
  ALREADY_LAUNCHED: "Token already launched.",
  NOT_AUTHENTICATED: "Your session expired. Connect your wallet again.",
  NONCE_EXPIRED: "That sign-in request timed out. Try again.",
  BAD_SIGNATURE: "The signature did not match that address.",
  ADMIN_FORBIDDEN: "Wrong admin token.",
  ADMIN_DISABLED: "The testnet console is disabled in this deployment.",
  NO_WALLET: "No EVM wallet found. Install one, then reload this page.",
  REJECTED: "You dismissed the wallet prompt.",
  PENDING: "Your wallet has a pending request. Finish it there first.",
};

export const errorText = (e: unknown) => {
  const code = e instanceof Error ? e.message : String(e);
  return ERRORS[code] || (e instanceof WalletError ? e.message : code);
};
