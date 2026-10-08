"use client";

import { Fragment, useEffect, useState } from "react";

const mmss = (sec: number) => {
  sec = Math.max(0, Math.floor(sec));
  return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
};

const RANKS: [string, number][] = [["Intern", 0], ["Analyst", 15], ["Associate", 30], ["Manager", 45], ["VP", 60], ["Director", 75], ["C-Suite", 88], ["CEO", 96]];
const rankOf = (s: number) => {
  let r = "Intern";
  for (const [name, min] of RANKS) if (s >= min) r = name;
  return r;
};

const LIME = "#C8F135";

const EMP = [
  { id: "EMP-0247", name: "Mara Voss", ticker: "$VOSS", dept: "Trading", score: 53.4, mcap: 48.2, pay: 0.214, c1: "#C8F135", c2: "#0F130E" },
  { id: "EMP-0251", name: "Ilya Brandt", ticker: "$BRNDT", dept: "Research", score: 36.8, mcap: 31.7, pay: 0.118, c1: "#2C3A28", c2: "#C8F135" },
  { id: "EMP-0262", name: "Noor Kase", ticker: "$KASE", dept: "Engineering", score: 62.4, mcap: 66.9, pay: 0.402, c1: "#E4E7DA", c2: "#1D231B" },
  { id: "EMP-0270", name: "Tomas Reyl", ticker: "$REYL", dept: "Operations", score: 9.8, mcap: 7.4, pay: 0.012, c1: "#3A4436", c2: "#E4E7DA" },
  { id: "EMP-0283", name: "Ada Okonji", ticker: "$OKO", dept: "Growth", score: 77.1, mcap: 92.3, pay: 0.655, c1: "#0F130E", c2: "#C8F135" },
  { id: "EMP-0291", name: "Sven Hale", ticker: "$HALE", dept: "Risk", score: 18.2, mcap: 12.6, pay: 0.031, c1: "#8FA34A", c2: "#0F130E" },
  { id: "EMP-0304", name: "Lio Marchetti", ticker: "$LIO", dept: "Trading", score: 33.5, mcap: 28.1, pay: 0.097, c1: "#E0A44A", c2: "#1D231B" },
  { id: "EMP-0312", name: "Rhea Duval", ticker: "$DUVL", dept: "Research", score: 47.9, mcap: 41.5, pay: 0.188, c1: "#1D231B", c2: "#E4E7DA" },
];

const CHIP: Record<string, { bg: string; fg: string; b: string }> = {
  "CLOCKED IN": { bg: "transparent", fg: "#C9D0C2", b: "#4A5446" },
  WORKING: { bg: "rgba(200,241,53,0.12)", fg: LIME, b: "rgba(200,241,53,0.35)" },
  PROMOTED: { bg: LIME, fg: "#0F130E", b: LIME },
  "SHIFT COMPLETE": { bg: "#2A3127", fg: "#E9EDE2", b: "#3A4436" },
  PAID: { bg: "#E4E7DA", fg: "#0F130E", b: "#E4E7DA" },
};

const WEIGHTS = [
  { label: "Average market cap", pct: 40, color: LIME },
  { label: "Volume", pct: 25, color: "#A9C64A" },
  { label: "Holders and unique traders", pct: 15, color: "#8AA23E" },
  { label: "Liquidity", pct: 10, color: "#6E8233" },
  { label: "Retention and stability", pct: 10, color: "#56662B" },
].map((w) => ({ ...w, width: (w.pct * 2.5).toFixed(1) }));

const FLAGS = ["Same-wallet self trading", "Circular trading", "Wash volume", "Short price spikes", "Liquidity in, then out", "Detectable sybil wallets", "Failed or reverted trades", "Duplicate indexed events"];

const SCORES = [0, 8.2, 14.6, 19.1, 24.8, 28.3, 33.0, 36.4, 39.9, 42.7, 45.1, 47.6, 49.8, 51.2, 52.6, 53.4];
const STAGE_NAMES = ["Estimated", "Finalized", "Claimable", "Paid"];
const FLOW = [["Revenue", "Pons fees"], ["PayrollVault", "contract"], ["Payroll epoch finalized", "epoch"], ["Merkle root published", "onchain"], ["Employee claims", "proof"], ["Wallet receives payroll", "wallet"]];
const PROOFS = [["Employee Created", "EmployeeRegistry"], ["Token Launched", "PonsAdapter"], ["Shift Started", "ShiftManager"], ["Shift Finalized", "ShiftManager"], ["Rank Assigned", "RankManager"], ["Payroll Funded", "PayrollVault"], ["Payroll Epoch Finalized", "PayrollDistributor"], ["Payroll Claimed", "PayrollDistributor"]];
const TICKER_SRC: [string, string][] = [
  ["EMP-0247 clocked in", LIME], ["$KASE launched on Pons", "#E4E7DA"], ["Ada Okonji promoted to Director", LIME],
  ["Shift finalized, result hash stored", "#8E978A"], ["$VOSS snapshot recorded", "#8E978A"], ["Payroll epoch finalized", "#E4E7DA"],
  ["Rhea Duval claimed payroll", LIME], ["EMP-0312 started a shift", "#8E978A"], ["$OKO volume up this shift", "#E4E7DA"], ["Merkle root published", "#8E978A"],
];

