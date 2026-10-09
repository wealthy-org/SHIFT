"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useLazyComponent } from "./office3d/mini/useLazy";
import { useTheme } from "@/lib/useTheme";

const loadOfficeTeaser = () => import("./office3d/mini/OfficeTeaser");
const loadHeroOffice = () => import("./office3d/mini/HeroOffice");

// Loads the 3D teaser only once it is about to scroll into view, so a visitor
// who never scrolls past the hero never pays for three.js at all.
function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

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
  "CLOCKED IN": { bg: "transparent", fg: "var(--ink-dim)", b: "var(--border)" },
  WORKING: { bg: "rgba(200,241,53,0.12)", fg: "var(--lime-ink)", b: "rgba(200,241,53,0.35)" },
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
  ["Shift finalized, result hash stored", "var(--ink-dimmer)"], ["$VOSS snapshot recorded", "var(--ink-dimmer)"], ["Payroll epoch finalized", "#E4E7DA"],
  ["Rhea Duval claimed payroll", LIME], ["EMP-0312 started a shift", "var(--ink-dimmer)"], ["$OKO volume up this shift", "#E4E7DA"], ["Merkle root published", "var(--ink-dimmer)"],
];

export default function Shift() {
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  const [claimedAt, setClaimedAt] = useState<number | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();
  const [teaserRef, teaserNear] = useNearViewport<HTMLDivElement>();
  const OfficeTeaserC = useLazyComponent(loadOfficeTeaser, teaserNear);
  // The hero is above the fold, so unlike the teaser further down, this one
  // loads immediately rather than waiting for scroll.
  const HeroOfficeC = useLazyComponent(loadHeroOffice, true);

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
      bg: sel ? 'rgba(200,241,53,.12)' : 'var(--card)',
      border: sel ? LIME : "var(--border-soft)",
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
      bg: cur ? LIME : lit ? 'rgba(200,241,53,.16)' : 'var(--border-soft)',
      border: cur ? LIME : lit ? 'rgba(200,241,53,.4)' : 'var(--border)',
      fg: cur ? "#0F130E" : lit ? "var(--ink)" : "#6E776A",
      sub: cur ? "#2F3A16" : lit ? "var(--ink-dim)" : "#5F685B",
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
    bg: i === fa ? "rgba(200,241,53,0.12)" : "var(--panel)",
    border: i === fa ? "rgba(200,241,53,0.5)" : "var(--border)",
    dotBg: i <= fa ? LIME : "var(--border)",
    dotFg: i <= fa ? "#0F130E" : "var(--ink-dimmer)",
  }));

  const pa = Math.floor(tick / 2) % 8;
  const proofs = PROOFS.map((p, i) => ({ event: p[0], contract: p[1], cls: i === pa ? "flash" : "" }));

  const ticker = TICKER_SRC.concat(TICKER_SRC).map((t) => ({ text: t[0], dot: t[1] }));
  const working = 24;
  const launches = 8;

  return (
    <>
<div className="sh sh-landing" style={{background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'Geist', 'Helvetica Neue', Helvetica, sans-serif", fontSize: '17px', lineHeight: '1.55', overflowX: 'hidden', minHeight: '100vh', fontVariantNumeric: 'tabular-nums'}}>

<header style={{position: 'sticky', top: '0', zIndex: '20', background: 'rgba(var(--bg-rgb),0.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)'}}>
<div style={{maxWidth: '1240px', margin: '0 auto', padding: '14px clamp(20px,4vw,48px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 32px'}}>
<a href="#top" style={{textDecoration: 'none', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '10px'}}>
<span style={{width: '30px', height: '30px', borderRadius: '8px', background: '#C8F135', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="#0F130E" strokeWidth="2" /><path d="M8 4.5V8l2.4 1.6" fill="none" stroke="#0F130E" strokeWidth="2" strokeLinecap="round" /></svg>
</span>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '26px', letterSpacing: '0.04em'}}>SHIFT</span>
</a>
<nav aria-label="Main" style={{display: 'flex', flexWrap: 'wrap', gap: '6px 26px', fontSize: '15px', flex: '1 1 auto'}}>
<a className="navlink" href="#how">How it works</a>
<a className="navlink" href="/office">Live office</a>
<a className="navlink" href="#career">Careers</a>
<a className="navlink" href="/payroll">Payroll</a>
<a className="navlink" href="/proof">Proof</a>
</nav>
<div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
<span style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--ink-dim)'}}>
<span className="live" style={{width: '8px', height: '8px', borderRadius: '50%', background: '#C8F135', display: 'inline-block'}} />
Shift active
</span>
<button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="btn-ghost" style={{background: 'transparent', cursor: 'pointer', color: 'var(--ink)', width: '40px', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-soft)', borderRadius: '999px'}}>
{theme === 'dark' ? (
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
) : (
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.8 14.3A9 9 0 1 1 9.7 3.2a7 7 0 0 0 11.1 11.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
)}
</button>
<a href="/clock-in" className="btn-ghost" style={{textDecoration: 'none', color: 'var(--ink)', fontSize: '14px', fontWeight: '500', padding: '10px 16px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-soft)', borderRadius: '999px'}}>Connect wallet</a>
</div>
</div>
</header>

<section id="top" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(48px,7vw,104px) clamp(20px,4vw,48px) clamp(48px,6vw,80px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 470px), 1fr))', gap: '56px', alignItems: 'center'}}>
<div>
<h1 aria-label="SHIFT" style={{margin: '0 0 0 -6px', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: 'clamp(120px, 17vw, 252px)', lineHeight: '0.8', letterSpacing: '0', display: 'flex', color: 'var(--ink)'}}>
<span aria-hidden="true" style={{overflow: 'hidden', display: 'inline-block', paddingBottom: '6px'}}><span className="ln" style={{animationDelay: '.05s'}}>S</span></span>
<span aria-hidden="true" style={{overflow: 'hidden', display: 'inline-block', paddingBottom: '6px'}}><span className="ln" style={{animationDelay: '.13s'}}>H</span></span>
<span aria-hidden="true" style={{overflow: 'hidden', display: 'inline-block', paddingBottom: '6px'}}><span className="ln" style={{animationDelay: '.21s'}}>I</span></span>
<span aria-hidden="true" style={{overflow: 'hidden', display: 'inline-block', paddingBottom: '6px'}}><span className="ln" style={{animationDelay: '.29s'}}>F</span></span>
<span aria-hidden="true" style={{overflow: 'hidden', display: 'inline-block', paddingBottom: '6px'}}><span className="ln" style={{animationDelay: '.37s', color: 'var(--lime-ink)'}}>T</span></span>
</h1>
<p className="fd" style={{animationDelay: '.7s', margin: '28px 0 0', fontSize: 'clamp(24px, 2.5vw, 32px)', fontWeight: '500', lineHeight: '1.2', letterSpacing: '-0.01em', maxWidth: '18ch'}}>Clock in. Launch. Perform. Get paid.</p>
<p className="fd" style={{animationDelay: '.85s', margin: '18px 0 0', color: 'var(--ink-dim)', maxWidth: '44ch'}}>The onchain workforce powered by Pons. You get hired, your employee token launches, the market grades your shift, and payday is provable on Robinhood Chain.</p>
<div className="fd" style={{animationDelay: '1s', display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '36px'}}>
<a href="/clock-in" className="btn-lime" style={{textDecoration: 'none', background: '#C8F135', color: '#0F130E', fontWeight: '600', fontSize: '16px', padding: '0 26px', minHeight: '52px', display: 'inline-flex', alignItems: 'center', borderRadius: '999px'}}>Clock in</a>
<a href="#how" className="btn-ghost" style={{textDecoration: 'none', color: 'var(--ink)', fontWeight: '500', fontSize: '16px', padding: '0 24px', minHeight: '52px', display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-soft)', borderRadius: '999px'}}>How SHIFT works</a>
</div>
</div>

<div style={{position: 'relative', height: '560px', maxWidth: '560px', width: '100%', justifySelf: 'center'}}>
<div className="fd" style={{animationDelay: '.3s', position: 'absolute', inset: '0', borderRadius: '22px', overflow: 'hidden', border: '1px solid var(--border-soft)', background: 'var(--card)'}}>
{HeroOfficeC ? <HeroOfficeC theme={theme} /> : (
<div aria-hidden="true" style={{width: '100%', height: '100%', position: 'relative', background: 'radial-gradient(60% 50% at 50% 55%, rgba(200,241,53,.06), transparent)'}}>
<div style={{position: 'absolute', left: '50%', top: '58%', transform: 'translate(-50%,-50%)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px'}}>
{Array.from({length: 6}, (_, i) => (<Fragment key={i}><div className="hero-sk" style={{width: '64px', height: '44px', borderRadius: '8px'}} /></Fragment>))}
</div>
</div>
)}
</div>

<div className="fd" style={{animationDelay: '.5s', position: 'absolute', left: '18px', top: '18px', background: 'rgba(var(--bg-rgb),.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', border: '1px solid var(--border-soft)', borderRadius: '14px', padding: '12px 16px', pointerEvents: 'none'}}>
<div style={{display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '12px', color: 'var(--ink-dimmer)'}}>
<span>Office time clock</span><span>Robinhood Chain</span>
</div>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '34px', lineHeight: '1', marginTop: '4px', color: 'var(--lime-ink)', letterSpacing: '0.02em'}}>{clock}</div>
</div>

