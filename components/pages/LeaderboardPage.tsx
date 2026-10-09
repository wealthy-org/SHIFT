"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { LeaderboardSkeleton } from "../Skeleton";
import AppShell from "../AppShell";
import { CHIP, EXPLORER, LIME, ago, explorerTx, mmss, ponsToken, short } from "@/lib/format";
import { ERRORS, post, useApi, useMe } from "@/lib/client";
import { fallbackLook } from "../office3d/mini/fallbackLook";
import { useLazyComponent } from "../office3d/mini/useLazy";

const loadPodium = () => import("../office3d/mini/Podium");

const VIEWS = ["Current shift", "24 hours", "7 days", "All time"];
const SORTS = ["Performance score", "Payroll earned", "Highest rank", "Average market cap", "Volume"];

export default function LeaderboardPage() {
  const [view, setView] = useState("Current shift");
  const [sort, setSort] = useState("Performance score");
  const { me } = useMe();
  const { data } = useApi<any>(`/api/leaderboard?view=${encodeURIComponent(view)}&sort=${encodeURIComponent(sort)}`, 1000, true);
  const views = VIEWS.map((v) => ({ label: v, pressed: v === view, bg: v === view ? "#E9EDE2" : "transparent", fg: v === view ? "#0F130E" : "#AEB7A8", weight: v === view ? 600 : 400, pick: () => setView(v) }));
  const sorts = SORTS.map((o) => ({ label: o, pressed: o === sort, border: o === sort ? LIME : "#2E382A", fg: o === sort ? LIME : "#AEB7A8", pick: () => setSort(o) }));
  const metricLabel = sort;
  const rows = (data?.rows || []).map((r: any, i: number) => ({
    ...r, href: `/employee/${r.id}`, you: me && me.id === r.id ? "(you)" : r.sim ? "SIM" : "", score: r.score.toFixed(1), mcap: r.mcap.toFixed(1), vol: r.vol.toFixed(1), pay: r.pay.toFixed(3),
    bg: me && me.id === r.id ? "rgba(200,241,53,0.07)" : "transparent", numColor: i < 3 ? LIME : "#5F685B", delay: (Math.min(i, 20) * 0.03).toFixed(2),
  }));
  const fmt = (r: any) => (data.key === "pay" ? r.pay + " ETH" : data.key === "best" ? r.rank : data.key === "mcap" ? r.mcap + " ETH" : data.key === "vol" ? r.vol + " ETH" : r.score);
  const podium = rows.slice(0, 3).map((r: any, i: number) => ({ ...r, metric: fmt(r), bg: i === 0 ? "#1A2117" : "#151A13", border: i === 0 ? "rgba(200,241,53,.55)" : "#263023", numColor: i === 0 ? LIME : "#AEB7A8" }));
  const PodiumC = useLazyComponent(loadPodium, !!data);
  if (!data) return <AppShell active="leaderboard" title="Leaderboard"><LeaderboardSkeleton /></AppShell>;
  return (
    <AppShell active="leaderboard" title="Leaderboard">
<main className="vin" style={{padding: 'clamp(20px,3vw,36px)', maxWidth: '1800px', margin: '0 auto'}}>
<section aria-label="Top three" style={{background: '#151A13', border: '1px solid #263023', borderRadius: '22px', overflow: 'hidden'}}>
{PodiumC ? <PodiumC top3={[0, 1, 2].map((i) => podium[i] ? { id: podium[i].id, look: podium[i].look || fallbackLook() } : null)} /> : <div style={{height: 240}} />}
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', borderTop: '1px solid #222A20'}}>
{podium.map((p, i) => (<Fragment key={i}>
<Link href={p.href} className="lrow" style={{textDecoration: 'none', color: '#E9EDE2', background: p.bg, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', borderRight: i < podium.length - 1 ? '1px solid #222A20' : 'none'}}>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: '40px', lineHeight: '0.8', color: p.numColor, width: '32px'}}>{p.pos}</span>
<span style={{flex: '1', minWidth: '0'}}><span style={{display: 'block', fontWeight: '600', fontSize: '16px'}}>{p.name}</span><span style={{display: 'block', fontSize: '13px', color: '#8E978A'}}>{p.rank}</span></span>
<span style={{textAlign: 'right'}}><span style={{display: 'block', fontSize: '12px', color: '#8E978A'}}>{metricLabel}</span><span style={{display: 'block', fontSize: '20px', fontWeight: '600', color: '#C8F135'}}>{p.metric}</span></span>
</Link>
</Fragment>))}
</div>
</section>

<div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px 20px', margin: '28px 0 14px'}}>
<div role="group" aria-label="Time range" style={{display: 'inline-flex', flexWrap: 'wrap', gap: '4px', background: '#121710', border: '1px solid #222A20', borderRadius: '999px', padding: '4px'}}>
{views.map((v, i) => (<Fragment key={i}>
<button type="button" className="segb" onClick={v.pick} aria-pressed={v.pressed} style={{border: '0', cursor: 'pointer', font: 'inherit', fontSize: '14px', padding: '8px 14px', minHeight: '36px', borderRadius: '999px', background: v.bg, color: v.fg, fontWeight: v.weight}}>{v.label}</button>
</Fragment>))}
</div>
<div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px'}}>
<span style={{fontSize: '14px', color: '#8E978A'}}>Rank by</span>
<div role="group" aria-label="Rank by" style={{display: 'inline-flex', flexWrap: 'wrap', gap: '4px'}}>
{sorts.map((o, i) => (<Fragment key={i}>
<button type="button" className="segb" onClick={o.pick} aria-pressed={o.pressed} style={{cursor: 'pointer', font: 'inherit', fontSize: '13px', padding: '6px 12px', minHeight: '36px', borderRadius: '999px', background: 'transparent', border: `1px solid ${o.border}`, color: o.fg}}>{o.label}</button>
</Fragment>))}
</div>
</div>
</div>

<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '20px', overflowX: 'auto'}}>
<div style={{minWidth: '820px'}}>
<div style={{display: 'grid', gridTemplateColumns: '56px 2.2fr 1fr 0.8fr 1.1fr 1fr 1.1fr', gap: '14px', padding: '12px 18px', borderBottom: '1px solid #2E382A', fontSize: '13px', color: '#8E978A'}}>
<span>#</span><span>Employee</span><span>Rank</span><span style={{textAlign: 'right'}}>Score</span><span style={{textAlign: 'right'}}>Avg market cap</span><span style={{textAlign: 'right'}}>Volume</span><span style={{textAlign: 'right'}}>Payroll earned</span>
</div>
{rows.map((r, i) => (<Fragment key={i}>
<Link href={r.href} className="lrow rin" style={{textDecoration: 'none', color: '#E9EDE2', display: 'grid', gridTemplateColumns: '56px 2.2fr 1fr 0.8fr 1.1fr 1fr 1.1fr', gap: '14px', padding: '12px 18px', borderBottom: '1px solid #222A20', alignItems: 'center', background: r.bg, animationDelay: `${r.delay}s`}}>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '26px', color: r.numColor}}>{r.pos}</span>
<span style={{display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0'}}>
<svg width="34" height="34" viewBox="0 0 44 44" aria-hidden="true" style={{flex: 'none'}}><rect width="44" height="44" rx="11" fill={r.c1} /><circle cx="22" cy="17" r="8" fill={r.c2} /><rect x="9" y="28" width="26" height="16" rx="8" fill={r.c2} /></svg>
<span style={{minWidth: '0'}}><span style={{display: 'block', fontWeight: '600'}}>{r.name} <span style={{fontWeight: '400', color: '#8E978A', fontSize: '13px'}}>{r.you}</span></span><span style={{display: 'block', fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#C8F135'}}>{r.ticker}</span></span>
</span>
<span>{r.rank}</span>
<span style={{textAlign: 'right'}}>{r.score}</span>
<span style={{textAlign: 'right'}}>{r.mcap} ETH</span>
<span style={{textAlign: 'right'}}>{r.vol} ETH</span>
<span style={{textAlign: 'right', fontWeight: '600'}}>{r.pay} ETH</span>
</Link>
</Fragment>))}
</div>
</div>
<p style={{margin: '12px 0 0', fontSize: '13px', color: '#8E978A'}}>Ranked on time-weighted performance, never on token price alone. Flagged shifts are excluded.</p>
</main>
    </AppShell>
  );
}
