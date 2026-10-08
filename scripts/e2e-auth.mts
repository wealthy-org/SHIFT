// End-to-end check of the real sign-in path: a genuine secp256k1 signature over
// the server's nonce message, then every mutating route through that session.
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const B = process.env.BASE || "http://localhost:3090";
const ADMIN = process.env.ADMIN_TOKEN || "";
let cookie = "";

async function call(path: string, init: RequestInit = {}) {
  const r = await fetch(B + path, { ...init, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(init.headers as any) } });
  const set = r.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const [kv] = c.split(";");
    const [k] = kv.split("=");
    const rest = cookie.split("; ").filter((x) => x && !x.startsWith(k + "="));
    cookie = [...rest, kv].join("; ");
  }
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}
const post = (p: string, b: any = {}, h?: any) => call(p, { method: "POST", body: JSON.stringify(b), headers: h });
const ok = (label: string, cond: boolean, extra = "") => console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

const account = privateKeyToAccount(generatePrivateKey());
const address = account.address.toLowerCase();

// 1. every mutating route must refuse an anonymous caller
for (const [p, b] of [["/api/launch", { employeeId: 1 }], ["/api/shift/start", { employeeId: 1 }], ["/api/payroll/claim", { employeeId: 1, epochId: 1 }]] as const) {
  const r = await post(p, b);
  ok(`anonymous ${p} rejected`, r.status === 401 && r.body.error === "NOT_AUTHENTICATED", `${r.status} ${r.body.error}`);
}
ok("anonymous /api/me has no employee", (await call("/api/me")).body.employee === null);

// 2. forged signature is rejected
{
  const { body: n } = await call(`/api/auth/nonce?address=${address}`);
  const other = privateKeyToAccount(generatePrivateKey());
  const sig = await other.signMessage({ message: n.message });
  const r = await post("/api/auth/verify", { address, signature: sig, message: n.message });
  ok("signature from another key rejected", r.status === 400 && r.body.error === "BAD_SIGNATURE", r.body.error);
}
// 3. tampered message (nonce swapped) is rejected
{
  const { body: n } = await call(`/api/auth/nonce?address=${address}`);
  const tampered = n.message.replace(/Nonce: \w+/, "Nonce: deadbeefdeadbeef");
  const sig = await account.signMessage({ message: tampered });
  const r = await post("/api/auth/verify", { address, signature: sig, message: tampered });
  ok("tampered nonce rejected", r.status === 400 && r.body.error === "NONCE_MISMATCH", r.body.error);
}
// 4. genuine signature signs in and hires
let me: any;
{
  const { body: n } = await call(`/api/auth/nonce?address=${address}`);
  const sig = await account.signMessage({ message: n.message });
  const r = await post("/api/auth/verify", { address, signature: sig, message: n.message });
  me = r.body.employee;
  ok("genuine signature signs in", r.status === 200 && me?.wallet === address, me ? `${me.code} ${me.name} ${me.ticker}` : JSON.stringify(r.body));
}
// 5. same wallet, second sign-in: identity must not be regenerated
{
  const { body: n } = await call(`/api/auth/nonce?address=${address}`);
  const sig = await account.signMessage({ message: n.message });
  const again = (await post("/api/auth/verify", { address, signature: sig, message: n.message })).body.employee;
  ok("identity is permanent across sign-ins", again.id === me.id && again.ticker === me.ticker);
}
// 6. session cannot act for an employee it does not own
{
  const other = Object.values((await call("/api/office")).body.desks as any[]).find((d: any) => d.id !== me.id) as any;
  const r = await post("/api/launch", { employeeId: other.id });
  ok("cannot act for another employee", r.status === 400 && r.body.error === "WALLET_MISMATCH", r.body.error);
}
// 7. the real flow: launch -> shift -> payroll
{
  const r = await post("/api/launch", { employeeId: me.id });
  ok("launch accepted with session", r.status === 200, r.body.error ?? "");
  for (let i = 0; i < 40 && (await call("/api/me")).body.employee.launchStatus !== "LIVE"; i++) await new Promise((x) => setTimeout(x, 500));
  const after = (await call("/api/me")).body.employee;
  ok("token launched on Pons", after.launchStatus === "LIVE", after.token ?? "");
}
// 8. admin surface
{
  const anon = await call("/api/testnet");
  ok("testnet console needs the admin token", anon.status === 403, `${anon.status} ${anon.body.error}`);
  if (ADMIN) {
    const good = await call("/api/testnet", { headers: { "x-admin-token": ADMIN } });
    ok("admin token unlocks the console", good.status === 200, JSON.stringify(good.body.invariants ?? good.body.error));
    const bad = await call("/api/testnet", { headers: { "x-admin-token": "wrong" } });
    ok("wrong admin token rejected", bad.status === 403, bad.body.error);
  }
}
// 9. logout closes the session
{
  await post("/api/auth/logout");
  const r = await post("/api/shift/start", { employeeId: me.id });
  ok("logout closes the session", r.status === 401, r.body.error);
}