export default function Shift() {
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  const [claimedAt, setClaimedAt] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date(now ?? 0);
  const clock = now === null ? "--:--:--" : pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());

  const payday = mmss(222 - (tick % 223));

  const phase = tick % 20;
  const snap = Math.min(phase, 15);
  const shift = {
    snap: pad(snap),
    elapsed: mmss(snap * 20),
    score: SCORES[snap].toFixed(1),
    rank: rankOf(SCORES[snap]),
    pct: ((snap / 15) * 100).toFixed(2),
    dots: Array.from({ length: 15 }, (_, k) => ({ left: (((k + 1) / 15) * 100).toFixed(3), bg: k + 1 <= snap ? LIME : "#323B2E" })),
    done: phase >= 15,
    running: phase < 15,
  };
  const badgeRank = shift.rank;

  const punches = Array.from({ length: 15 }, (_, i) => ({ bg: i < 4 + (tick % 12) ? "#161A14" : "#C3C7B7" }));

  const desks = EMP.map((e, off) => {
    const seq = ["CLOCKED IN", "WORKING", "WORKING", "WORKING", off % 2 ? "PROMOTED" : "SHIFT COMPLETE", "PAID"];
    const status = seq[Math.floor((tick + off * 4) / 4) % 6];
    const sc = e.score + 0.4 * Math.sin((tick + off * 2) / 3);
    const rank = rankOf(sc);
    const ri = RANKS.findIndex((r) => r[0] === rank);
    const chip = CHIP[status];
    const sel = off === selected;
    return {
      name: e.name, ticker: e.ticker, c1: e.c1, c2: e.c2,
      status, chipBg: chip.bg, chipFg: chip.fg, chipBorder: chip.b,
      rank,
      score: sc.toFixed(1),
      mcap: (e.mcap * (1 + 0.025 * Math.sin((tick + off) / 2))).toFixed(1),
      timer: mmss(((tick + off * 9) * 10) % 300),
      pay: (e.pay + tick * 0.0006 * (ri + 1)).toFixed(3),
      bg: sel ? "#1A2117" : "#141912",
      border: sel ? LIME : "#263023",
      pressed: sel,
      pick: () => setSelected(off),
    };
  });
  const se = EMP[selected];
  const sel = { name: se.name, ticker: se.ticker, id: se.id, dept: se.dept, rank: desks[selected].rank };

  const weights = WEIGHTS;
  const flags = FLAGS;

  const climb = Math.min(Math.floor(tick / 2) % 11, 7);
  const ladder = RANKS.map((r, i) => {
    const lit = i <= climb;
    const cur = i === climb;
    return {
      name: r[0], min: r[1],
      h: 96 + i * 30,
      bg: cur ? LIME : lit ? "#2A3524" : "#161B14",
      border: cur ? LIME : lit ? "#3F4E36" : "#232B20",
      fg: cur ? "#0F130E" : lit ? "#E9EDE2" : "#6E776A",
      sub: cur ? "#2F3A16" : lit ? "#AEB7A8" : "#5F685B",
      markOpacity: cur ? 1 : 0,
    };
  });

  const claimed = claimedAt !== null && tick - claimedAt < 7;
  const stage = claimed ? 3 : Math.floor(tick / 5) % 3;
  const pay = {
    stages: STAGE_NAMES.map((n, i) => ({
      name: n,
      bg: i === stage ? "#161A14" : i < stage ? "#C9CDBE" : "transparent",
      fg: i === stage ? LIME : i < stage ? "#161A14" : "#7A8075",
    })),
    label: ["Estimated pay", "Finalized pay", "Claimable now", "Paid to your wallet"][stage],
    disabled: stage !== 2,
    cursor: stage === 2 ? "pointer" : "not-allowed",
    btnBg: stage === 2 ? "#161A14" : "#C9CDBE",
    btnFg: stage === 2 ? LIME : "#5A6156",
    btn: stage === 3 ? "Pay claimed" : "Claim pay",
    note: ["Estimate only. Final once the epoch closes.", "Epoch finalized. Merkle root published.", "Ready to claim with your Merkle proof.", "Payroll Claimed event recorded onchain."][stage],
    claim: () => { if (stage === 2) setClaimedAt(tick); },
  };

  const fa = tick % 6;
  const flow = FLOW.map((f, i) => ({
    n: i + 1, name: f[0], where: f[1],
    bg: i === fa ? "rgba(200,241,53,0.08)" : "#121710",
    border: i === fa ? "rgba(200,241,53,0.5)" : "#222A20",
    dotBg: i <= fa ? LIME : "#232B20",
    dotFg: i <= fa ? "#0F130E" : "#8E978A",
  }));

  const pa = Math.floor(tick / 2) % 8;
  const proofs = PROOFS.map((p, i) => ({ event: p[0], contract: p[1], cls: i === pa ? "flash" : "" }));

  const ticker = TICKER_SRC.concat(TICKER_SRC).map((t) => ({ text: t[0], dot: t[1] }));
  const working = 24;
  const launches = 8;

  return (
    <>
<div className="sh" style={{background: '#0F130E', color: '#E9EDE2', fontFamily: "'Geist', 'Helvetica Neue', Helvetica, sans-serif", fontSize: '17px', lineHeight: '1.55', overflowX: 'hidden', minHeight: '100vh', fontVariantNumeric: 'tabular-nums'}}>

<header style={{position: 'sticky', top: '0', zIndex: '20', background: 'rgba(15,19,14,0.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid #222A20'}}>
<div style={{maxWidth: '1240px', margin: '0 auto', padding: '14px clamp(20px,4vw,48px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 32px'}}>
<a href="#top" style={{textDecoration: 'none', color: '#E9EDE2', display: 'flex', alignItems: 'center', gap: '10px'}}>
<span style={{width: '30px', height: '30px', borderRadius: '8px', background: '#C8F135', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="#0F130E" strokeWidth="2" /><path d="M8 4.5V8l2.4 1.6" fill="none" stroke="#0F130E" strokeWidth="2" strokeLinecap="round" /></svg>
</span>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '26px', letterSpacing: '0.04em'}}>SHIFT</span>
</a>
<nav aria-label="Main" style={{display: 'flex', flexWrap: 'wrap', gap: '6px 26px', fontSize: '15px', flex: '1 1 auto'}}>
<a className="navlink" href="#how">How it works</a>
<a className="navlink" href="#office">Live office</a>
<a className="navlink" href="#career">Careers</a>
<a className="navlink" href="#payday">Payroll</a>
<a className="navlink" href="#proof">Proof</a>
</nav>
<div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
<span style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#AEB7A8'}}>
<span className="live" style={{width: '8px', height: '8px', borderRadius: '50%', background: '#C8F135', display: 'inline-block'}} />
Shift active
</span>
<a href="#office" className="btn-ghost" style={{textDecoration: 'none', color: '#E9EDE2', fontSize: '14px', fontWeight: '500', padding: '10px 16px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', border: '1px solid #3A4436', borderRadius: '999px'}}>Connect wallet</a>
</div>
</div>
</header>

<section id="top" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(48px,7vw,104px) clamp(20px,4vw,48px) clamp(48px,6vw,80px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 470px), 1fr))', gap: '56px', alignItems: 'center'}}>
<div>
<h1 aria-label="SHIFT" style={{margin: '0 0 0 -6px', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: 'clamp(120px, 17vw, 252px)', lineHeight: '0.8', letterSpacing: '0', display: 'flex', color: '#E9EDE2'}}>
<span aria-hidden="true" style={{overflow: 'hidden', display: 'inline-block', paddingBottom: '6px'}}><span className="ln" style={{animationDelay: '.05s'}}>S</span></span>
<span aria-hidden="true" style={{overflow: 'hidden', display: 'inline-block', paddingBottom: '6px'}}><span className="ln" style={{animationDelay: '.13s'}}>H</span></span>
<span aria-hidden="true" style={{overflow: 'hidden', display: 'inline-block', paddingBottom: '6px'}}><span className="ln" style={{animationDelay: '.21s'}}>I</span></span>
<span aria-hidden="true" style={{overflow: 'hidden', display: 'inline-block', paddingBottom: '6px'}}><span className="ln" style={{animationDelay: '.29s'}}>F</span></span>
<span aria-hidden="true" style={{overflow: 'hidden', display: 'inline-block', paddingBottom: '6px'}}><span className="ln" style={{animationDelay: '.37s', color: '#C8F135'}}>T</span></span>
</h1>
<p className="fd" style={{animationDelay: '.7s', margin: '28px 0 0', fontSize: 'clamp(24px, 2.5vw, 32px)', fontWeight: '500', lineHeight: '1.2', letterSpacing: '-0.01em', maxWidth: '18ch'}}>Clock in. Launch. Perform. Get paid.</p>
<p className="fd" style={{animationDelay: '.85s', margin: '18px 0 0', color: '#AEB7A8', maxWidth: '44ch'}}>The onchain workforce powered by Pons. You get hired, your employee token launches, the market grades your shift, and payday is provable on Robinhood Chain.</p>
<div className="fd" style={{animationDelay: '1s', display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '36px'}}>
<a href="#office" className="btn-lime" style={{textDecoration: 'none', background: '#C8F135', color: '#0F130E', fontWeight: '600', fontSize: '16px', padding: '0 26px', minHeight: '52px', display: 'inline-flex', alignItems: 'center', borderRadius: '999px'}}>Clock in</a>
<a href="#how" className="btn-ghost" style={{textDecoration: 'none', color: '#E9EDE2', fontWeight: '500', fontSize: '16px', padding: '0 24px', minHeight: '52px', display: 'inline-flex', alignItems: 'center', border: '1px solid #3A4436', borderRadius: '999px'}}>How SHIFT works</a>
</div>
</div>

