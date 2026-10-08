import { NextResponse } from "next/server";
import { WALLET_RE, sessionWallet } from "./auth";
import { live } from "./engine/store";
import type { State } from "./engine/types";

export { WALLET_RE };

type Ctx = { s: State; now: number; wallet: string | null };

export function handle(fn: (ctx: Ctx, req: Request) => unknown | Promise<unknown>) {
  return async (req: Request) => {
    try {
      const { s, now } = await live();
      const out = await fn({ s, now, wallet: sessionWallet(req) }, req);
      return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
    } catch (e: any) {
      const code = String(e?.message || "ERROR");
      const known = /^[A-Z_]+$/.test(code);
      if (!known) console.error("[api]", e);
      const status = known ? (code === "NOT_AUTHENTICATED" ? 401 : code.startsWith("ADMIN_") ? 403 : 400) : 500;
      return NextResponse.json({ error: known ? code : "INTERNAL" }, { status });
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

// Every mutating route goes through here: the wallet comes from the signed session
// cookie, never from the request body, so a caller cannot act as someone else.
export function requireWallet(ctx: Ctx): string {
  if (!ctx.wallet) throw new Error("NOT_AUTHENTICATED");
  return ctx.wallet;
}

export function owned(ctx: Ctx, id: number) {
  const wallet = requireWallet(ctx);
  const e = ctx.s.employees[id];
  if (!e) throw new Error("UNKNOWN_EMPLOYEE");
  if (e.wallet !== wallet) throw new Error("WALLET_MISMATCH");
  return e;
}
