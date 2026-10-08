"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ClockInSkeleton } from "../Skeleton";
import AppShell from "../AppShell";
import { CHIP, EXPLORER, LIME, ago, explorerTx, mmss, ponsToken, short } from "@/lib/format";
import { errorText, post, useApi, useMe } from "@/lib/client";
import { CHAIN, hasWallet as detectWallet } from "@/lib/wallet";

const LABELS = ["Confirm in your wallet", "Submitting launch to Pons", "Waiting for confirmations", "Token live on Pons"];
const STEPS = ["Connect wallet", "Get hired", "Launch on Pons", "Start shift"];
const SCRAMBLE = "ABCDEFGHJKLMNPRSTUVWXYZabcdefghkmnoprstuvwxyz";


const card = { background: "#151A13", border: "1px solid #263023", borderRadius: 22 } as const;
const label = { fontSize: 13, color: "#8E978A" } as const;

function Spark({ v, color, max }: { v: number[]; color: string; max: number }) {
  const W = 420, H = 110;
  const pts = (v.length > 1 ? v : [0, v[0] || 0]).map((x, i, a) => `${((i / Math.max(1, a.length - 1)) * W).toFixed(1)},${(H - 8 - (x / max) * (H - 20)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(",");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Live trend">
      <line x1="0" x2={W} y1={H - 8} y2={H - 8} stroke="#222A20" />
      <polygon points={`0,${H - 8} ${pts.join(" ")} ${last[0]},${H - 8}`} fill={color} opacity=".09" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="5" fill={color} />
    </svg>
  );
}

function OnTheClock({ emp, me, deskHref, reset, secsToEpoch }: any) {
  const sh = emp?.shift;
  if (!sh) return <section className="vin" style={{ ...card, padding: 32, color: "#AEB7A8" }}>Starting your shift…</section>;
  const el: number = sh.elapsed;
  const done = sh.done || sh.status === "COMPLETED" || sh.status === "INVALID";
  const finalizing = sh.status === "FINALIZING";
  const perf: number[] = sh.perf, mc: number[] = sh.mcap;
  const feed = perf.slice(1).map((s, i) => ({ n: i + 1, t: (i + 1) * 20, score: s, cap: mc[i + 1] })).reverse().slice(0, 5);
  const res = emp.result && emp.result.fresh ? emp.result : null;
  const receipts = (emp.proofs || []).filter((e: any) => ["Employee Created", "Token Launched", "Shift Started"].includes(e.type)).slice(0, 3);
  const state = sh.status === "INVALID" ? "Shift flagged and excluded" : done ? "Shift complete" : finalizing ? "Closing the books" : el < 20 ? "Clocked in, first snapshot soon" : "Shift in progress";
  const kpi: [string, string, string?][] = [
    ["Live score", sh.score.toFixed(1), LIME],
    ["Projected rank", sh.projectedRank],
    ["Estimated pay", sh.payEth.toFixed(3) + " ETH"],
    ["Market cap", (mc[mc.length - 1] || 0).toFixed(1) + " ETH"],
    ["Volume", sh.volume.toFixed(1) + " ETH"],
    ["Participants", String(sh.holders)],
  ];
  return (
    <section className="vin" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 16, alignItems: "start" }}>
      <div style={{ ...card, padding: "clamp(22px,3vw,36px)", position: "relative", overflow: "hidden" }}>
        {!done && <div className="scan" aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: "30%", background: "linear-gradient(rgba(200,241,53,0), rgba(200,241,53,.08), rgba(200,241,53,0))", pointerEvents: "none" }} />}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="stamp0" style={{ display: "inline-block", border: "2px solid #C8F135", color: "#C8F135", borderRadius: 10, padding: "4px 14px", fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: 900, fontSize: 26, letterSpacing: "0.06em", transform: "rotate(-2deg)" }}>{done ? "SHIFT CLOSED" : "CLOCKED IN"}</div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "#AEB7A8" }}>
            {!done && <span className="live" style={{ width: 8, height: 8, borderRadius: "50%", background: LIME, display: "inline-block" }} />}
            {state}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
          <svg width="52" height="52" viewBox="0 0 44 44" aria-hidden="true" style={{ flex: "none" }}><rect width="44" height="44" rx="11" fill={me?.c1} /><circle cx="22" cy="17" r="8" fill={me?.c2} /><rect x="9" y="28" width="26" height="16" rx="8" fill={me?.c2} /></svg>
          <div><div style={{ fontWeight: 600, fontSize: 20, lineHeight: 1.2 }}>{me?.name}</div><div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: LIME }}>{me?.ticker} <span style={{ color: "#8E978A" }}>live on Pons · {short(me?.token)}</span></div></div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: 900, fontSize: "clamp(84px,9vw,124px)", lineHeight: 0.88 }}>{mmss(el)}</div>
          <div style={{ paddingBottom: 6, color: "#8E978A", fontSize: 14 }}>of 05:00<br />{mmss(sh.left)} left</div>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "#232B20", marginTop: 18, overflow: "hidden" }}><div className="tr" style={{ height: "100%", width: `${(el / 300) * 100}%`, background: LIME }} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(15, minmax(0, 1fr))", gap: 4, marginTop: 10 }} aria-label={`${sh.snaps} of 15 snapshots recorded`}>
          {Array.from({ length: 15 }, (_, i) => (<span key={i} className="tr" style={{ height: 26, borderRadius: 5, background: i < sh.snaps ? LIME : "#232B20", transform: i + 1 === sh.snaps && !done ? "scaleY(1.25)" : "none" }} />))}
        </div>
        <div style={{ ...label, marginTop: 6 }}>{sh.snaps} / 15 snapshots, one every 20 seconds{sh.missing ? ` · ${sh.missing} missed` : ""}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 1, background: "#222A20", border: "1px solid #222A20", borderRadius: 14, overflow: "hidden", marginTop: 22 }}>
          {kpi.map(([k, v, c]) => (<div key={k} style={{ background: "#121710", padding: "12px 14px", ...label }}>{k}<div style={{ color: c || "#E9EDE2", fontSize: 21, fontWeight: 600 }}>{v}</div></div>))}
        </div>
        {done && res && (
          <div className="stamp0" style={{ marginTop: 18, border: `2px solid ${res.promoted ? LIME : "#3A4436"}`, borderRadius: 14, padding: "12px 18px", background: res.promoted ? "rgba(200,241,53,.08)" : "transparent" }}>
            <div style={{ fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: 900, fontSize: 30, color: res.promoted ? LIME : "#E9EDE2", letterSpacing: "0.04em" }}>{res.promoted ? `PROMOTED · ${res.from} → ${res.to}`.toUpperCase() : `RANK ${res.to}`.toUpperCase()}</div>
            <div style={{ color: "#AEB7A8", fontSize: 14 }}>Performance score {res.score.toFixed(1)}. Payroll lands at the next payday{secsToEpoch != null ? ` in ${mmss(secsToEpoch)}` : ""}.</div>
          </div>
        )}
        {done && sh.status === "INVALID" && <p style={{ color: "#E0A44A", marginTop: 14 }}>{sh.invalidReason}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
          <Link href={deskHref} className="btnl" style={{ textDecoration: "none", background: "#C8F135", color: "#0F130E", fontWeight: 600, fontSize: 16, padding: "0 24px", minHeight: 52, display: "inline-flex", alignItems: "center", borderRadius: 999 }}>Go to my desk</Link>
          <Link href="/office" className="btng" style={{ textDecoration: "none", color: "#E9EDE2", fontSize: 16, padding: "0 22px", minHeight: 52, display: "inline-flex", alignItems: "center", border: "1px solid #3A4436", borderRadius: 999 }}>See the office</Link>
          {done && <Link href="/payroll" className="btng" style={{ textDecoration: "none", color: "#E9EDE2", fontSize: 16, padding: "0 22px", minHeight: 52, display: "inline-flex", alignItems: "center", border: "1px solid #3A4436", borderRadius: 999 }}>Go to payday</Link>}
        </div>
        <button type="button" onClick={reset} style={{ marginTop: 18, background: "none", border: 0, padding: 0, color: "#8E978A", font: "inherit", fontSize: 13, textDecoration: "underline", cursor: "pointer", minHeight: 44 }}>Disconnect testnet wallet</button>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <figure style={{ ...card, margin: 0, padding: "18px 20px 10px" }}>
          <figcaption style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={label}>Performance score</span><span style={{ fontSize: 22, fontWeight: 600, color: LIME }}>{sh.score.toFixed(1)}</span></figcaption>
          <Spark v={perf} color={LIME} max={Math.max(50, Math.ceil(Math.max(...perf) / 10) * 10)} />
        </figure>
        <figure style={{ ...card, margin: 0, padding: "18px 20px 10px" }}>
          <figcaption style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={label}>Market cap</span><span style={{ fontSize: 22, fontWeight: 600 }}>{(mc[mc.length - 1] || 0).toFixed(1)} ETH</span></figcaption>
          <Spark v={mc} color="#E4E7DA" max={Math.max(22, Math.max(...mc) * 1.15)} />
        </figure>
        <div style={{ ...card, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontWeight: 600 }}>Live feed</span><span style={label}>Latest snapshots</span></div>
          {feed.length === 0 && <p style={{ margin: "10px 0 0", color: "#8E978A", fontSize: 14 }}>Waiting for the first snapshot at 00:20.</p>}
          {feed.map((f, i) => (
            <div key={f.n} className={i === 0 ? "flash" : undefined} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10, padding: "9px 0", borderTop: "1px solid #222A20", fontSize: 14, marginTop: i === 0 ? 10 : 0 }}>
              <span>Snapshot {f.n} <span style={{ color: "#6E776A" }}>{mmss(f.t)}</span></span>
              <span style={{ textAlign: "right", color: LIME }}>score {f.score.toFixed(1)}</span>
              <span style={{ textAlign: "right", color: "#AEB7A8" }}>{f.cap.toFixed(1)} ETH</span>
            </div>
          ))}
        </div>
        <div style={{ ...card, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontWeight: 600 }}>Onchain receipts</span><Link href="/proof" style={{ fontSize: 14 }}>View proof ↗</Link></div>
          {receipts.map((e: any, i: number) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: "1px solid #222A20", fontSize: 14, marginTop: i === 0 ? 10 : 0 }}>
              <span>{e.type}</span><span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: e.final ? "#8E978A" : "#E0A44A" }}>{short(e.tx)}{e.final ? "" : ` · ${e.depth}/3`}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ClockInPage() {
  const { wallet, connect, disconnect, me, launch: lj, loaded, signingIn, reload, secsToEpoch } = useMe(500);
  const [accepted, setAccepted] = useState(false);
  const [err, setErr] = useState("");
  const [k, setK] = useState(0);
  const [walletPresent, setWalletPresent] = useState(true);


  const launching = !!lj && !lj.done;
  const live = me?.launchStatus === "LIVE";
  const step = !wallet ? 1 : !me ? 2 : live ? 4 : launching || accepted || lj?.reverted || me.launchStatus === "REVERTED" ? 3 : 2;
  useEffect(() => {
    if (step !== 2) return;
    setK(0);
    const id = setInterval(() => setK((x) => (x < 14 ? x + 1 : x)), 90);
    return () => clearInterval(id);
  }, [step, me?.id]);
  const { data: emp } = useApi<any>(step === 4 && me ? `/api/employee/${me.id}` : null);

  const steps = STEPS.map((label, i) => {
    const n = i + 1;
    return { n, label, bar: n <= step ? LIME : "#2E382A", fg: n === step ? "#E9EDE2" : n < step ? "#AEB7A8" : "#6E776A", weight: n === step ? 600 : 400 };
  });
  const target = me?.name || "";
  const name = step === 2 && k < 10 ? target.split("").map((c: string, i: number) => (c === " " ? " " : i < k * 1.4 ? c : SCRAMBLE[(i * 7 + k * 13) % SCRAMBLE.length])).join("") : target;
  const st = lj ? lj.step : -1;
  const doneOk = !!lj && lj.done && !lj.reverted;
  const launchSteps = LABELS.map((label, i) => {
    const ok = doneOk || (!!lj && i < st);
    const cur = !ok && !!lj && !lj.done && i === st;
    return {
      label: label + (i === 2 && lj && lj.confirmations > 0 && !lj.done ? ` (${lj.confirmations}/3)` : ""), ok, cur, idle: !ok && !cur,
      border: cur ? "rgba(200,241,53,.5)" : "#222A20", bg: cur ? "rgba(200,241,53,.05)" : "transparent", fg: cur ? "#E9EDE2" : ok ? "#AEB7A8" : "#8E978A",
    };
  });
  const booting = !loaded;
  const s1 = step === 1 && !booting, s2 = step === 2 && !booting, s3 = step === 3 && !booting, s4 = step === 4 && !booting;
  const connected = !!wallet;
  const showList = !!lj;
  const launchLabel = launching ? "Launching" : lj?.reverted ? "Try again" : "Launch on Pons";
  const launchBg = launching ? "#5F685B" : LIME, launchCursor = launching ? "not-allowed" : "pointer";
  const shift = emp?.shift;
  const timer = mmss(shift?.elapsed ?? 0), snaps = shift?.snaps ?? 0;
  const run = async (fn: () => Promise<any>) => {
    setErr("");
    try { await fn(); await reload(); } catch (e: unknown) { setErr(errorText(e)); }
  };
  const doConnect = () => run(connect);
  const accept = () => setAccepted(true);
  const doLaunch = () => { if (!launching && me) run(() => post("/api/launch", { employeeId: me.id, wallet })); };
  const reset = () => { void disconnect(); setAccepted(false); };
  const launchError = lj?.reverted ? lj.error : "";
  const deskHref = me ? `/employee/${me.id}` : "/office";
  useEffect(() => setWalletPresent(detectWallet()), []);
  
  return (
    <div className="sh" style={{ background: "#0F130E", color: "#E9EDE2", fontFamily: "'Geist', 'Helvetica Neue', Helvetica, sans-serif", fontSize: 17, lineHeight: 1.55, minHeight: "100vh", fontVariantNumeric: "tabular-nums" }}>
      <header style={{ borderBottom: "1px solid #222A20" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "14px clamp(20px,4vw,48px)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 24px" }}>
          <Link href="/" style={{ textDecoration: "none", color: "#E9EDE2", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "#C8F135", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="#0F130E" strokeWidth="2" /><path d="M8 4.5V8l2.4 1.6" fill="none" stroke="#0F130E" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
            <span style={{ fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "0.04em" }}>SHIFT</span>
          </Link>
          <span style={{ flex: 1 }} />
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#AEB7A8" }}><span className="live" style={{ width: 8, height: 8, borderRadius: "50%", background: "#C8F135", display: "inline-block" }} />Shift active</span>
          {connected && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #2E382A", borderRadius: 999, padding: "8px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C8F135", display: "inline-block" }} />{short(wallet)}
            </span>
          )}
          <Link href="/office" style={{ color: "#AEB7A8", fontSize: 14, textDecoration: "none" }}>Skip to the office</Link>
        </div>
      </header>
<main style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(20px,4vw,48px) 80px'}}>
{booting ? <ClockInSkeleton /> : <ol style={{listStyle: 'none', margin: '0 0 32px', padding: '0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', maxWidth: step === 4 ? 'none' : '880px', marginLeft: 'auto', marginRight: 'auto'}}>
{steps.map((s, i) => (<Fragment key={i}>
<li className="tr" style={{borderTop: `3px solid ${s.bar}`, paddingTop: '10px', fontSize: '14px', color: s.fg, fontWeight: s.weight}}>{s.n}. {s.label}</li>
</Fragment>))}
</ol>}

{s1 && (<>
<section className="vin" style={{background: '#151A13', border: '1px solid #263023', borderRadius: '26px', padding: 'clamp(24px,4vw,48px)', maxWidth: '880px', marginLeft: 'auto', marginRight: 'auto'}}>
<h1 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(44px,5vw,68px)', lineHeight: '0.95'}}>Connect your wallet</h1>
<p style={{margin: '12px 0 0', color: '#AEB7A8', maxWidth: '52ch'}}>SHIFT runs on {CHAIN.name}. Your wallet becomes your employee record, so connect the one you want paid.</p>
{walletPresent ? (<>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '28px'}}>
<button type="button" className="wopt" onClick={doConnect} disabled={signingIn} style={{display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', borderRadius: '16px', border: '1px solid #2E382A', background: '#121710', cursor: signingIn ? 'progress' : 'pointer', textAlign: 'left', minHeight: '72px', font: 'inherit', color: 'inherit'}}>
<span style={{width: '40px', height: '40px', borderRadius: '10px', background: '#232B20', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}>
{signingIn
  ? <span className="spin" style={{width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #C8F135', borderTopColor: 'transparent'}} />
  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8F135" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12.5h2" /></svg>}
</span>
<span><span style={{display: 'block', fontWeight: '600'}}>{signingIn ? 'Check your wallet' : 'Browser wallet'}</span><span style={{display: 'block', color: '#8E978A', fontSize: '14px'}}>{signingIn ? 'Approve the connection, then sign to prove you own it' : 'Any injected EVM wallet'}</span></span>
</button>
</div>
<p style={{margin: '18px 0 0', color: '#8E978A', fontSize: '13px'}}>You sign one message to prove the address is yours. It costs no gas and approves no transaction.{CHAIN.id ? ` Your wallet will be asked to switch to ${CHAIN.name}.` : ''}</p>
</>) : (<>
<div style={{marginTop: '28px', border: '1px dashed #3A4436', borderRadius: '16px', padding: '22px'}}>
<div style={{fontWeight: '600'}}>No EVM wallet in this browser</div>
<p style={{margin: '6px 0 0', color: '#8E978A', fontSize: '14px', maxWidth: '52ch'}}>Install a browser wallet such as MetaMask or Rabby, then reload this page. You can still look around the office without one.</p>
<Link href="/office" className="btng" style={{textDecoration: 'none', color: '#E9EDE2', fontSize: '15px', padding: '0 20px', minHeight: '48px', marginTop: '16px', display: 'inline-flex', alignItems: 'center', border: '1px solid #3A4436', borderRadius: '999px'}}>See the office</Link>
</div>
</>)}
</section>
</>)}

{s2 && (<>
<section className="vin" style={{background: '#151A13', border: '1px solid #263023', borderRadius: '26px', padding: 'clamp(24px,4vw,48px)', maxWidth: '880px', marginLeft: 'auto', marginRight: 'auto'}}>
<h1 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(44px,5vw,68px)', lineHeight: '0.95'}}>You're hired</h1>
<p style={{margin: '12px 0 0', color: '#AEB7A8', maxWidth: '52ch'}}>SHIFT generated your employee identity from your wallet. It's permanent and will never be silently regenerated.</p>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '32px', marginTop: '30px', alignItems: 'center'}}>
<div className="bin" style={{background: '#1D231B', border: '1px solid #39442F', borderRadius: '18px', padding: '18px', maxWidth: '320px', boxShadow: '0 30px 70px rgba(0,0,0,.5)'}}>
<div style={{width: '46px', height: '8px', borderRadius: '4px', background: '#0F130E', margin: '0 auto 16px'}} />
<div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
<svg width="56" height="56" viewBox="0 0 44 44" aria-hidden="true"><rect width="44" height="44" rx="11" fill="#E4E7DA" /><circle cx="22" cy="17" r="8" fill="#0F130E" /><rect x="9" y="28" width="26" height="16" rx="8" fill="#0F130E" /><rect x="18" y="15" width="3" height="3" fill="#E4E7DA" /><rect x="24" y="15" width="3" height="3" fill="#E4E7DA" /></svg>
<div><div style={{fontWeight: '600', fontSize: '18px'}}>{name}</div><div style={{fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: '#C8F135'}}>{me?.ticker}</div></div>
</div>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginTop: '16px', fontSize: '12px', color: '#8E978A'}}>
<div>Employee<div style={{color: '#E9EDE2', fontSize: '14px'}}>{me?.code}</div></div>
<div>Department<div style={{color: '#E9EDE2', fontSize: '14px'}}>{me?.dept}</div></div>
<div>Starting rank<div style={{color: '#E9EDE2', fontSize: '14px'}}>{me?.rank}</div></div>
<div>Badge<div style={{color: '#E9EDE2', fontSize: '14px'}}>{me?.badge}</div></div>
</div>
</div>
<div>
<div style={{fontSize: '13px', color: '#8E978A'}}>Display name</div>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: 'clamp(48px,5vw,68px)', lineHeight: '1'}}>{name}</div>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1px', background: '#222A20', border: '1px solid #222A20', borderRadius: '14px', overflow: 'hidden', marginTop: '20px', fontSize: '13px', color: '#8E978A'}}>
<div style={{background: '#121710', padding: '12px 14px'}}>Ticker<div style={{fontFamily: "'Geist Mono', monospace", color: '#E9EDE2', fontSize: '16px'}}>{me?.ticker}</div></div>
<div style={{background: '#121710', padding: '12px 14px'}}>Employee ID<div style={{color: '#E9EDE2', fontSize: '16px'}}>{me?.code}</div></div>
<div style={{background: '#121710', padding: '12px 14px'}}>Wallet<div style={{fontFamily: "'Geist Mono', monospace", color: '#E9EDE2', fontSize: '14px'}}>{short(wallet)}</div></div>
</div>
</div>
</div>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '30px'}}>
<button type="button" className="btnl" onClick={accept} style={{border: '0', cursor: 'pointer', background: '#C8F135', color: '#0F130E', font: 'inherit', fontWeight: '600', fontSize: '16px', padding: '0 24px', minHeight: '52px', borderRadius: '999px'}}>Accept and continue</button>
<Link href="/office" className="btng" style={{textDecoration: 'none', color: '#E9EDE2', fontSize: '16px', padding: '0 22px', minHeight: '52px', display: 'inline-flex', alignItems: 'center', border: '1px solid #3A4436', borderRadius: '999px'}}>Look around first</Link>
</div>
</section>
</>)}

{s3 && (<>
<section className="vin" style={{background: '#151A13', border: '1px solid #263023', borderRadius: '26px', padding: 'clamp(24px,4vw,48px)', maxWidth: '880px', marginLeft: 'auto', marginRight: 'auto'}}>
<h1 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(44px,5vw,68px)', lineHeight: '0.95'}}>Launch your employee token</h1>
<p style={{margin: '12px 0 0', color: '#AEB7A8', maxWidth: '52ch'}}>Your token launches through Pons, the market layer. SHIFT links it to your employee record and starts your shift once the launch is confirmed.</p>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: '#222A20', border: '1px solid #222A20', borderRadius: '16px', overflow: 'hidden', marginTop: '26px', fontSize: '13px', color: '#8E978A'}}>
<div style={{background: '#121710', padding: '14px 16px'}}>Token<div style={{color: '#E9EDE2', fontSize: '16px'}}>{me?.name}</div></div>
<div style={{background: '#121710', padding: '14px 16px'}}>Ticker<div style={{fontFamily: "'Geist Mono', monospace", color: '#E9EDE2', fontSize: '16px'}}>{me?.ticker}</div></div>
<div style={{background: '#121710', padding: '14px 16px'}}>Launch layer<div style={{color: '#E9EDE2', fontSize: '16px'}}>Pons</div></div>
<div style={{background: '#121710', padding: '14px 16px'}}>Network<div style={{color: '#E9EDE2', fontSize: '16px'}}>Robinhood Chain</div></div>
<div style={{background: '#121710', padding: '14px 16px'}}>Network fee<div style={{color: '#E9EDE2', fontSize: '16px'}}>Free on testnet</div></div>
</div>
{showList && (<>
<ul style={{listStyle: 'none', margin: '26px 0 0', padding: '0', display: 'flex', flexDirection: 'column', gap: '8px'}}>
{launchSteps.map((l, i) => (<Fragment key={i}>
<li className="tr" style={{display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '14px', border: `1px solid ${l.border}`, background: l.bg, color: l.fg}}>
{l.ok && (<><span style={{width: '22px', height: '22px', borderRadius: '50%', background: '#C8F135', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.2 2.2L9.5 3.6" fill="none" stroke="#0F130E" strokeWidth="2" strokeLinecap="round" /></svg></span></>)}
{l.cur && (<><span className="spin" style={{width: '22px', height: '22px', borderRadius: '50%', border: '2px solid #C8F135', borderTopColor: 'transparent', flex: 'none'}} /></>)}
{l.idle && (<><span style={{width: '22px', height: '22px', borderRadius: '50%', border: '2px solid #3A4436', flex: 'none'}} /></>)}
<span>{l.label}</span>
</li>
</Fragment>))}
</ul>
</>)}
<div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '26px'}}>
<button type="button" className="btnl" onClick={doLaunch} disabled={launching} style={{border: '0', cursor: launchCursor, background: launchBg, color: '#0F130E', font: 'inherit', fontWeight: '600', fontSize: '16px', padding: '0 24px', minHeight: '52px', borderRadius: '999px'}}>{launchLabel}</button>
</div>
<p style={{margin: '14px 0 0', color: '#8E978A', fontSize: '13px'}}>If the launch reverts, nothing is recorded and you can try again. Your identity stays the same.</p>
</section>
</>)}

{s4 && <OnTheClock emp={emp} me={me} deskHref={deskHref} reset={reset} secsToEpoch={secsToEpoch} />}
{(err || launchError) && <p role="alert" style={{margin: '18px auto 0', maxWidth: '880px', color: '#E0A44A', textAlign: 'center'}}>{err || launchError}</p>}
</main>
    </div>
  );
}