<div style={{position: 'relative', height: '560px', maxWidth: '560px', width: '100%', justifySelf: 'center'}}>
<div className="fd" style={{animationDelay: '.3s', position: 'absolute', left: '0', right: '0', top: '0', height: '168px', background: '#171C15', border: '1px solid #2A3227', borderRadius: '22px', padding: '22px 26px', overflow: 'hidden'}}>
<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#8E978A'}}>
<span>Office time clock</span>
<span>Robinhood Chain</span>
</div>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '76px', lineHeight: '1', marginTop: '10px', color: '#C8F135', letterSpacing: '0.02em'}}>{clock}</div>
<div style={{position: 'absolute', left: '26px', right: '26px', bottom: '16px', height: '8px', borderRadius: '4px', background: '#0A0D09', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.8)'}} />
</div>

<div className="card-in" style={{position: 'absolute', left: '4%', top: '150px', width: '62%', minWidth: '230px', transform: 'rotate(-4deg)', zIndex: '2'}}>
<div style={{background: '#E4E7DA', color: '#161A14', borderRadius: '6px', padding: '22px 22px 26px', boxShadow: '0 30px 60px rgba(0,0,0,.45)', position: 'relative', overflow: 'hidden'}}>
<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #161A14', paddingBottom: '10px'}}>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '26px', letterSpacing: '0.03em'}}>Time card</span>
<span style={{fontFamily: "'Geist Mono', monospace", fontSize: '12px'}}>EMP-0247</span>
</div>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0', fontSize: '13px', marginTop: '12px'}}>
<span style={{color: '#5A6156', padding: '7px 0', borderBottom: '1px solid #C3C7B7'}}>Clock in</span>
<span style={{color: '#5A6156', padding: '7px 0', borderBottom: '1px solid #C3C7B7'}}>Snapshots</span>
<span style={{color: '#5A6156', padding: '7px 0', borderBottom: '1px solid #C3C7B7'}}>Clock out</span>
<span style={{padding: '9px 0', fontWeight: '600', fontSize: '18px'}}>00:00</span>
<span style={{padding: '9px 0', fontWeight: '600', fontSize: '18px'}}>15 / 15</span>
<span style={{padding: '9px 0', fontWeight: '600', fontSize: '18px'}}>05:00</span>
</div>
<div style={{display: 'flex', gap: '5px', marginTop: '14px'}} aria-hidden="true">
{punches.map((p, i) => (<Fragment key={i}>
<span style={{flex: '1', height: '16px', borderRadius: '3px', background: p.bg}} />
</Fragment>))}
</div>
<div className="stamp" style={{position: 'absolute', right: '16px', bottom: '34px', border: '3px solid #4C7A0B', color: '#4C7A0B', padding: '4px 12px', borderRadius: '6px', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: '28px', letterSpacing: '0.06em', transform: 'rotate(-9deg)', background: 'rgba(200,241,53,.35)'}}>CLOCKED IN</div>
</div>
</div>

<div className="badge-in" style={{position: 'absolute', right: '2%', top: '96px', width: '44%', minWidth: '200px', zIndex: '3'}}>
<div className="sway">
<div style={{width: '3px', height: '92px', margin: '0 auto', background: 'linear-gradient(#C8F135, #6F8A1C)'}} />
<div style={{background: '#1D231B', border: '1px solid #39442F', borderRadius: '18px', padding: '18px', boxShadow: '0 30px 70px rgba(0,0,0,.55)'}}>
<div style={{width: '46px', height: '8px', borderRadius: '4px', background: '#0F130E', margin: '0 auto 16px'}} />
<div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
<svg width="56" height="56" viewBox="0 0 44 44" aria-hidden="true"><rect width="44" height="44" rx="11" fill="#C8F135" /><circle cx="22" cy="17" r="8" fill="#0F130E" /><rect x="9" y="28" width="26" height="16" rx="8" fill="#0F130E" /><rect x="18" y="15" width="3" height="3" fill="#C8F135" /><rect x="24" y="15" width="3" height="3" fill="#C8F135" /></svg>
<div>
<div style={{fontWeight: '600', fontSize: '18px', lineHeight: '1.2'}}>Mara Voss</div>
<div style={{fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: '#C8F135'}}>$VOSS</div>
</div>
</div>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginTop: '16px', fontSize: '12px', color: '#8E978A'}}>
<div>Employee<div style={{color: '#E9EDE2', fontSize: '14px'}}>EMP-0247</div></div>
<div>Department<div style={{color: '#E9EDE2', fontSize: '14px'}}>Trading</div></div>
<div>Rank<div style={{color: '#E9EDE2', fontSize: '14px'}}>{badgeRank}</div></div>
<div>Market<div style={{color: '#E9EDE2', fontSize: '14px'}}>Pons</div></div>
</div>
</div>
</div>
</div>
</div>
</section>

