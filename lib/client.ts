"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "shift.testnet.wallet";

// Testnet "wallet": a locally generated address. Real wallet connection is out of scope.
export function useWallet() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setWallet(localStorage.getItem(KEY));
    } catch {}
    setReady(true);
  }, []);
  const connect = useCallback(() => {
    const b = new Uint8Array(20);
    crypto.getRandomValues(b);
    const w = "0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    try {
      localStorage.setItem(KEY, w);
    } catch {}
    setWallet(w);
    return w;
  }, []);
  const disconnect = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setWallet(null);
  }, []);
  return { wallet, ready, connect, disconnect };
}

export function useApi<T = any>(url: string | null, ms = 1000, keepPrev = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
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
  }, [url]);
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

export async function post<T = any>(url: string, body: any): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "ERROR");
  return j;
}

export function useMe(ms = 1000) {
  const w = useWallet();
  const { data, reload } = useApi<any>(w.ready ? `/api/me${w.wallet ? `?wallet=${w.wallet}` : ""}` : null, ms);
  return { ...w, me: data?.employee || null, launch: data?.launch || null, secsToEpoch: data?.secsToEpoch ?? null, cooldown: data?.cooldown ?? 0, loaded: !!data, reload };
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
};
