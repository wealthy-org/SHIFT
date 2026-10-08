import { createHash } from "node:crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const hex = (s: string, n = 64) => "0x" + sha256(s).slice(0, n);
export const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "");

export function rand(h: { s: number }): number {
  h.s = (h.s + 0x6d2b79f5) >>> 0;
  let t = h.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const seedOf = (s: string) => parseInt(sha256(s).slice(0, 8), 16) >>> 0;
export const randn = (h: { s: number }) => (rand(h) + rand(h) + rand(h) + rand(h) - 2) * 1.73;
export function poisson(h: { s: number }, lam: number): number {
  if (lam <= 0) return 0;
  const L = Math.exp(-lam);
  let p = 1;
  let k = 0;
  do {
    k++;
    p *= rand(h);
  } while (p > L && k < 40);
  return k - 1;
}
export const pick = <T,>(h: { s: number }, a: T[]): T => a[Math.floor(rand(h) * a.length)];

// Stable JSON so result hashes are reproducible by anyone.
export function canonical(v: any): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}

// --- Merkle (sorted-pair sha256; a Solidity version would use keccak256) ---
export const leafHash = (epochId: number, employeeId: number, wallet: string, amount: number) =>
  sha256(`${epochId}|${employeeId}|${wallet}|${amount}`);
const pairHash = (a: string, b: string) => (a < b ? sha256(a + b) : sha256(b + a));

export function merkleRoot(leaves: string[]): string {
  if (!leaves.length) return "0x" + "0".repeat(64);
  let layer = leaves.slice();
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) next.push(i + 1 < layer.length ? pairHash(layer[i], layer[i + 1]) : layer[i]);
    layer = next;
  }
  return "0x" + layer[0];
}
export function merkleProof(leaves: string[], index: number): string[] {
  const proof: string[] = [];
  let layer = leaves.slice();
  let i = index;
  while (layer.length > 1) {
    const sib = i % 2 ? i - 1 : i + 1;
    if (sib < layer.length) proof.push(layer[sib]);
    const next: string[] = [];
    for (let j = 0; j < layer.length; j += 2) next.push(j + 1 < layer.length ? pairHash(layer[j], layer[j + 1]) : layer[j]);
    layer = next;
    i = Math.floor(i / 2);
  }
  return proof;
}
export function verifyProof(leaf: string, proof: string[], root: string): boolean {
  let h = leaf;
  for (const p of proof) h = pairHash(h, p);
  return "0x" + h === root;
}

export const gwei = (eth: number) => Math.round(eth * 1e9);
export const eth = (g: number) => g / 1e9;
