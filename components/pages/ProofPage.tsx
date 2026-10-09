"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ProofSkeleton } from "../Skeleton";
import AppShell from "../AppShell";
import { CHIP, EXPLORER, LIME, ago, explorerTx, mmss, ponsToken, short } from "@/lib/format";
import { ERRORS, post, useApi, useMe } from "@/lib/client";

const canonical = (v: any): string => {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
};
async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ProofPage() {
  const { me } = useMe();
  const { data } = useApi<any>(me ? `/api/proof?employeeId=${me.id}` : "/api/proof");
  const [selId, setSelId] = useState<number | null>(null);
  const [vstate, setVstate] = useState<{ id: number; s: "busy" | "ok" | "bad" } | null>(null);
  if (!data) return <AppShell active="proof" title="Public proof"><ProofSkeleton /></AppShell>;
  const list: any[] = data.events;
  const cur = list.find((e) => e.id === selId) || list.find((e) => e.type === "Shift Finalized" && e.you) || list.find((e) => e.type === "Shift Finalized") || list[0];
  const payday = "";
  const events = list.map((e) => ({
    type: e.type, who: e.who, block: e.block.toLocaleString("en-US"), tx: short(e.tx), youOpacity: e.you ? 1 : 0,
    bg: e.id === cur?.id ? "var(--raise-2)" : "transparent", shadow: e.id === cur?.id ? "inset 3px 0 0 var(--lime-ink)" : "none", pressed: e.id === cur?.id,
    cls: !e.final && e.id !== cur?.id ? "flash" : "", pick: () => { setSelId(e.id); setVstate(null); },
  }));
  const sel = cur ? { type: cur.type, contract: cur.contract, who: cur.who, block: cur.block.toLocaleString("en-US"), tx: cur.tx, resultHash: cur.resultHash || "" } : { type: "", contract: "", who: "", block: "", tx: "", resultHash: "" };
  const confs = cur ? (cur.final ? "Final" : `${cur.depth}/${data.confirmDepth} confirmations`) : "";
  const explorerHref = cur && explorerTx(cur.tx) ? explorerTx(cur.tx) : "#";
  const ponsHref = cur?.payload?.token && ponsToken(cur.payload.token) ? ponsToken(cur.payload.token) : "#";
  const P = cur?.pkg;
  const hasPkg = !!P, noPkg = !P;
  const pkg = P ? Object.keys(P).sort().map((k, i, a) => ({ k, v: typeof P[k] === "number" ? String(P[k]) : '"' + P[k] + '"', color: typeof P[k] === "number" ? "var(--lime-ink)" : "var(--paper-ink)", comma: i < a.length - 1 ? "," : "", delay: (i * 0.06).toFixed(2) })) : [];
  const vs = vstate && cur && vstate.id === cur.id ? vstate.s : null;
  const verify = {
    idle: { busy: false, ok: false, text: "Anyone can recompute this hash and compare it with the chain.", border: "var(--line)", fg: "var(--ink-dim)", bg: "transparent" },
    busy: { busy: true, ok: false, text: "Recomputing hash from the result package", border: "var(--line)", fg: "var(--ink)", bg: "transparent" },
    ok: { busy: false, ok: true, text: "Recomputed hash matches the ShiftFinalized event", border: "rgba(200,241,53,.5)", fg: "var(--lime-ink)", bg: "rgba(200,241,53,.06)" },
    bad: { busy: false, ok: false, text: "Hash mismatch. This result was altered.", border: "rgba(224,164,74,.6)", fg: "var(--amber-ink)", bg: "rgba(224,164,74,.06)" },
  }[vs || "idle"];
  const recompute = async () => {
    if (!cur?.pkg) return;
    setVstate({ id: cur.id, s: "busy" });
    const h = "0x" + (await sha256Hex(canonical(cur.pkg)));
    setTimeout(() => setVstate({ id: cur.id, s: h === cur.resultHash ? "ok" : "bad" }), 600);
  };
  return (
    <AppShell active="proof" title="Public proof">
<main className="vin" style={{padding: 'clamp(20px,3vw,36px)', maxWidth: '1800px', margin: '0 auto'}}>
<p style={{margin: '0 0 20px', color: 'var(--ink-dim)', maxWidth: '70ch'}}>Every important action links to its transaction. Pick an event to inspect it. Finalized shifts include a result package anyone can hash and compare with the chain.</p>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: '16px', alignItems: 'start'}}>
<section style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '20px', overflow: 'hidden'}}>
<div style={{padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: '10px'}}><h2 style={{margin: '0', fontSize: '16px', fontWeight: '600'}}>Onchain events</h2><span style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Newest first</span></div>
<div style={{maxHeight: 'calc(100vh - 230px)', minHeight: '420px', overflowY: 'auto'}}>
{events.map((e, i) => (<Fragment key={i}>
<button type="button" className={`ev ${e.cls}`} onClick={e.pick} aria-pressed={e.pressed} style={{width: '100%', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '14px', alignItems: 'center', textAlign: 'left', font: 'inherit', color: 'var(--ink)', border: '0', borderBottom: '1px solid var(--border)', padding: '14px 18px', minHeight: '62px', cursor: 'pointer', background: e.bg, boxShadow: e.shadow}}>
<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="var(--lime-ink)" strokeWidth="1.5" /><path d="M5.5 9.2l2.3 2.3 4.7-4.9" fill="none" stroke="var(--lime-ink)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
<span style={{minWidth: '0'}}><span style={{display: 'block', fontWeight: '500'}}>{e.type} <span style={{fontSize: '11px', fontWeight: '600', letterSpacing: '.04em', color: '#0F130E', background: '#C8F135', borderRadius: '999px', padding: '2px 7px', opacity: e.youOpacity}}>YOU</span></span><span style={{display: 'block', fontSize: '13px', color: 'var(--ink-dimmer)'}}>{e.who}, block {e.block}</span></span>
<span style={{fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: 'var(--ink-dimmer)'}}>{e.tx}</span>
</button>
</Fragment>))}
</div>
</section>

