"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ProfileSkeleton } from "../Skeleton";
import AppShell from "../AppShell";
import { CHIP, EXPLORER, LIME, ago, explorerTx, mmss, ponsToken, short } from "@/lib/format";
import { ERRORS, post, useApi, useMe } from "@/lib/client";

const W = 560;
const H = 170;
const line = (vals: number[], max: number, n: number) => {
  const v = vals.length > 1 ? vals : [vals[0] || 0, vals[0] || 0];
  return v.map((x, i) => ((i / n) * W).toFixed(1) + "," + (H - (x / max) * (H - 16)).toFixed(1));
};
const area = (pts: string[]) => "0," + H + " " + pts.join(" ") + " " + pts[pts.length - 1].split(",")[0] + "," + H;
const BREAKDOWN: [string, string, number][] = [["marketCap", "Average market cap", 40], ["volume", "Volume", 25], ["participants", "Holders and unique traders", 15], ["liquidity", "Liquidity", 10], ["stability", "Retention and stability", 10]];
const TABS = ["Shift history", "Promotions", "Payroll", "Onchain proofs"];
const mono = { font: "'Geist Mono', monospace", size: "13px" };
const dim = { fg: "#8E978A" };
const cell = (v: any, o: any = {}) => ({ v, fg: "#E9EDE2", font: "inherit", size: "15px", ...o });

