import { createHash } from "node:crypto";
import { concatHex, encodeAbiParameters, keccak256, stringToHex } from "viem";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const hex = (s: string, n = 64) => "0x" + sha256(s).slice(0, n);
export type Hex = `0x${string}`;
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
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}

// --- Hashing -------------------------------------------------------------
// keccak256 throughout, so every hash the backend produces can be recomputed by
// PayrollDistributor and ShiftManager without a second scheme in the middle.

/// Anchored by ShiftManager.finalizeShift as `resultHash`.
export const resultHash = (pkg: unknown): Hex => keccak256(stringToHex(canonical(pkg)));

/// Mirrors PayrollDistributor.leafHash: the inner hash is hashed again so no
/// internal node of the tree can be presented as a leaf.
export const leafHash = (epochId: number, employeeId: number, wallet: string, amountWei: bigint): Hex =>
  keccak256(
    keccak256(
      encodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }, { type: "address" }, { type: "uint256" }],
        [BigInt(epochId), BigInt(employeeId), wallet as Hex, amountWei],
      ),
    ),
  );

/// Mirrors OpenZeppelin's commutative hash: the pair is sorted, then hashed as
/// 64 raw bytes.
const pairHash = (a: Hex, b: Hex): Hex => (a.toLowerCase() < b.toLowerCase() ? keccak256(concatHex([a, b])) : keccak256(concatHex([b, a])));

const ZERO: Hex = `0x${"0".repeat(64)}`;

export function merkleRoot(leaves: Hex[]): Hex {
  if (!leaves.length) return ZERO;
  let layer = leaves.slice();
  while (layer.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < layer.length; i += 2) next.push(i + 1 < layer.length ? pairHash(layer[i], layer[i + 1]) : layer[i]);
    layer = next;
  }
  return layer[0];
}

export function merkleProof(leaves: Hex[], index: number): Hex[] {
  const proof: Hex[] = [];
  let layer = leaves.slice();
  let i = index;
  while (layer.length > 1) {
    const sib = i % 2 ? i - 1 : i + 1;
    if (sib < layer.length) proof.push(layer[sib]);
    const next: Hex[] = [];
    for (let j = 0; j < layer.length; j += 2) next.push(j + 1 < layer.length ? pairHash(layer[j], layer[j + 1]) : layer[j]);
    layer = next;
    i = Math.floor(i / 2);
  }
  return proof;
}

export function verifyProof(leaf: Hex, proof: Hex[], root: Hex): boolean {
  let h = leaf;
  for (const p of proof) h = pairHash(h, p);
  return h.toLowerCase() === root.toLowerCase();
}

/// Payroll is accounted in gwei offchain and settled in wei onchain.
export const gweiToWei = (g: number) => BigInt(Math.round(g)) * 1_000_000_000n;

/// Hash of the raw snapshot trail. The trail stays offchain; this makes it tamper-evident.
export const snapshotsHash = (snapshots: unknown): Hex => keccak256(stringToHex(canonical(snapshots)));

export const gwei = (eth: number) => Math.round(eth * 1e9);
export const eth = (g: number) => g / 1e9;