<div style={{display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '16px'}}>
<section style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '22px', padding: '24px'}}>
<div style={{fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: 'var(--ink-dimmer)'}}>{sel.contract}</div>
<h2 style={{margin: '2px 0 0', fontSize: '28px', fontWeight: '600', lineHeight: '1.2'}}>{sel.type}</h2>
<div style={{fontSize: '14px', color: 'var(--ink-dimmer)', marginTop: '4px'}}>{sel.who}, block {sel.block}</div>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginTop: '18px', fontSize: '13px', color: 'var(--ink-dimmer)'}}>
<div style={{background: 'var(--inset)', padding: '12px 14px'}}>Transaction<div style={{fontFamily: "'Geist Mono', monospace", color: 'var(--ink)', fontSize: '14px', wordBreak: 'break-all'}}>{sel.tx}</div></div>
<div style={{background: 'var(--inset)', padding: '12px 14px'}}>Confirmations<div style={{color: 'var(--ink)', fontSize: '15px'}}>{confs}</div></div>
<div style={{background: 'var(--inset)', padding: '12px 14px'}}>Emitted by<div style={{color: 'var(--ink)', fontSize: '15px'}}>{sel.contract}</div></div>
</div>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '18px'}}>
<a href={explorerHref} target="_blank" rel="noreferrer" className="btnl" style={{textDecoration: 'none', background: '#C8F135', color: '#0F130E', fontWeight: '600', fontSize: '14px', padding: '0 16px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', borderRadius: '999px'}}>View on Robinhood Chain Explorer ↗</a>
<a href={ponsHref} target="_blank" rel="noreferrer" className="btng" style={{textDecoration: 'none', color: 'var(--ink)', fontSize: '14px', padding: '0 16px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', border: '1px solid var(--line-strong)', borderRadius: '999px'}}>View on Pons ↗</a>
</div>
<p style={{margin: '14px 0 0', fontSize: '12px', color: 'var(--ink-faint)'}}>{EXPLORER ? '' : 'Simulated testnet: this transaction exists only in the SHIFT testnet ledger, so explorer links are disabled until a real explorer URL is configured.'}</p>
</section>

{hasPkg && (<>
<section style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '22px', padding: '24px'}}>
<div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '6px 12px', alignItems: 'baseline'}}><h2 style={{margin: '0', fontSize: '17px', fontWeight: '600'}}>Shift result package</h2><span style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Full snapshots stored offchain</span></div>
<div style={{background: 'var(--code-bg)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px 18px', fontFamily: "'Geist Mono', monospace", fontSize: '13px', lineHeight: '1.8', color: 'var(--ink-soft)', overflowX: 'auto', marginTop: '12px', whiteSpace: 'pre'}}>
<div>{"{"}</div>
{pkg.map((p, i) => (<Fragment key={i}><div className="typ" style={{animationDelay: `${p.delay}s`}}>  <span style={{color: 'var(--ink-dimmer)'}}>"{p.k}"</span>: <span style={{color: p.color}}>{p.v}</span>{p.comma}</div></Fragment>))}
<div>{"}"}</div>
</div>
<div style={{background: 'var(--inset)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', marginTop: '12px', fontSize: '13px', color: 'var(--ink-dimmer)'}}>Result hash stored onchain<div style={{fontFamily: "'Geist Mono', monospace", color: 'var(--ink)', fontSize: '14px', wordBreak: 'break-all'}}>{sel.resultHash}</div></div>
<div className="tr" style={{display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', padding: '12px 14px', borderRadius: '12px', marginTop: '12px', border: `1px solid ${verify.border}`, color: verify.fg, background: verify.bg}}>
{verify.busy && (<><span className="spin" style={{width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--lime-ink)', borderTopColor: 'transparent', flex: 'none'}} /></>)}
{verify.ok && (<><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{flex: 'none'}}><circle cx="9" cy="9" r="8" fill="none" stroke="var(--lime-ink)" strokeWidth="1.5" /><path d="M5.5 9.2l2.3 2.3 4.7-4.9" fill="none" stroke="var(--lime-ink)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></>)}
<span>{verify.text}</span>
</div>
<button type="button" className="btng" onClick={recompute} style={{marginTop: '12px', background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: '14px', padding: '0 16px', minHeight: '44px', border: '1px solid var(--line-strong)', borderRadius: '999px', cursor: 'pointer'}}>Recompute hash</button>
</section>
</>)}
{noPkg && (<>
<div style={{border: '1px dashed var(--line-strong)', borderRadius: '22px', padding: '24px', color: 'var(--ink-dim)', fontSize: '15px'}}>Select a Shift Finalized event to see its reproducible result package and check the hash yourself.</div>
</>)}
</div>
</div>
</main>
    </AppShell>
  );
}