export default function ProfilePage({ id }: { id: number }) {
  const [tab, setTab] = useState("Shift history");
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { data, reload } = useApi<any>(`/api/employee/${id}`);
  const { me, wallet } = useMe();
  useEffect(() => {
    try {
      const v = localStorage.getItem(`shift.promo.${id}`);
      if (v) setDismissed(Number(v));
    } catch {}
  }, [id]);
  if (!data) return <AppShell active="desk" title="My desk"><ProfileSkeleton /></AppShell>;
  const mine = me && me.id === id;
  const { name, ticker, code, dept, wallet: empWallet, token } = { ...data.me, wallet: data.me.wallet };
  const sh = data.shift;
  const ch = CHIP[data.status];
  const status = data.status, chipBg = ch[0], chipFg = ch[1], chipB = ch[2];
  const rank = data.rank, best = data.best;
  const done = !!sh?.done;
  const el = sh?.elapsed ?? 0;
  const snapsN = sh?.snaps ?? 0;
  const snaps = Array.from({ length: 15 }, (_, i) => ({ bg: i < snapsN ? LIME : "#232B20", sy: i + 1 === snapsN && sh?.active ? 1.25 : 1 }));
  const perfV: number[] = sh?.perf || [0];
  const mcV: number[] = sh?.mcap || [0];
  const pMax = Math.max(50, Math.ceil(Math.max(...perfV) / 10) * 10);
  const mMax = Math.max(22, Math.max(...mcV) * 1.15);
  const pl = line(perfV, pMax, 15), ml = line(mcV, mMax, 15);
  const last = (a: string[]) => a[a.length - 1].split(",");
  const [perfX, perfY] = last(pl), [mcX, mcY] = last(ml);
  const perfLine = pl.join(" "), perfArea = area(pl), mcLine = ml.join(" "), mcArea = area(ml);
  const score = (sh?.score ?? 0).toFixed(1);
  const pay = (sh?.payEth ?? 0).toFixed(3);
  const mcap = (mcV[mcV.length - 1] || 0).toFixed(1);
  const vol = (sh?.volume ?? 0).toFixed(1), liq = (sh?.liquidity ?? 0).toFixed(1), holders = sh?.holders ?? 0;
  const totalPay = data.totals.payroll.toFixed(3), shifts = data.totals.shifts;
  const timer = mmss(el), left = mmss(sh?.left ?? 300), pct = ((el / 300) * 100).toFixed(2);
  const shiftState = !sh ? "No shift yet" : sh.status === "INVALID" ? "Shift flagged and excluded" : done ? "Shift closed" : sh.status === "FINALIZING" ? "Finalizing result" : "Shift in progress";
  const payday = "";
  const tabs = TABS.map((l) => ({ label: l, sel: l === tab, fg: l === tab ? "#E9EDE2" : "#8E978A", line: l === tab ? LIME : "transparent", weight: l === tab ? 600 : 400, pick: () => setTab(l) }));
  const now = data.now;
  let cols = "", heads: string[] = [], rows: any[] = [], emptyTitle = "", emptyText = "";
  if (tab === "Shift history") {
    cols = "1fr 1fr 0.8fr 1fr 1fr 1fr 0.6fr";
    heads = ["Shift", "Started", "Score", "Rank", "Payroll", "Status", "Proof"];
    rows = data.history.map((h: any) => ({ cells: [
      cell(h.code, mono), cell(ago(h.startedAt, now)), cell(h.score.toFixed(1)), cell(h.rank),
      h.settled ? cell(h.payroll.toFixed(3) + " ETH") : cell(h.status === "COMPLETED" ? "Awaiting epoch" : "-", dim),
      cell(h.status === "INVALID" ? "Excluded" : h.status === "COMPLETED" ? "Completed" : h.status === "FINALIZING" ? "Finalizing" : "Active", { fg: h.status === "ACTIVE" || h.status === "FINALIZING" ? LIME : h.status === "INVALID" ? "#E0A44A" : "#E9EDE2" }),
      cell("Proof ↗", { fg: LIME, href: "/proof" }),
    ] }));
    emptyTitle = "No shifts yet"; emptyText = "Your first shift starts as soon as your token is live on Pons.";
  } else if (tab === "Promotions") {
    cols = "1fr 1fr 1fr 1fr 0.6fr";
    heads = ["From", "To", "Score", "When", "Proof"];
    rows = data.promotions.map((p: any) => ({ cells: [cell(p.from), cell(p.to, { fg: LIME }), cell(p.score.toFixed(1)), cell(ago(p.ts, now)), cell("Proof ↗", { fg: LIME, href: "/proof" })] }));
    emptyTitle = "No promotions yet"; emptyText = "Finish a shift above the next rank threshold to be promoted. Right now you are on track for " + (sh?.projectedRank || "Intern") + ".";
  } else if (tab === "Payroll") {
    cols = "1fr 1fr 1fr 1fr 0.6fr";
    heads = ["Epoch", "Shares", "Amount", "Status", "Proof"];
    rows = data.payrolls.map((p: any) => ({ cells: [cell("Epoch " + p.epochId), cell((p.shares * 100).toFixed(2) + "%"), cell(p.amount.toFixed(3) + " ETH"), cell(p.claimed ? "Paid" : "Finalized", { fg: p.claimed ? "#E9EDE2" : LIME }), cell("Proof ↗", { fg: LIME, href: "/proof" })] }));
    emptyTitle = "No payroll yet"; emptyText = "Payroll appears here once an epoch that includes your shifts is finalized.";
  } else {
    cols = "1.2fr 1fr 1fr 0.9fr";
    heads = ["Event", "Contract", "Transaction", "Links"];
    rows = data.proofs.map((e: any) => ({ cells: [cell(e.type), cell(e.contract, { ...mono, ...dim }), cell(short(e.tx), mono), cell(e.final ? "Explorer ↗  Pons ↗" : `${e.depth}/3 confirmations`, { fg: e.final ? LIME : "#E0A44A", size: "14px", href: "/proof" })] }));
    emptyTitle = "No onchain events"; emptyText = "Events appear as the protocol records them.";
  }
  const hasRows = rows.length > 0, noRows = !hasRows;
  const confetti = Array.from({ length: 30 }, (_, i) => ({ left: (i * 37) % 100, color: [LIME, "#E4E7DA", "#8FA34A"][i % 3], delay: ((i % 9) * 0.08).toFixed(2), dur: (1.8 + (i % 5) * 0.25).toFixed(2) }));
  const res = data.result;
  const showPromo = !!(mine && res && res.fresh && res.promoted && dismissed !== res.shiftId);
  const promoText = res ? `${res.from} → ${res.to}`.toUpperCase() : "";
  const promoScore = res ? res.score.toFixed(1) : "";
  const closePromo = () => {
    if (!res) return;
    setDismissed(res.shiftId);
    try { localStorage.setItem(`shift.promo.${id}`, String(res.shiftId)); } catch {}
  };
  const restart = async () => {
    setBusy(true); setErr("");
    try { await post("/api/shift/start", { employeeId: id, wallet }); await reload(); } catch (e: any) { setErr(ERRORS[e.message] || e.message); }
    setBusy(false);
  };
  const canRestart = mine && sh && !sh.active && sh.status !== "FINALIZING" && data.launchStatus === "LIVE";
  void empWallet;
  return (
    <AppShell active="desk" title="My desk" overlay={<>
{showPromo && (<>
<div className="bd" role="dialog" aria-modal="true" aria-label="Promotion" style={{position: 'fixed', inset: '0', zIndex: '50', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(6,8,6,.8)'}}>
<div style={{background: '#151A13', border: '1px solid #3A4436', borderRadius: '28px', padding: 'clamp(26px,4vw,44px)', maxWidth: '560px', width: '100%', textAlign: 'center', position: 'relative', overflow: 'hidden'}}>
<div aria-hidden="true" style={{position: 'absolute', inset: '0', pointerEvents: 'none'}}>
{confetti.map((c, i) => (<Fragment key={i}><span className="fall" style={{position: 'absolute', top: '-10px', left: `${c.left}%`, width: '8px', height: '14px', borderRadius: '2px', background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`}} /></Fragment>))}
</div>
<div style={{fontSize: '14px', color: '#8E978A'}}>Shift complete</div>
<div className="stamp2" style={{display: 'inline-block', marginTop: '8px', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: 'clamp(64px,10vw,96px)', lineHeight: '0.9', color: '#C8F135', letterSpacing: '0.04em'}}>PROMOTED</div>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(30px,4vw,40px)', lineHeight: '1', marginTop: '14px'}}>{promoText}</div>
<p style={{margin: '12px 0 0', color: '#AEB7A8'}}>Performance score {promoScore}. Your new rank carries a bigger share of this epoch's payroll.</p>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '26px'}}>
<Link href="/payroll" className="btnl" style={{textDecoration: 'none', background: '#C8F135', color: '#0F130E', fontWeight: '600', fontSize: '15px', padding: '0 20px', minHeight: '48px', display: 'inline-flex', alignItems: 'center', borderRadius: '999px'}}>Go to payday</Link>
<Link href="/proof" className="btng" style={{textDecoration: 'none', color: '#E9EDE2', fontSize: '15px', padding: '0 20px', minHeight: '48px', display: 'inline-flex', alignItems: 'center', border: '1px solid #3A4436', borderRadius: '999px'}}>View result proof</Link>
<button type="button" className="btng" onClick={closePromo} style={{background: 'transparent', color: '#E9EDE2', font: 'inherit', fontSize: '15px', padding: '0 20px', minHeight: '48px', border: '1px solid #3A4436', borderRadius: '999px', cursor: 'pointer'}}>Close</button>
</div>
</div>
</div>
</>)}
    </>}>
<main className="vin" style={{padding: 'clamp(20px,3vw,36px)', maxWidth: '1800px', margin: '0 auto'}}>
<section style={{display: 'flex', flexWrap: 'wrap', gap: '20px 28px', alignItems: 'center', background: '#151A13', border: '1px solid #263023', borderRadius: '24px', padding: '24px'}}>
<svg width="84" height="84" viewBox="0 0 44 44" aria-hidden="true" style={{flex: 'none'}}><rect width="44" height="44" rx="11" fill="#E4E7DA" /><circle cx="22" cy="17" r="8" fill="#0F130E" /><rect x="9" y="28" width="26" height="16" rx="8" fill="#0F130E" /><rect x="18" y="15" width="3" height="3" fill="#E4E7DA" /><rect x="24" y="15" width="3" height="3" fill="#E4E7DA" /></svg>
<div style={{flex: '1 1 320px'}}>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(42px,4.5vw,58px)', lineHeight: '0.95'}}>{name}</h2>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: '14px', color: '#8E978A', marginTop: '8px'}}>
<span style={{fontFamily: "'Geist Mono', monospace", color: '#C8F135'}}>{ticker}</span><span>{code}</span><span>{dept}</span><span>Wallet <span style={{fontFamily: "'Geist Mono', monospace"}}>{short(wallet)}</span></span><span>Token <span style={{fontFamily: "'Geist Mono', monospace"}}>{short(token)}</span></span>
</div>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px'}}>
<span className="tr" style={{fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em', padding: '5px 10px', borderRadius: '999px', background: chipBg, color: chipFg, border: `1px solid ${chipB}`}}>{status}</span>
<span style={{border: '1px solid #2E382A', borderRadius: '999px', padding: '4px 10px', fontSize: '13px', color: '#AEB7A8'}}>Rank <span style={{color: '#E9EDE2', fontWeight: '600'}}>{rank}</span></span>
<span style={{border: '1px solid #2E382A', borderRadius: '999px', padding: '4px 10px', fontSize: '13px', color: '#AEB7A8'}}>Best <span style={{color: '#E9EDE2', fontWeight: '600'}}>{best}</span></span>
</div>
</div>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
<a href={ponsToken(token) || "#"} className="btnl" style={{textDecoration: 'none', background: '#C8F135', color: '#0F130E', fontWeight: '600', fontSize: '14px', padding: '0 16px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', borderRadius: '999px'}}>View on Pons ↗</a>
<Link href="/proof" className="btng" style={{textDecoration: 'none', color: '#E9EDE2', fontSize: '14px', padding: '0 16px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', border: '1px solid #3A4436', borderRadius: '999px'}}>Robinhood Chain Explorer ↗</Link>
</div>
</section>

<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '16px', marginTop: '16px', alignItems: 'stretch'}}>
<section style={{background: '#151A13', border: '1px solid #263023', borderRadius: '24px', padding: '24px'}}>
<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'}}><span style={{fontWeight: '600'}}>{shiftState}</span><span style={{fontSize: '13px', color: '#8E978A'}}>Time left <span style={{color: '#E9EDE2', fontWeight: '600'}}>{left}</span></span></div>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: 'clamp(80px,8vw,112px)', lineHeight: '0.9', marginTop: '14px'}}>{timer}</div>
<div style={{fontSize: '13px', color: '#8E978A'}}>of 05:00, snapshot every 20 seconds</div>
<div style={{height: '4px', borderRadius: '2px', background: '#232B20', marginTop: '18px', overflow: 'hidden'}}><div className="tr" style={{height: '100%', width: `${pct}%`, background: '#C8F135'}} /></div>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(15, minmax(0, 1fr))', gap: '4px', marginTop: '10px'}} aria-label="Snapshots recorded">
{snaps.map((p, i) => (<Fragment key={i}><span className="tr" style={{height: '28px', borderRadius: '5px', background: p.bg, transform: `scaleY(${p.sy})`}} /></Fragment>))}
</div>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginTop: '20px', fontSize: '12px', color: '#8E978A'}}>
<div>Live score<div style={{color: '#C8F135', fontSize: '26px', fontWeight: '600'}}>{score}</div></div>
<div>Projected rank<div style={{color: '#E9EDE2', fontSize: '26px', fontWeight: '600'}}>{rank}</div></div>
<div>Estimated pay<div style={{color: '#E9EDE2', fontSize: '26px', fontWeight: '600'}}>{pay} <span style={{fontSize: '14px'}}>ETH</span></div></div>
</div>
{sh?.components && (<>
<div style={{marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #263023'}}>
<div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#8E978A', marginBottom: '12px'}}><span>Score breakdown</span><span>weight in config</span></div>
{BREAKDOWN.map(([k, label, w]) => (<Fragment key={k}>
<div style={{marginBottom: '12px'}}>
<div style={{display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px'}}><span>{label} <span style={{color: '#6E776A'}}>{w}%</span></span><span style={{color: '#E9EDE2', fontWeight: '600'}}>{(sh.components[k] || 0).toFixed(1)}</span></div>
<div style={{height: '8px', background: '#1E251C', borderRadius: '4px', overflow: 'hidden'}}><div className="tr" style={{height: '100%', width: `${Math.min(100, sh.components[k] || 0)}%`, background: '#C8F135', borderRadius: '4px'}} /></div>
</div>
</Fragment>))}
{sh.flags?.length > 0 && (<div style={{marginTop: '14px', fontSize: '13px', color: '#E0A44A'}}>Flags: {[...new Set(sh.flags.map((f: any) => f.code))].join(', ')}</div>)}
</div>
</>)}
{done && (<>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px'}}>
<Link href="/payroll" className="btnl" style={{textDecoration: 'none', background: '#C8F135', color: '#0F130E', fontWeight: '600', fontSize: '14px', padding: '0 18px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', borderRadius: '999px'}}>Go to payday</Link>
<button type="button" className="btng" onClick={restart} disabled={!canRestart || busy || data.cooldown > 0} style={{background: 'transparent', color: '#E9EDE2', font: 'inherit', fontSize: '14px', padding: '0 18px', minHeight: '44px', border: '1px solid #3A4436', borderRadius: '999px', cursor: 'pointer'}}>Start next shift{data.cooldown > 0 ? ` (${data.cooldown}s)` : ""}</button>
</div>
</>)}
</section>

<div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
<figure style={{margin: '0', background: '#151A13', border: '1px solid #263023', borderRadius: '22px', padding: '20px 20px 12px'}}>
<figcaption style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px'}}><span style={{fontSize: '14px', color: '#8E978A'}}>Performance score</span><span style={{fontSize: '22px', fontWeight: '600', color: '#C8F135'}}>{score}</span></figcaption>
<svg viewBox="0 0 560 176" width="100%" role="img" aria-label="Performance score across this shift">
<line x1="0" x2="560" y1="45" y2="45" stroke="#222A20" /><line x1="0" x2="560" y1="90" y2="90" stroke="#222A20" /><line x1="0" x2="560" y1="135" y2="135" stroke="#222A20" />
<polygon points={perfArea} fill="#C8F135" opacity=".08" />
<polyline points={perfLine} fill="none" stroke="#C8F135" strokeWidth="2.5" strokeLinejoin="round" />
<circle cx={perfX} cy={perfY} r="6" fill="#C8F135" />
</svg>
</figure>
<figure style={{margin: '0', background: '#151A13', border: '1px solid #263023', borderRadius: '22px', padding: '20px 20px 12px'}}>
<figcaption style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px'}}><span style={{fontSize: '14px', color: '#8E978A'}}>Market cap</span><span style={{fontSize: '22px', fontWeight: '600'}}>{mcap} ETH</span></figcaption>
<svg viewBox="0 0 560 176" width="100%" role="img" aria-label="Market cap across this shift">
<line x1="0" x2="560" y1="45" y2="45" stroke="#222A20" /><line x1="0" x2="560" y1="90" y2="90" stroke="#222A20" /><line x1="0" x2="560" y1="135" y2="135" stroke="#222A20" />
<polygon points={mcArea} fill="#E4E7DA" opacity=".07" />
<polyline points={mcLine} fill="none" stroke="#E4E7DA" strokeWidth="2.5" strokeLinejoin="round" />
<circle cx={mcX} cy={mcY} r="6" fill="#E4E7DA" />
</svg>
</figure>
</div>
</div>

<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '16px'}}>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: '#8E978A'}}>Volume this shift</div><div style={{fontSize: '26px', fontWeight: '600'}}>{vol} ETH</div></div>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: '#8E978A'}}>Liquidity</div><div style={{fontSize: '26px', fontWeight: '600'}}>{liq} ETH</div></div>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: '#8E978A'}}>Holders and unique traders</div><div style={{fontSize: '26px', fontWeight: '600'}}>{holders}</div></div>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: '#8E978A'}}>Total payroll</div><div style={{fontSize: '26px', fontWeight: '600'}}>{totalPay} ETH</div></div>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: '#8E978A'}}>Shifts worked</div><div style={{fontSize: '26px', fontWeight: '600'}}>{shifts}</div></div>
</div>

<div role="tablist" style={{display: 'flex', flexWrap: 'wrap', gap: '4px', borderBottom: '1px solid #2E382A', marginTop: '32px'}}>
{tabs.map((tb, i) => (<Fragment key={i}>
<button type="button" role="tab" className="tab" onClick={tb.pick} aria-selected={tb.sel} style={{border: '0', background: 'transparent', font: 'inherit', fontSize: '15px', padding: '12px 16px', minHeight: '44px', marginBottom: '-1px', cursor: 'pointer', color: tb.fg, borderBottom: `2px solid ${tb.line}`, fontWeight: tb.weight}}>{tb.label}</button>
</Fragment>))}
</div>
<div role="tabpanel" style={{paddingTop: '16px'}}>
{hasRows && (<>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '20px', overflowX: 'auto'}}>
<div style={{minWidth: '680px'}}>
<div style={{display: 'grid', gridTemplateColumns: cols, gap: '16px', padding: '12px 18px', borderBottom: '1px solid #2E382A', fontSize: '13px', color: '#8E978A'}}>
{heads.map((h, i) => (<Fragment key={i}><span>{h}</span></Fragment>))}
</div>
{rows.map((r, i) => (<Fragment key={i}>
<div style={{display: 'grid', gridTemplateColumns: cols, gap: '16px', padding: '14px 18px', borderBottom: '1px solid #222A20', alignItems: 'center'}}>
{r.cells.map((c, i) => (<Fragment key={i}><span style={{color: c.fg, fontFamily: c.font, fontSize: c.size}}>{c.href ? <Link href={c.href} style={{color: "inherit", textDecoration: "none"}}>{c.v}</Link> : c.v}</span></Fragment>))}
</div>
</Fragment>))}
</div>
</div>
</>)}
{noRows && (<>
<div style={{border: '1px dashed #3A4436', borderRadius: '20px', padding: '36px', textAlign: 'center', color: '#AEB7A8'}}>
<div style={{color: '#E9EDE2', fontSize: '19px', fontWeight: '600'}}>{emptyTitle}</div>
<div style={{marginTop: '6px'}}>{emptyText}</div>
</div>
</>)}
</div>
</main>
      {err && <p style={{ padding: "0 clamp(20px,3vw,36px)", color: "#E0A44A" }}>{err}</p>}
    </AppShell>
  );
}