<div style={{borderTop: '1px solid #222A20', borderBottom: '1px solid #222A20'}}>
<div style={{maxWidth: '1240px', margin: '0 auto', padding: '0 clamp(20px,4vw,48px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'}}>
<div style={{padding: '22px 0', display: 'flex', alignItems: 'center', gap: '12px'}}>
<span className="live" style={{width: '10px', height: '10px', borderRadius: '50%', background: '#C8F135', display: 'inline-block'}} />
<span style={{fontWeight: '600', fontSize: '18px'}}>Shift active</span>
</div>
<div style={{padding: '22px 0'}}><span style={{fontWeight: '600', fontSize: '22px'}}>{working}</span> <span style={{color: '#8E978A'}}>employees working</span></div>
<div style={{padding: '22px 0'}}><span style={{fontWeight: '600', fontSize: '22px'}}>{launches}</span> <span style={{color: '#8E978A'}}>active launches</span></div>
<div style={{padding: '22px 0'}}><span style={{color: '#8E978A'}}>Next payday</span> <span style={{fontWeight: '600', fontSize: '22px', color: '#C8F135'}}>{payday}</span></div>
</div>
</div>

<div className="mqwrap" style={{overflow: 'hidden', borderBottom: '1px solid #222A20', padding: '14px 0', background: '#121710'}} aria-label="Recent onchain activity">
<div className="mq" style={{display: 'flex', width: 'max-content', gap: '48px', fontSize: '14px', color: '#AEB7A8', whiteSpace: 'nowrap'}}>
{ticker.map((t, i) => (<Fragment key={i}>
<span style={{display: 'inline-flex', alignItems: 'center', gap: '10px'}}><span style={{width: '6px', height: '6px', borderRadius: '50%', background: t.dot, display: 'inline-block'}} />{t.text}</span>
</Fragment>))}
</div>
</div>

