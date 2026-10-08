"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { OfficeSkeleton } from "../Skeleton";
import AppShell from "../AppShell";
import { CHIP, EXPLORER, LIME, ago, explorerTx, mmss, ponsToken, short } from "@/lib/format";
import { ERRORS, post, useApi, useMe } from "@/lib/client";

const FILTERS = ["All", "Working", "Promoted", "Shift complete", "Paid"];

export default function OfficePage() {
  const [filter, setFilter] = useState("All");
  const { data } = useApi<any>("/api/office");
  const { me } = useMe();
  if (!data) return <AppShell active="office" title="Office"><OfficeSkeleton /></AppShell>;
  const all = data.desks.map((d: any) => {
    const c = CHIP[d.status];
    return {
      ...d, href: `/employee/${d.id}`, you: me && me.id === d.id ? "(you)" : d.test ? "(test)" : "", chipBg: c[0], chipFg: c[1], chipB: c[2],
      score: d.score.toFixed(1), mcap: d.mcap.toFixed(1), timer: mmss(d.secs), pay: d.pay.toFixed(3),
      snaps: Array.from({ length: 15 }, (_, i) => (i < d.snapsDone ? LIME : "#2A3127")),
      bg: me && me.id === d.id ? "#1A2117" : "#141912", border: me && me.id === d.id ? "rgba(200,241,53,.55)" : "#263023",
    };
  });
  const match = (d: any, f: string) => f === "All" || d.status === f.toUpperCase();
  const filters = FILTERS.map((f) => ({
    label: f, count: all.filter((d: any) => match(d, f)).length, bg: f === filter ? "#E9EDE2" : "transparent", fg: f === filter ? "#0F130E" : "#AEB7A8",
    weight: f === filter ? 600 : 400, pressed: f === filter, pick: () => setFilter(f),
  }));
  const desks = all.filter((d: any) => match(d, filter));
  const payday = mmss(data.payday);
  const { onShift, total, launches, epochId } = data;
  const poolEth = data.poolEth.toFixed(2);
  const hasDesks = desks.length > 0;
  const noDesks = !hasDesks;
  return (
    <AppShell active="office" title="Office">
<main className="vin" style={{padding: 'clamp(20px,3vw,36px)', maxWidth: '1800px', margin: '0 auto'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px'}}>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: '#8E978A'}}>On shift now</div><div style={{fontSize: '30px', fontWeight: '600', lineHeight: '1.3'}}>{onShift}</div><div style={{fontSize: '13px', color: '#8E978A'}}>of {total} employees</div></div>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: '#8E978A'}}>Active launches</div><div style={{fontSize: '30px', fontWeight: '600', lineHeight: '1.3'}}>{launches}</div><div style={{fontSize: '13px', color: '#8E978A'}}>Pons markets live</div></div>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: '#8E978A'}}>Next payday</div><div style={{fontSize: '30px', fontWeight: '600', lineHeight: '1.3', color: '#C8F135'}}>{payday}</div><div style={{fontSize: '13px', color: '#8E978A'}}>Epoch {epochId} closes</div></div>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: '#8E978A'}}>Payroll pool</div><div style={{fontSize: '30px', fontWeight: '600', lineHeight: '1.3'}}>{poolEth} ETH</div><div style={{fontSize: '13px', color: '#8E978A'}}>In PayrollVault</div></div>
</div>

<div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px 20px', margin: '36px 0 16px'}}>
<h2 style={{margin: '0', fontSize: '20px', fontWeight: '600'}}>Desks</h2>
<div role="group" aria-label="Filter desks" style={{display: 'inline-flex', flexWrap: 'wrap', gap: '4px', background: '#121710', border: '1px solid #222A20', borderRadius: '999px', padding: '4px'}}>
{filters.map((f, i) => (<Fragment key={i}>
<button type="button" className="segb" onClick={f.pick} aria-pressed={f.pressed} style={{border: '0', cursor: 'pointer', font: 'inherit', fontSize: '14px', padding: '8px 14px', minHeight: '36px', borderRadius: '999px', background: f.bg, color: f.fg, fontWeight: f.weight}}>{f.label} <span style={{opacity: '.6'}}>{f.count}</span></button>
</Fragment>))}
</div>
</div>

{hasDesks && (<>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px'}}>
{desks.map((e, i) => (<Fragment key={i}>
<Link href={e.href} className="desk" style={{textDecoration: 'none', color: '#E9EDE2', background: e.bg, border: `1px solid ${e.border}`, borderRadius: '18px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '212px'}}>
<span style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" style={{flex: 'none'}}><rect width="44" height="44" rx="11" fill={e.c1} /><circle cx="22" cy="17" r="8" fill={e.c2} /><rect x="9" y="28" width="26" height="16" rx="8" fill={e.c2} /></svg>
<span style={{flex: '1', minWidth: '0'}}><span style={{display: 'block', fontWeight: '600', lineHeight: '1.25'}}>{e.name} <span style={{fontWeight: '400', fontSize: '13px', color: '#8E978A'}}>{e.you}</span></span><span style={{display: 'block', fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#C8F135'}}>{e.ticker}</span></span>
<span className="tr" style={{fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em', padding: '5px 9px', borderRadius: '999px', whiteSpace: 'nowrap', background: e.chipBg, color: e.chipFg, border: `1px solid ${e.chipB}`}}>{e.status}</span>
</span>
<span style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 14px', fontSize: '12px', color: '#8E978A'}}>
<span>Rank<span style={{display: 'block', color: '#E9EDE2', fontSize: '15px'}}>{e.rank}</span></span>
<span>Score<span style={{display: 'block', color: '#E9EDE2', fontSize: '15px'}}>{e.score}</span></span>
<span>Market cap<span style={{display: 'block', color: '#E9EDE2', fontSize: '15px'}}>{e.mcap} ETH</span></span>
<span>Shift timer<span style={{display: 'block', color: '#E9EDE2', fontSize: '15px'}}>{e.timer}</span></span>
</span>
<span style={{display: 'flex', gap: '3px'}} aria-hidden="true">
{e.snaps.map((p, i) => (<Fragment key={i}><span className="tr" style={{flex: '1', height: '4px', borderRadius: '2px', background: p}} /></Fragment>))}
</span>
<span style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #263023', paddingTop: '12px', fontSize: '13px', color: '#8E978A'}}><span>Payroll earned</span><span style={{color: '#E9EDE2', fontWeight: '600'}}>{e.pay} ETH</span></span>
</Link>
</Fragment>))}
</div>
</>)}
{noDesks && (<>
<div style={{border: '1px dashed #3A4436', borderRadius: '20px', padding: '40px', textAlign: 'center', color: '#AEB7A8'}}>
<div style={{color: '#E9EDE2', fontSize: '20px', fontWeight: '600'}}>No desks in this status right now</div>
<div style={{marginTop: '6px'}}>Statuses change through the shift. Check back in a few seconds or show all desks.</div>
</div>
</>)}
</main>
    </AppShell>
  );
}
