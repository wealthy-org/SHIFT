import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { verifyMessage } from "viem";

export const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;
const NONCE_TTL = 5 * 60 * 1000;
const SESSION_TTL = 7 * 24 * 3600 * 1000;
export const NONCE_COOKIE = "shift_nonce";
export const SESSION_COOKIE = "shift_session";

const PROD = process.env.NODE_ENV === "production";

// A stable secret is required in production; in dev we fall back to a per-process one
// so `npm run dev` works out of the box (sessions reset on restart).
let devSecret: string | null = null;
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (PROD) throw new Error("AUTH_SECRET_MISSING");
  if (!devSecret) {
    devSecret = randomBytes(32).toString("hex");
    console.warn("[auth] AUTH_SECRET is not set — using a temporary dev secret. Sessions reset on restart.");
  }
  return devSecret;
}

const mac = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function sign(payload: string): string {
  return `${payload}.${mac(payload)}`;
}
function unsign(token: string | undefined, maxAgeMs: number): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const payload = token.slice(0, i);
  if (!safeEq(token.slice(i + 1), mac(payload))) return null;
  const ts = Number(payload.slice(payload.lastIndexOf(".") + 1));
  if (!Number.isFinite(ts) || Date.now() - ts > maxAgeMs) return null;
  return payload;
}

export const readCookie = (req: Request, name: string): string | undefined =>
  req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="))
    ?.slice(name.length + 1);

export const cookieHeader = (name: string, value: string, maxAgeSec: number) =>
  `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${PROD ? "; Secure" : ""}`;

export const issueNonce = () => sign(`${randomBytes(12).toString("hex")}.${Date.now()}`);
export const nonceValue = (token: string | undefined) => {
  const payload = unsign(token, NONCE_TTL);
  return payload ? payload.slice(0, payload.indexOf(".")) : null;
};

export const issueSession = (wallet: string) => sign(`${wallet.toLowerCase()}.${Date.now()}`);
export const sessionWallet = (req: Request): string | null => {
  const payload = unsign(readCookie(req, SESSION_COOKIE), SESSION_TTL);
  if (!payload) return null;
  const wallet = payload.slice(0, payload.indexOf("."));
  return WALLET_RE.test(wallet) ? wallet : null;
};

export const NONCE_MAX_AGE = NONCE_TTL / 1000;
export const SESSION_MAX_AGE = SESSION_TTL / 1000;

// SIWE-shaped so a wallet shows a message a person can actually read before signing.
export function loginMessage(address: string, nonce: string, origin: string, chainId: number, issuedAt: string) {
  const host = origin.replace(/^https?:\/\//, "");
  return [
    `${host} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Clock in to SHIFT, the onchain workforce. Signing proves you own this wallet. It costs no gas and approves no transaction.",
    "",
    `URI: ${origin}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export async function verifyLogin(address: string, signature: string, message: string, nonce: string) {
  if (!WALLET_RE.test(address)) throw new Error("BAD_WALLET");
  if (!message.includes(`Nonce: ${nonce}`)) throw new Error("NONCE_MISMATCH");
  if (!message.includes(address)) throw new Error("ADDRESS_MISMATCH");
  const ok = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` });
  if (!ok) throw new Error("BAD_SIGNATURE");
  return address.toLowerCase();
}

// Testnet console. Without ADMIN_TOKEN it is open in dev and closed in production.
export function assertAdmin(req: Request) {
  const want = process.env.ADMIN_TOKEN;
  if (!want) {
    if (PROD) throw new Error("ADMIN_DISABLED");
    return;
  }
  const got = req.headers.get("x-admin-token") || "";
  if (!got || !safeEq(got, want)) throw new Error("ADMIN_FORBIDDEN");
}
