import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ ok: true }, { headers: { "set-cookie": cookieHeader(SESSION_COOKIE, "", 0) } });
}
