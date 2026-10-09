import { CONFIG } from "../engine/config";
import type { ChainJob, JobKind, State } from "../engine/types";

// Light on purpose: the engine imports this, so it must not pull in viem.
export const chainOn = () => CONFIG.dataMode === "live" && /^0x[0-9a-fA-F]{64}$/.test(process.env.SIGNER_PRIVATE_KEY || "");
export const chainWanted = () => CONFIG.dataMode === "live";

export function enqueue(s: State, kind: JobKind, ref: number, extra: { ref2?: number; eventId?: number } = {}): ChainJob | null {
  if (!chainOn()) return null;
  const L = (s.chain ||= { jobs: [], nextJobId: 1 });
  const dupe = L.jobs.find((j) => j.kind === kind && j.ref === ref && j.ref2 === extra.ref2 && j.status !== "failed");
  if (dupe) return dupe;
  const job: ChainJob = { id: L.nextJobId++, kind, ref, ref2: extra.ref2, eventId: extra.eventId, status: "queued", attempts: 0, notBefore: 0, createdAt: Date.now() };
  L.jobs.push(job);
  if (L.jobs.length > 400) {
    const drop = L.jobs.filter((j) => j.status === "confirmed").slice(0, L.jobs.length - 400);
    L.jobs = L.jobs.filter((j) => !drop.includes(j));
  }
  return job;
}

export const jobOf = (s: State, kind: JobKind, ref: number, ref2?: number) => s.chain?.jobs.find((j) => j.kind === kind && j.ref === ref && j.ref2 === ref2 && j.status !== "failed") ?? s.chain?.jobs.find((j) => j.kind === kind && j.ref === ref && j.ref2 === ref2);
