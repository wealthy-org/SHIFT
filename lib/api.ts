import { NextResponse } from "next/server";
import { live } from "./engine/store";
import type { State } from "./engine/types";

export const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

type Ctx = { s: State; now: number };
export function handle(fn: (ctx: Ctx, req: Request) => unknown | Promise<unknown>) {
  return async (req: Request) => {
    try {
      const out = await fn(await live(), req);
      return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
    } catch (e: any) {
      const code = String(e?.message || "ERROR");
      const known = /^[A-Z_]+$/.test(code);
      if (!known) console.error("[api]", e);
      return NextResponse.json({ error: known ? code : "INTERNAL" }, { status: known ? 400 : 500 });
    }
  };
}
export const body = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};
export function owned(s: State, id: number, wallet: string) {
  const e = s.employees[id];
  if (!e) throw new Error("UNKNOWN_EMPLOYEE");
  if (!WALLET_RE.test(wallet || "") || e.wallet !== wallet.toLowerCase()) throw new Error("WALLET_MISMATCH");
  return e;
}
