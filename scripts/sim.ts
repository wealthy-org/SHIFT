import { CONFIG, RANK_NAMES } from "../lib/engine/config";
import { advance, claim, newState, spawnTest, startShift } from "../lib/engine/engine";

const t = Date.now();
const s = newState(t);
const t1 = performance.now();
advance(s, t);
console.log("warm-up ms", Math.round(performance.now() - t1), "shifts", Object.keys(s.shifts).length, "epochs", Object.keys(s.epochs).length, "events", s.events.length);
const by: Record<string, number[]> = {};
Object.values(s.shifts).forEach((x) => {
  const e = s.employees[x.employeeId];
  if (x.status === "COMPLETED") (by[e.profile] ||= []).push(x.performanceScore);
});
for (const [p, v] of Object.entries(by)) console.log(p.padEnd(8), "n", v.length, "min", Math.min(...v), "avg", (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), "max", Math.max(...v));
const rc: Record<string, number> = {};
Object.values(s.shifts).filter((x) => x.status === "COMPLETED").forEach((x) => (rc[RANK_NAMES[x.finalRank]] = (rc[RANK_NAMES[x.finalRank]] || 0) + 1));
console.log("ranks", rc, "invalid", Object.values(s.shifts).filter((x) => x.status === "INVALID").length);
// adversarial
const now = s.lastStep;
(["pumpdump", "wash", "liqmanip", "normal"] as const).forEach((p) => spawnTest(s, p, now));
advance(s, now + 330_000);
Object.values(s.employees).filter((e) => e.testLabel).forEach((e) => {
  const sh = s.shifts[e.shiftIds[0]];
  console.log(e.testLabel, sh.status, sh.performanceScore, RANK_NAMES[sh.finalRank], sh.flags.map((f) => f.code).join(","), sh.invalidReason || "", "raw", sh.rawVolume.toFixed(1), "counted", sh.volume.toFixed(1));
});
// payroll invariants
advance(s, now + 330_000 + 400_000);
const eps = Object.values(s.epochs).filter((e) => e.status === "FINALIZED");
let bad = 0;
eps.forEach((e) => {
  const sum = e.leaves.reduce((a, l) => a + l.amount, 0);
  if (sum > e.payrollPool) bad++;
});
const claimed = eps.flatMap((e) => e.leaves).filter((l) => l.claimedAt).length;
console.log("epochs", eps.length, "overpaid", bad, "leaves claimed", claimed, "vault funded", s.vault.funded / 1e9, "claimed", s.vault.claimed / 1e9, "carry", s.vault.carry / 1e9);
const e0 = eps.find((e) => e.leaves.length)!;
try { claim(s, e0.leaves[0].employeeId, e0.epochId, s.lastStep); } catch (x: any) { console.log("double claim ->", x.message); }
try { claim(s, e0.leaves[0].employeeId, e0.epochId, s.lastStep, { proof: [], amount: e0.leaves[0].amount + 1 }); } catch (x: any) { console.log("bad amount ->", x.message); }
console.log("json KB", Math.round(JSON.stringify(s).length / 1024));
