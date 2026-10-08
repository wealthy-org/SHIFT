import { NextResponse } from "next/server";
import { NONCE_COOKIE, NONCE_MAX_AGE, cookieHeader, issueNonce, loginMessage, nonceValue } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Hands the browser a signed, short-lived nonce plus the exact message to sign.
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") || "";
  const token = issueNonce();
  const nonce = nonceValue(token)!;
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0);
  const origin = new URL(req.url).origin;
  const message = loginMessage(address, nonce, origin, chainId, new Date().toISOString());
  return NextResponse.json(
    { nonce, message },
    { headers: { "set-cookie": cookieHeader(NONCE_COOKIE, token, NONCE_MAX_AGE), "cache-control": "no-store" } },
  );
}