<div className="badge-in" style={{position: 'absolute', right: '18px', bottom: '18px', pointerEvents: 'none'}}>
<div style={{background: 'rgba(var(--bg-rgb),.9)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', border: '1px solid var(--border-soft)', borderRadius: '14px', padding: '12px 14px', boxShadow: '0 20px 50px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', gap: '10px'}}>
<svg width="34" height="34" viewBox="0 0 44 44" aria-hidden="true"><rect width="44" height="44" rx="11" fill="#C8F135" /><circle cx="22" cy="17" r="8" fill="#0F130E" /><rect x="9" y="28" width="26" height="16" rx="8" fill="#0F130E" /></svg>
<div>
<div style={{fontWeight: '600', fontSize: '14px', lineHeight: '1.2'}}>Mara Voss <span style={{fontFamily: "'Geist Mono', monospace", fontWeight: '400', color: 'var(--lime-ink)'}}>$VOSS</span></div>
<div style={{fontSize: '12px', color: 'var(--ink-dimmer)'}}>{badgeRank} · Trading</div>
</div>
</div>
</div>

<div className="fd" style={{animationDelay: '.7s', position: 'absolute', left: '18px', bottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(var(--bg-rgb),.82)', border: '1px solid var(--border-soft)', borderRadius: '999px', padding: '7px 12px', fontSize: '13px', color: 'var(--ink-dim)', pointerEvents: 'none'}}>
<span className="live" style={{width: '8px', height: '8px', borderRadius: '50%', background: '#C8F135', display: 'inline-block'}} />
Shift active
</div>
</div>
</section>

<div style={{borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)'}}>
<div style={{maxWidth: '1240px', margin: '0 auto', padding: '0 clamp(20px,4vw,48px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'}}>
<div style={{padding: '22px 0', display: 'flex', alignItems: 'center', gap: '12px'}}>
<span className="live" style={{width: '10px', height: '10px', borderRadius: '50%', background: '#C8F135', display: 'inline-block'}} />
<span style={{fontWeight: '600', fontSize: '18px'}}>Shift active</span>
</div>
<div style={{padding: '22px 0'}}><span style={{fontWeight: '600', fontSize: '22px'}}>{working}</span> <span style={{color: 'var(--ink-dimmer)'}}>employees working</span></div>
<div style={{padding: '22px 0'}}><span style={{fontWeight: '600', fontSize: '22px'}}>{launches}</span> <span style={{color: 'var(--ink-dimmer)'}}>active launches</span></div>
<div style={{padding: '22px 0'}}><span style={{color: 'var(--ink-dimmer)'}}>Next payday</span> <span style={{fontWeight: '600', fontSize: '22px', color: 'var(--lime-ink)'}}>{payday}</span></div>
</div>
</div>

<div className="mqwrap" style={{overflow: 'hidden', borderBottom: '1px solid var(--border)', padding: '14px 0', background: 'var(--panel)'}} aria-label="Recent onchain activity">
<div className="mq" style={{display: 'flex', width: 'max-content', gap: '48px', fontSize: '14px', color: 'var(--ink-dim)', whiteSpace: 'nowrap'}}>
{ticker.map((t, i) => (<Fragment key={i}>
<span style={{display: 'inline-flex', alignItems: 'center', gap: '10px'}}><span style={{width: '6px', height: '6px', borderRadius: '50%', background: t.dot, display: 'inline-block'}} />{t.text}</span>
</Fragment>))}
</div>
</div>

<section id="how" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(80px,10vw,140px) clamp(20px,4vw,48px) 0'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '24px 64px', alignItems: 'end'}}>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92', letterSpacing: '0.005em'}}>A workday that lasts five minutes</h2>
<p style={{margin: '0', color: 'var(--ink-dim)', maxWidth: '46ch'}}>Every shift runs on a fixed clock. Fifteen snapshots, one every twenty seconds, record how your token performs. The average decides your score, so one lucky block can't carry you.</p>
</div>

<div style={{marginTop: '56px', background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '26px', padding: 'clamp(22px, 3vw, 40px)'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '36px'}}>
<div><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Snapshot</div><div style={{fontSize: '30px', fontWeight: '600'}}>{shift.snap} <span style={{color: '#5F685B', fontSize: '20px'}}>/ 15</span></div></div>
<div><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Elapsed</div><div style={{fontSize: '30px', fontWeight: '600'}}>{shift.elapsed}</div></div>
<div><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Performance score</div><div style={{fontSize: '30px', fontWeight: '600', color: 'var(--lime-ink)'}}>{shift.score}</div></div>
<div><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Rank</div><div style={{fontSize: '30px', fontWeight: '600'}}>{shift.rank}</div></div>
</div>

<div style={{position: 'relative', height: '64px'}}>
<div style={{position: 'absolute', left: '0', right: '0', top: '22px', height: '4px', borderRadius: '2px', background: 'var(--border-soft)'}} />
<div className="tr" style={{position: 'absolute', left: '0', top: '22px', height: '4px', borderRadius: '2px', background: '#C8F135', width: `${shift.pct}%`}} />
<span style={{position: 'absolute', left: '0', top: '14px', width: '20px', height: '20px', marginLeft: '-2px', borderRadius: '50%', background: '#C8F135', border: '4px solid var(--card)'}} />
{shift.dots.map((d, i) => (<Fragment key={i}>
<span className="tr" style={{position: 'absolute', top: '16px', left: `${d.left}%`, width: '16px', height: '16px', marginLeft: '-8px', borderRadius: '50%', background: d.bg, border: '3px solid var(--card)'}} />
</Fragment>))}
<div style={{position: 'absolute', left: '0', right: '0', top: '46px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6E776A'}}>
<span>00:00</span><span>01:00</span><span>02:00</span><span>03:00</span><span>04:00</span><span>05:00</span>
</div>
</div>

<div style={{minHeight: '120px', marginTop: '28px', display: 'flex', alignItems: 'center'}}>
{shift.done && (<>
<div className="stamp-now" style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 28px', border: '2px solid #C8F135', borderRadius: '16px', padding: '16px 26px', transform: 'rotate(-1.5deg)', background: 'rgba(200,241,53,.08)'}}>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: '46px', color: 'var(--lime-ink)', letterSpacing: '0.04em', lineHeight: '1'}}>PROMOTED</span>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '32px', lineHeight: '1'}}>INTERN → MANAGER</span>
<span style={{color: 'var(--ink-dim)'}}>Performance score 53.4</span>
</div>
</>)}
{shift.running && (<>
<p style={{margin: '0', color: 'var(--ink-dimmer)', maxWidth: '60ch'}}>Snapshot {shift.snap} recorded. Market cap, volume, holders, liquidity and stability are normalized and folded into the running score.</p>
</>)}
</div>
</div>

<ol style={{listStyle: 'none', margin: '56px 0 0', padding: '0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden'}}>
<li style={{background: 'var(--card)', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#3E4A39', lineHeight: '1'}}>1</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Connect wallet</div>
<div style={{color: 'var(--ink-dimmer)', fontSize: '15px', marginTop: '6px'}}>Any EVM wallet on Robinhood Chain.</div>
</li>
<li style={{background: 'var(--card)', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#3E4A39', lineHeight: '1'}}>2</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Clock in</div>
<div style={{color: 'var(--ink-dimmer)', fontSize: '15px', marginTop: '6px'}}>SHIFT hires you with a permanent name, ticker, avatar and employee ID.</div>
</li>
<li style={{background: 'var(--card)', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#3E4A39', lineHeight: '1'}}>3</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Launch on Pons</div>
<div style={{color: 'var(--ink-dimmer)', fontSize: '15px', marginTop: '6px'}}>Your employee token goes live as a real Pons market.</div>
</li>
<li style={{background: 'var(--card)', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#3E4A39', lineHeight: '1'}}>4</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Work the shift</div>
<div style={{color: 'var(--ink-dimmer)', fontSize: '15px', marginTop: '6px'}}>Five minutes, fifteen snapshots. Closing your tab doesn't stop the clock.</div>
</li>
<li style={{background: 'var(--card)', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: '#3E4A39', lineHeight: '1'}}>5</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Get ranked</div>
<div style={{color: 'var(--ink-dimmer)', fontSize: '15px', marginTop: '6px'}}>A deterministic score sets your title, from Intern to CEO.</div>
</li>
<li style={{background: 'var(--card)', padding: '26px 22px 30px'}}>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '40px', color: 'var(--lime-ink)', lineHeight: '1'}}>6</div>
<div style={{fontWeight: '600', marginTop: '18px'}}>Payday</div>
<div style={{color: 'var(--ink-dimmer)', fontSize: '15px', marginTop: '6px'}}>Claim your share of the payroll vault, with proof attached.</div>
</li>
</ol>
</section>

<section id="office" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(96px,11vw,160px) clamp(20px,4vw,48px) 0'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '24px 64px', alignItems: 'end'}}>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92'}}>The office is open</h2>
<p style={{margin: '0', color: 'var(--ink-dim)', maxWidth: '46ch'}}>Every desk is an employee and every employee is a live Pons market. Pick a desk to see who's working it and how the shift is going.</p>
</div>

<div ref={teaserRef} style={{marginTop: '32px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden'}}>
{OfficeTeaserC ? <OfficeTeaserC theme={theme} /> : <div style={{height: 220}} />}
</div>

<div style={{marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px'}}>
{desks.map((e, i) => (<Fragment key={i}>
<button type="button" className="desk" onClick={e.pick} aria-pressed={e.pressed} style={{textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', background: e.bg, border: `1px solid ${e.border}`, borderRadius: '18px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '210px'}}>
<span style={{display: 'flex', alignItems: 'center', gap: '12px', width: '100%'}}>
<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" style={{flex: 'none'}}><rect width="44" height="44" rx="11" fill={e.c1} /><circle cx="22" cy="17" r="8" fill={e.c2} /><rect x="9" y="28" width="26" height="16" rx="8" fill={e.c2} /></svg>
<span style={{flex: '1', minWidth: '0'}}>
<span style={{display: 'block', fontWeight: '600', fontSize: '16px', lineHeight: '1.25'}}>{e.name}</span>
<span style={{display: 'block', fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: 'var(--lime-ink)'}}>{e.ticker}</span>
</span>
<span className="tr" style={{fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em', padding: '5px 9px', borderRadius: '999px', whiteSpace: 'nowrap', background: e.chipBg, color: e.chipFg, border: `1px solid ${e.chipBorder}`}}>{e.status}</span>
</span>
<span style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 14px', fontSize: '12px', color: 'var(--ink-dimmer)', width: '100%'}}>
<span>Rank<span style={{display: 'block', color: 'var(--ink)', fontSize: '15px'}}>{e.rank}</span></span>
<span>Score<span style={{display: 'block', color: 'var(--ink)', fontSize: '15px'}}>{e.score}</span></span>
<span>Market cap<span style={{display: 'block', color: 'var(--ink)', fontSize: '15px'}}>{e.mcap} ETH</span></span>
<span>Shift timer<span style={{display: 'block', color: 'var(--ink)', fontSize: '15px'}}>{e.timer}</span></span>
</span>
<span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-soft)', paddingTop: '12px', fontSize: '13px', color: 'var(--ink-dimmer)', width: '100%'}}>
<span>Payroll earned</span>
<span style={{color: 'var(--ink)', fontWeight: '600'}}>{e.pay} ETH</span>
</span>
</button>
</Fragment>))}
</div>

<div style={{marginTop: '14px', background: 'var(--panel)', border: '1px solid var(--border-soft)', borderRadius: '18px', padding: '22px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '18px 36px'}}>
<div style={{flex: '1 1 260px'}}>
<div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Selected desk</div>
<div style={{fontSize: '22px', fontWeight: '600'}}>{sel.name} <span style={{fontFamily: "'Geist Mono', monospace", fontSize: '15px', color: 'var(--lime-ink)'}}>{sel.ticker}</span></div>
<div style={{color: 'var(--ink-dimmer)', fontSize: '14px'}}>{sel.id}, {sel.dept}, {sel.rank}</div>
</div>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
<a href="/office" className="btn-ghost" style={{textDecoration: 'none', color: 'var(--ink)', fontSize: '15px', padding: '0 18px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-soft)', borderRadius: '999px'}}>Open employee profile</a>
<a href="#office" className="btn-lime" style={{textDecoration: 'none', background: '#C8F135', color: '#0F130E', fontWeight: '600', fontSize: '15px', padding: '0 18px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', borderRadius: '999px'}}>View on Pons ↗</a>
</div>
</div>
</section>

<section id="performance" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(96px,11vw,160px) clamp(20px,4vw,48px) 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '56px'}}>
<div>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92'}}>Sustained work gets rewarded</h2>
<p style={{margin: '22px 0 0', color: 'var(--ink-dim)', maxWidth: '46ch'}}>SHIFT scores the whole shift, not the last print. Each metric is normalized, time-weighted, then combined with weights that live in config, not in code.</p>
<div style={{marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '18px'}}>
{weights.map((w, i) => (<Fragment key={i}>
<div>
<div style={{display: 'flex', justifyContent: 'space-between', fontSize: '15px', marginBottom: '8px'}}><span>{w.label}</span><span style={{color: 'var(--lime-ink)', fontWeight: '600'}}>{w.pct}%</span></div>
<div style={{height: '10px', background: 'var(--border-soft)', borderRadius: '5px', overflow: 'hidden'}}>
<div className="wbar" style={{height: '100%', width: `${w.width}%`, background: w.color, borderRadius: '5px'}} />
</div>
</div>
</Fragment>))}
</div>
</div>

<div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
<figure style={{margin: '0', background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '22px', padding: '24px'}}>
<svg viewBox="0 0 520 240" width="100%" role="img" aria-label="A steady token rising across the shift scores higher than a token with one short spike">
<line x1="0" y1="220" x2="520" y2="220" stroke="var(--border-soft)" strokeWidth="1" />
<line x1="0" y1="174" x2="520" y2="174" stroke="#7E8779" strokeWidth="1.5" strokeDasharray="5 6" />
<line x1="0" y1="128" x2="520" y2="128" stroke="#C8F135" strokeWidth="1.5" strokeDasharray="5 6" />
<polyline className="draw" pathLength="1" fill="none" stroke="#7E8779" strokeWidth="2.5" strokeLinejoin="round" points="0,196 60,192 120,195 180,190 230,188 250,34 270,186 330,192 390,194 450,191 520,195" />
<polyline className="draw" pathLength="1" fill="none" stroke="#C8F135" strokeWidth="3" strokeLinejoin="round" points="0,200 52,184 104,170 156,160 208,146 260,138 312,122 364,112 416,98 468,90 520,82" />
</svg>
<figcaption style={{display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: '14px', color: 'var(--ink-dim)', marginTop: '14px'}}>
<span style={{display: 'inline-flex', alignItems: 'center', gap: '8px'}}><span style={{width: '14px', height: '3px', background: '#C8F135', display: 'inline-block'}} />Steady token, higher time-weighted score</span>
<span style={{display: 'inline-flex', alignItems: 'center', gap: '8px'}}><span style={{width: '14px', height: '3px', background: '#7E8779', display: 'inline-block'}} />One-block spike, barely moves the average</span>
</figcaption>
</figure>
<div style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '22px', padding: '24px'}}>
<div style={{fontWeight: '600'}}>Flagged before it counts</div>
<p style={{margin: '6px 0 16px', color: 'var(--ink-dimmer)', fontSize: '15px'}}>Suspicious shifts are excluded with an audit trail. Nobody edits a final score by hand.</p>
<ul style={{listStyle: 'none', margin: '0', padding: '0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px 20px', fontSize: '15px'}}>
{flags.map((f, i) => (<Fragment key={i}>
<li style={{display: 'flex', gap: '10px', alignItems: 'flex-start'}}>
<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{flex: 'none', marginTop: '4px'}}><path d="M4 4l8 8M12 4l-8 8" stroke="#E0A44A" strokeWidth="2" strokeLinecap="round" /></svg>
<span style={{color: 'var(--ink-dim)'}}>{f}</span>
</li>
</Fragment>))}
</ul>
</div>
</div>
</section>

<section id="career" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(96px,11vw,160px) clamp(20px,4vw,48px) 0'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '24px 64px', alignItems: 'end'}}>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92'}}>Eight titles, eight pay grades</h2>
<p style={{margin: '0', color: 'var(--ink-dim)', maxWidth: '46ch'}}>Your score sets your title and your title sets your share of payroll. Promotions are public, deterministic and impossible to miss.</p>
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
<p style={{margin: '0', color: 'var(--ink-dim)', maxWidth: '46ch'}}>Revenue for payroll lands in a transparent vault. Each epoch is finalized with a Merkle root, and you claim your share. Your pay is computed from public inputs, never from admin discretion.</p>
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
<div style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '14px', padding: '18px 20px', fontFamily: "'Geist Mono', monospace", fontSize: '14px', color: 'var(--ink-dim)', lineHeight: '1.8', overflowX: 'auto'}}>
<div><span style={{color: 'var(--ink-dimmer)'}}>employeeShares</span> = performanceWeight × activeTimeWeight</div>
<div><span style={{color: 'var(--ink-dimmer)'}}>employeePayroll</span> = payrollPool × employeeShares / totalEligibleShares</div>
</div>
</div>
</div>
</section>

<section id="proof" style={{maxWidth: '1240px', margin: '0 auto', padding: 'clamp(96px,11vw,160px) clamp(20px,4vw,48px) 0'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '24px 64px', alignItems: 'end'}}>
<h2 style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: '0.92'}}>Don't trust the screenshot</h2>
<p style={{margin: '0', color: 'var(--ink-dim)', maxWidth: '46ch'}}>Every important action in SHIFT links to its transaction. Each finalized shift is hashed onchain, with the full snapshot trail kept for anyone to recompute.</p>
</div>
<div style={{marginTop: '48px', border: '1px solid var(--border-soft)', borderRadius: '20px', overflowX: 'auto'}}>
<div style={{minWidth: '640px'}}>
{proofs.map((p, i) => (<Fragment key={i}>
<div className={p.cls} style={{display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '16px', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)'}}>
<span style={{display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '500', color: 'var(--lime-ink)'}}>
<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5.5 9.2l2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
{p.event}
</span>
<span style={{fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: 'var(--ink-dimmer)'}}>{p.contract}</span>
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
<p style={{margin: '0', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: 'clamp(56px, 9vw, 136px)', lineHeight: '0.88', color: 'var(--ink)'}}>SHIFT runs the company.</p>
<div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 28px', marginTop: '48px'}}>
<a href="/clock-in" className="btn-lime" style={{textDecoration: 'none', background: '#C8F135', color: '#0F130E', fontWeight: '600', fontSize: '17px', padding: '0 30px', minHeight: '56px', display: 'inline-flex', alignItems: 'center', borderRadius: '999px'}}>Clock in</a>
<span style={{color: 'var(--ink-dimmer)'}}>Your next shift starts the moment your token is live.</span>
</div>
</section>

<footer style={{borderTop: '1px solid var(--border)'}}>
<div style={{maxWidth: '1240px', margin: '0 auto', padding: '32px clamp(20px,4vw,48px) 40px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '20px 40px', fontSize: '14px', color: 'var(--ink-dimmer)'}}>
<div style={{display: 'flex', alignItems: 'center', gap: '14px'}}>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '800', fontSize: '22px', color: 'var(--ink)', letterSpacing: '0.04em'}}>SHIFT</span>
<span style={{fontFamily: "'Geist Mono', monospace", color: 'var(--lime-ink)'}}>$SHIFT</span>
</div>
<div style={{display: 'flex', flexWrap: 'wrap', gap: '8px 28px'}}>
<span>Network: Robinhood Chain</span>
<span>Launch layer: Pons</span>
<a className="navlink" href="/leaderboard">Leaderboard</a>
<a className="navlink" href="/payroll">Payroll</a>
</div>
</div>
</footer>

</div>
    </>
  );
}