<section id="how" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(80px,10vw,140px) clamp(20px,4vw,48px) 0'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '24px 64px', alignItems: 'end'}}>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92', letterSpacing: '0.005em'}}>A workday that lasts five minutes</h2>
<p style={{margin: '0', color: '#AEB7A8', maxWidth: '46ch'}}>Every shift runs on a fixed clock. Fifteen snapshots, one every twenty seconds, record how your token performs. The average decides your score, so one lucky block can't carry you.</p>
</div>

<div style={{marginTop: '56px', background: '#151A13', border: '1px solid #263023', borderRadius: '26px', padding: 'clamp(22px, 3vw, 40px)'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '36px'}}>
<div><div style={{fontSize: '13px', color: '#8E978A'}}>Snapshot</div><div style={{fontSize: '30px', fontWeight: '600'}}>{shift.snap} <span style={{color: '#5F685B', fontSize: '20px'}}>/ 15</span></div></div>
<div><div style={{fontSize: '13px', color: '#8E978A'}}>Elapsed</div><div style={{fontSize: '30px', fontWeight: '600'}}>{shift.elapsed}</div></div>
<div><div style={{fontSize: '13px', color: '#8E978A'}}>Performance score</div><div style={{fontSize: '30px', fontWeight: '600', color: '#C8F135'}}>{shift.score}</div></div>
<div><div style={{fontSize: '13px', color: '#8E978A'}}>Rank</div><div style={{fontSize: '30px', fontWeight: '600'}}>{shift.rank}</div></div>
</div>

<div style={{position: 'relative', height: '64px'}}>
<div style={{position: 'absolute', left: '0', right: '0', top: '22px', height: '4px', borderRadius: '2px', background: '#283024'}} />
<div className="tr" style={{position: 'absolute', left: '0', top: '22px', height: '4px', borderRadius: '2px', background: '#C8F135', width: `${shift.pct}%`}} />
<span style={{position: 'absolute', left: '0', top: '14px', width: '20px', height: '20px', marginLeft: '-2px', borderRadius: '50%', background: '#C8F135', border: '4px solid #151A13'}} />
{shift.dots.map((d, i) => (<Fragment key={i}>
<span className="tr" style={{position: 'absolute', top: '16px', left: `${d.left}%`, width: '16px', height: '16px', marginLeft: '-8px', borderRadius: '50%', background: d.bg, border: '3px solid #151A13'}} />
</Fragment>))}
<div style={{position: 'absolute', left: '0', right: '0', top: '46px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6E776A'}}>
<span>00:00</span><span>01:00</span><span>02:00</span><span>03:00</span><span>04:00</span><span>05:00</span>
</div>
</div>

<div style={{minHeight: '120px', marginTop: '28px', display: 'flex', alignItems: 'center'}}>
{shift.done && (<>
<div className="stamp-now" style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 28px', border: '2px solid #C8F135', borderRadius: '16px', padding: '16px 26px', transform: 'rotate(-1.5deg)', background: 'rgba(200,241,53,.08)'}}>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: '46px', color: '#C8F135', letterSpacing: '0.04em', lineHeight: '1'}}>PROMOTED</span>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '32px', lineHeight: '1'}}>INTERN → MANAGER</span>
<span style={{color: '#AEB7A8'}}>Performance score 53.4</span>
</div>
</>)}
{shift.running && (<>
<p style={{margin: '0', color: '#8E978A', maxWidth: '60ch'}}>Snapshot {shift.snap} recorded. Market cap, volume, holders, liquidity and stability are normalized and folded into the running score.</p>
</>)}
</div>
</div>

