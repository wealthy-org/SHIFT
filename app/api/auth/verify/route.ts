import { NextResponse } from "next/server";
import { NONCE_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE, cookieHeader, issueSession, nonceValue, readCookie, verifyLogin } from "@/lib/auth";
import { live } from "@/lib/engine/store";
import { createEmployee } from "@/lib/engine/engine";
import { meView } from "@/lib/engine/views";

export const dynamic = "force-dynamic";

// Checks the signature against the nonce we issued, then opens a session.
// Signing in is also clocking in: the employee record is created here, once.
export async function POST(req: Request) {
  try {
    const { address, signature, message } = await req.json();
    const nonce = nonceValue(readCookie(req, NONCE_COOKIE));
    if (!nonce) throw new Error("NONCE_EXPIRED");
    const wallet = await verifyLogin(String(address), String(signature), String(message), nonce);
    const { s, now } = await live();
    const e = createEmployee(s, wallet, now);
    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", cookieHeader(SESSION_COOKIE, issueSession(wallet), SESSION_MAX_AGE));
    headers.append("set-cookie", cookieHeader(NONCE_COOKIE, "", 0));
    return NextResponse.json(meView(s, e.wallet, now), { headers });
  } catch (e: any) {
    const code = String(e?.message || "ERROR");
    const known = /^[A-Z_]+$/.test(code);
    if (!known) console.error("[auth/verify]", e);
    return NextResponse.json({ error: known ? code : "INTERNAL" }, { status: known ? 400 : 500 });
  }
}