<ol style={{listStyle: 'none', margin: '56px 0 0', padding: '0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: '#222A20', border: '1px solid #222A20', borderRadius: '20px', overflow: 'hidden'}}>
<li style={{background: '#0F130E', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#3E4A39', lineHeight: '1'}}>1</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Connect wallet</div>
<div style={{color: '#8E978A', fontSize: '15px', marginTop: '6px'}}>Any EVM wallet on Robinhood Chain.</div>
</li>
<li style={{background: '#0F130E', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#3E4A39', lineHeight: '1'}}>2</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Clock in</div>
<div style={{color: '#8E978A', fontSize: '15px', marginTop: '6px'}}>SHIFT hires you with a permanent name, ticker, avatar and employee ID.</div>
</li>
<li style={{background: '#0F130E', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#3E4A39', lineHeight: '1'}}>3</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Launch on Pons</div>
<div style={{color: '#8E978A', fontSize: '15px', marginTop: '6px'}}>Your employee token goes live as a real Pons market.</div>
</li>
<li style={{background: '#0F130E', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#3E4A39', lineHeight: '1'}}>4</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Work the shift</div>
<div style={{color: '#8E978A', fontSize: '15px', marginTop: '6px'}}>Five minutes, fifteen snapshots. Closing your tab doesn't stop the clock.</div>
</li>
<li style={{background: '#0F130E', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#3E4A39', lineHeight: '1'}}>5</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Get ranked</div>
<div style={{color: '#8E978A', fontSize: '15px', marginTop: '6px'}}>A deterministic score sets your title, from Intern to CEO.</div>
</li>
<li style={{background: '#0F130E', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#C8F135', lineHeight: '1'}}>6</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Payday</div>
<div style={{color: '#8E978A', fontSize: '15px', marginTop: '6px'}}>Claim your share of the payroll vault, with proof attached.</div>
</li>
</ol>
</section>

<section id="office" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(96px,11vw,160px) clamp(20px,4vw,48px) 0'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '24px 64px', alignItems: 'end'}}>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92'}}>The office is open</h2>
<p style={{margin: '0', color: '#AEB7A8', maxWidth: '46ch'}}>Every desk is an employee and every employee is a live Pons market. Pick a desk to see who's working it and how the shift is going.</p>
</div>

<div style={{marginTop: '48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px'}}>
{desks.map((e, i) => (<Fragment key={i}>
<button type="button" className="desk" onClick={e.pick} aria-pressed={e.pressed} style={{textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', background: e.bg, border: `1px solid ${e.border}`, borderRadius: '18px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '210px'}}>
<span style={{display: 'flex', alignItems: 'center', gap: '12px', width: '100%'}}>
<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" style={{flex: 'none'}}><rect width="44" height="44" rx="11" fill={e.c1} /><circle cx="22" cy="17" r="8" fill={e.c2} /><rect x="9" y="28" width="26" height="16" rx="8" fill={e.c2} /></svg>
<span style={{flex: '1', minWidth: '0'}}>
<span style={{display: 'block', fontWeight: '600', fontSize: '16px', lineHeight: '1.25'}}>{e.name}</span>
<span style={{display: 'block', fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#C8F135'}}>{e.ticker}</span>
</span>
<span className="tr" style={{fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em', padding: '5px 9px', borderRadius: '999px', whiteSpace: 'nowrap', background: e.chipBg, color: e.chipFg, border: `1px solid ${e.chipBorder}`}}>{e.status}</span>
</span>
<span style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 14px', fontSize: '12px', color: '#8E978A', width: '100%'}}>
<span>Rank<span style={{display: 'block', color: '#E9EDE2', fontSize: '15px'}}>{e.rank}</span></span>
<span>Score<span style={{display: 'block', color: '#E9EDE2', fontSize: '15px'}}>{e.score}</span></span>
<span>Market cap<span style={{display: 'block', color: '#E9EDE2', fontSize: '15px'}}>{e.mcap} ETH</span></span>
<span>Shift timer<span style={{display: 'block', color: '#E9EDE2', fontSize: '15px'}}>{e.timer}</span></span>
</span>
<span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #263023', paddingTop: '12px', fontSize: '13px', color: '#8E978A', width: '100%'}}>
<span>Payroll earned</span>
<span style={{color: '#E9EDE2', fontWeight: '600'}}>{e.pay} ETH</span>
</span>
</button>
</Fragment>))}
</div>

<div style={{marginTop: '14px', background: '#171C15', border: '1px solid #2E382A', borderRadius: '18px', padding: '22px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '18px 36px'}}>
<div style={{flex: '1 1 260px'}}>
<div style={{fontSize: '13px', color: '#8E978A'}}>Selected desk</div>
<div style={{fontSize: '22px', fontWeight: '600'}}>{sel.name} <span style={{fontFamily: "'Geist Mono', monospace", fontSize: '15px', color: '#C8F135'}}>{sel.ticker}</span></div>
<div style={{color: '#8E978A', fontSize: '14px'}}>{sel.id}, {sel.dept}, {sel.rank}</div>
</div>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
<a href="#office" className="btn-ghost" style={{textDecoration: 'none', color: '#E9EDE2', fontSize: '15px', padding: '0 18px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', border: '1px solid #3A4436', borderRadius: '999px'}}>Open employee profile</a>
<a href="#office" className="btn-lime" style={{textDecoration: 'none', background: '#C8F135', color: '#0F130E', fontWeight: '600', fontSize: '15px', padding: '0 18px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', borderRadius: '999px'}}>View on Pons ↗</a>
</div>
</div>
</section>

<section id="performance" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(96px,11vw,160px) clamp(20px,4vw,48px) 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '56px'}}>
<div>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92'}}>Sustained work gets rewarded</h2>
<p style={{margin: '22px 0 0', color: '#AEB7A8', maxWidth: '46ch'}}>SHIFT scores the whole shift, not the last print. Each metric is normalized, time-weighted, then combined with weights that live in config, not in code.</p>
<div style={{marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '18px'}}>
{weights.map((w, i) => (<Fragment key={i}>
<div>
<div style={{display: 'flex', justifyContent: 'space-between', fontSize: '15px', marginBottom: '8px'}}><span>{w.label}</span><span style={{color: '#C8F135', fontWeight: '600'}}>{w.pct}%</span></div>
<div style={{height: '10px', background: '#1E251C', borderRadius: '5px', overflow: 'hidden'}}>
<div className="wbar" style={{height: '100%', width: `${w.width}%`, background: w.color, borderRadius: '5px'}} />
</div>
</div>
</Fragment>))}
</div>
</div>

<div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
<figure style={{margin: '0', background: '#151A13', border: '1px solid #263023', borderRadius: '22px', padding: '24px'}}>
<svg viewBox="0 0 520 240" width="100%" role="img" aria-label="A steady token rising across the shift scores higher than a token with one short spike">
<line x1="0" y1="220" x2="520" y2="220" stroke="#283024" strokeWidth="1" />
<line x1="0" y1="174" x2="520" y2="174" stroke="#7E8779" strokeWidth="1.5" strokeDasharray="5 6" />
<line x1="0" y1="128" x2="520" y2="128" stroke="#C8F135" strokeWidth="1.5" strokeDasharray="5 6" />
<polyline className="draw" pathLength="1" fill="none" stroke="#7E8779" strokeWidth="2.5" strokeLinejoin="round" points="0,196 60,192 120,195 180,190 230,188 250,34 270,186 330,192 390,194 450,191 520,195" />
<polyline className="draw" pathLength="1" fill="none" stroke="#C8F135" strokeWidth="3" strokeLinejoin="round" points="0,200 52,184 104,170 156,160 208,146 260,138 312,122 364,112 416,98 468,90 520,82" />
</svg>
<figcaption style={{display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: '14px', color: '#AEB7A8', marginTop: '14px'}}>
<span style={{display: 'inline-flex', alignItems: 'center', gap: '8px'}}><span style={{width: '14px', height: '3px', background: '#C8F135', display: 'inline-block'}} />Steady token, higher time-weighted score</span>
<span style={{display: 'inline-flex', alignItems: 'center', gap: '8px'}}><span style={{width: '14px', height: '3px', background: '#7E8779', display: 'inline-block'}} />One-block spike, barely moves the average</span>
</figcaption>
</figure>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '22px', padding: '24px'}}>
<div style={{fontWeight: '600'}}>Flagged before it counts</div>
<p style={{margin: '6px 0 16px', color: '#8E978A', fontSize: '15px'}}>Suspicious shifts are excluded with an audit trail. Nobody edits a final score by hand.</p>
<ul style={{listStyle: 'none', margin: '0', padding: '0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px 20px', fontSize: '15px'}}>
{flags.map((f, i) => (<Fragment key={i}>
<li style={{display: 'flex', gap: '10px', alignItems: 'flex-start'}}>
<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{flex: 'none', marginTop: '4px'}}><path d="M4 4l8 8M12 4l-8 8" stroke="#E0A44A" strokeWidth="2" strokeLinecap="round" /></svg>
<span style={{color: '#C9D0C2'}}>{f}</span>
</li>
</Fragment>))}
</ul>
</div>
</div>
</section>

<section id="career" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(96px,11vw,160px) clamp(20px,4vw,48px) 0'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '24px 64px', alignItems: 'end'}}>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92'}}>Eight titles, eight pay grades</h2>
<p style={{margin: '0', color: '#AEB7A8', maxWidth: '46ch'}}>Your score sets your title and your title sets your share of payroll. Promotions are public, deterministic and impossible to miss.</p>
</div>
<div style={{marginTop: '56px', overflowX: 'auto', paddingBottom: '8px'}}>
<div style={{minWidth: '760px', display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '10px', alignItems: 'end', height: '360px'}}>
{ladder.map((r, i) => (<Fragment key={i}>
<div style={{display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%'}}>
<div className="tr" style={{fontSize: '12px', fontWeight: '600', color: '#0F130E', background: '#C8F135', borderRadius: '999px', padding: '3px 10px', alignSelf: 'flex-start', marginBottom: '10px', opacity: r.markOpacity}}>You</div>
<div className="tr" style={{height: `${r.h}px`, background: r.bg, border: `1px solid ${r.border}`, borderRadius: '14px 14px 4px 4px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
<span className="tr" style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '26px', lineHeight: '1', color: r.fg}}>{r.name}</span>
<span className="tr" style={{fontSize: '13px', color: r.sub}}>{r.min}+</span>
</div>
</div>
</Fragment>))}
</div>
</div>
</section>

<section id="payday" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(96px,11vw,160px) clamp(20px,4vw,48px) 0'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '24px 64px', alignItems: 'end'}}>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92'}}>Payday comes with receipts</h2>
<p style={{margin: '0', color: '#AEB7A8', maxWidth: '46ch'}}>Revenue for payroll lands in a transparent vault. Each epoch is finalized with a Merkle root, and you claim your share. Your pay is computed from public inputs, never from admin discretion.</p>
</div>

<div style={{marginTop: '56px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '24px', alignItems: 'start'}}>
<div style={{background: '#E4E7DA', color: '#161A14', borderRadius: '10px', padding: 'clamp(24px, 3vw, 36px)', position: 'relative', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.4)'}}>
<div className="scan" aria-hidden="true" style={{position: 'absolute', left: '0', right: '0', top: '0', height: '26%', background: 'linear-gradient(rgba(200,241,53,0), rgba(200,241,53,.22), rgba(200,241,53,0))', pointerEvents: 'none'}} />
<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #161A14', paddingBottom: '12px'}}>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: '40px', letterSpacing: '0.04em', lineHeight: '1'}}>PAYDAY</span>
<span style={{fontSize: '14px', color: '#4A5146'}}>Next payday {payday}</span>
</div>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '22px', marginTop: '22px'}}>
<div><div style={{fontSize: '13px', color: '#5A6156'}}>Payroll pool</div><div style={{fontSize: '34px', fontWeight: '600', lineHeight: '1.15'}}>12.42 ETH</div></div>
<div><div style={{fontSize: '13px', color: '#5A6156'}}>Your shares</div><div style={{fontSize: '34px', fontWeight: '600', lineHeight: '1.15'}}>4.81%</div></div>
</div>
<div style={{marginTop: '22px', paddingTop: '18px', borderTop: '1px dashed #A9AE9C'}}>
<div style={{fontSize: '13px', color: '#5A6156'}}>{pay.label}</div>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: '72px', lineHeight: '1'}}>0.597 ETH</div>
</div>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px', marginTop: '22px'}} aria-label="Payroll status">
{pay.stages.map((s, i) => (<Fragment key={i}>
<div className="tr" style={{textAlign: 'center', fontSize: '13px', fontWeight: '600', padding: '9px 4px', borderRadius: '8px', background: s.bg, color: s.fg}}>{s.name}</div>
</Fragment>))}
</div>
<button type="button" onClick={pay.claim} disabled={pay.disabled} className="tr" style={{marginTop: '20px', width: '100%', minHeight: '54px', border: '0', borderRadius: '999px', font: 'inherit', fontWeight: '600', fontSize: '16px', cursor: pay.cursor, background: pay.btnBg, color: pay.btnFg}}>{pay.btn}</button>
<p style={{margin: '12px 0 0', fontSize: '13px', color: '#5A6156', textAlign: 'center'}}>{pay.note}</p>
</div>

<div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
<ol style={{listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '8px'}}>
{flow.map((f, i) => (<Fragment key={i}>
<li className="tr" style={{display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderRadius: '14px', border: `1px solid ${f.border}`, background: f.bg}}>
<span className="tr" style={{width: '30px', height: '30px', flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '600', background: f.dotBg, color: f.dotFg}}>{f.n}</span>
<span style={{flex: '1'}}>{f.name}</span>
<span style={{fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#6E776A'}}>{f.where}</span>
</li>
</Fragment>))}
</ol>
<div style={{background: '#151A13', border: '1px solid #263023', borderRadius: '14px', padding: '18px 20px', fontFamily: "'Geist Mono', monospace", fontSize: '14px', color: '#C9D0C2', lineHeight: '1.8', overflowX: 'auto'}}>
<div><span style={{color: '#8E978A'}}>employeeShares</span> = performanceWeight × activeTimeWeight</div>
<div><span style={{color: '#8E978A'}}>employeePayroll</span> = payrollPool × employeeShares / totalEligibleShares</div>
</div>
</div>
</div>
</section>

<section id="proof" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(96px,11vw,160px) clamp(20px,4vw,48px) 0'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '24px 64px', alignItems: 'end'}}>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92'}}>Don't trust the screenshot</h2>
<p style={{margin: '0', color: '#AEB7A8', maxWidth: '46ch'}}>Every important action in SHIFT links to its transaction. Each finalized shift is hashed onchain, with the full snapshot trail kept for anyone to recompute.</p>
</div>
<div style={{marginTop: '48px', border: '1px solid #263023', borderRadius: '20px', overflowX: 'auto'}}>
<div style={{minWidth: '640px'}}>
{proofs.map((p, i) => (<Fragment key={i}>
<div className={p.cls} style={{display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '16px', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #1F271D'}}>
<span style={{display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '500'}}>
<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="#C8F135" strokeWidth="1.5" /><path d="M5.5 9.2l2.3 2.3 4.7-4.9" fill="none" stroke="#C8F135" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
{p.event}
</span>
<span style={{fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: '#8E978A'}}>{p.contract}</span>
<span style={{display: 'flex', gap: '18px', fontSize: '14px', whiteSpace: 'nowrap'}}>
<a href="#proof" aria-label={`View ${p.event} on Robinhood Chain Explorer`}>Robinhood Chain Explorer ↗</a>
<a href="#proof" aria-label={`View ${p.event} on Pons`}>Pons ↗</a>
</span>
</div>
</Fragment>))}
</div>
</div>
</section>

<section style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(110px,13vw,190px) clamp(20px,4vw,48px) clamp(80px,9vw,120px)'}}>
<p style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: 'clamp(56px, 9vw, 136px)', lineHeight: '0.88', color: '#5F685B'}}>Pons launches the markets.</p>
<p style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: 'clamp(56px, 9vw, 136px)', lineHeight: '0.88', color: '#E9EDE2'}}>SHIFT runs the company.</p>
<div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 28px', marginTop: '48px'}}>
<a href="#top" className="btn-lime" style={{textDecoration: 'none', background: '#C8F135', color: '#0F130E', fontWeight: '600', fontSize: '17px', padding: '0 30px', minHeight: '56px', display: 'inline-flex', alignItems: 'center', borderRadius: '999px'}}>Clock in</a>
<span style={{color: '#8E978A'}}>Your next shift starts the moment your token is live.</span>
</div>
</section>

<footer style={{borderTop: '1px solid #222A20'}}>
<div style={{maxWidth: '1240px', margin: '0 auto', padding: '32px clamp(20px,4vw,48px) 40px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '20px 40px', fontSize: '14px', color: '#8E978A'}}>
<div style={{display: 'flex', alignItems: 'center', gap: '14px'}}>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '22px', color: '#E9EDE2', letterSpacing: '0.04em'}}>SHIFT</span>
<span style={{fontFamily: "'Geist Mono', monospace", color: '#C8F135'}}>$SHIFT</span>
</div>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '8px 28px'}}>
<span>Network: Robinhood Chain</span>
<span>Launch layer: Pons</span>
<a className="navlink" href="#office">Leaderboard</a>
<a className="navlink" href="#payday">Payroll</a>
</div>
</div>
</footer>

</div>
    </>
  );
}
