"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { PayrollSkeleton } from "../Skeleton";
import AppShell from "../AppShell";
import { CHIP, EXPLORER, LIME, LIME_INK, ago, explorerTx, mmss, ponsToken, short } from "@/lib/format";
import { errorText, post, useApi, useMe } from "@/lib/client";
import { fallbackLook } from "../office3d/mini/fallbackLook";
import { useLazyComponent } from "../office3d/mini/useLazy";

const loadPayday = () => import("../office3d/mini/Payday");

const SN = ["Estimated", "Finalized", "Claimable", "Paid"];
const TX = ["Projected from the live shift. Can still change.", "Epoch closed, Merkle root published onchain.", "Your proof is ready. Claim whenever you like.", "Sent to your wallet, Payroll Claimed emitted."];

export default function PayrollPage() {
  const { me, wallet } = useMe();
  const { data, reload } = useApi<any>(me ? `/api/payroll?employeeId=${me.id}` : "/api/payroll?employeeId=0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shown, setShown] = useState(true);
  const [coinsAt, setCoinsAt] = useState(0);
  const PaydayC = useLazyComponent(loadPayday, !!data && !!me);
  if (!data) return <AppShell active="payroll" title="Payroll"><PayrollSkeleton /></AppShell>;
  const stage = data.stage;
  const f = data.focus;
  const cfg = data.config;
  const paid = stage === 3 && shown;
  const payday = mmss(data.secsToEpoch);
  const epochId = f.epochId;
  const empName = me ? me.name : "no employee";
  const poolStr = f.pool.toFixed(2), sharesStr = (f.shares * 100).toFixed(2) + "%", amountStr = f.amount.toFixed(3);
  const label = ["Estimated pay", "Finalized pay", "Claimable now", "Paid to your wallet"][stage];
  const statusShort = ["Estimate before finalization", "Finalizing, claim opens next", "Ready to claim", "In your wallet"][stage];
  const note = me ? ["Grows with your shift. Not final until the epoch closes.", "Epoch finalized, Merkle root published." + (f.opensIn ? ` Claim opens in ${f.opensIn}s.` : ""), "Your Merkle proof is ready. Claim any time.", `Sent to ${short(wallet)}. Proof recorded onchain.`][stage] : "Clock in to start earning payroll.";
  const stages = SN.map((n, i) => ({ name: n, bg: i === stage ? "#161A14" : i < stage ? "#C9CDBE" : "transparent", fg: i === stage ? LIME : i < stage ? "#161A14" : "#7A8075" }));
  const legend = SN.map((n, i) => ({ name: n, text: TX[i], border: i === stage ? LIME_INK : "var(--line)", bg: i === stage ? "rgba(200,241,53,.06)" : "transparent" }));
  const disabled = stage !== 2 || busy;
  const cursor = stage === 2 ? "pointer" : "not-allowed";
  const btnBg = stage === 2 ? "#161A14" : "#C9CDBE", btnFg = stage === 2 ? LIME : "#5A6156";
  const btn = ["Available after the shift", "Finalizing epoch", "Claim pay", "Pay claimed"][stage];
  const history = data.history.map((h: any) => ({
    epoch: "Epoch " + h.epochId, pool: h.pool.toFixed(2), root: short(h.root), when: ago(h.at, data.now),
    pay: h.mine == null ? "Not employed" : h.mine.toFixed(3) + " ETH" + (h.claimed ? "" : " · unclaimed"), payColor: h.mine == null ? "var(--ink-faint)" : "var(--ink)",
    bg: h.mine != null && !h.claimed ? "rgba(200,241,53,0.06)" : "transparent",
  }));
  const claim = async () => {
    if (!me || stage !== 2) return;
    setBusy(true); setErr("");
    try {
      // 1. Try direct onchain claim via user browser wallet if available
      const { getBrowserWalletClient, CONTRACT_ADDRESSES, ROBINHOOD_TESTNET } = await import("@/lib/chain/client");
      const { PAYROLL_DISTRIBUTOR_ABI } = await import("@/lib/chain/abi");
      const walletClient = getBrowserWalletClient();
      if (walletClient && f?.proof) {
        const [account] = await walletClient.getAddresses();
        if (account) {
          await walletClient.writeContract({
            address: CONTRACT_ADDRESSES.payrollDistributor,
            abi: PAYROLL_DISTRIBUTOR_ABI,
            functionName: "claim",
            args: [BigInt(f.epochId), BigInt(me.id), BigInt(Math.floor(f.amount * 1e18)), f.proof.proof],
            account,
            chain: ROBINHOOD_TESTNET,
          });
        }
      }
      // 2. Sync with internal state
      await post("/api/payroll/claim", { employeeId: me.id, epochId: f.epochId });
      setShown(true);
      setCoinsAt(performance.now());
      await reload();
    } catch (e: unknown) {
      setErr(errorText(e));
    }
    setBusy(false);
  };
  const paydayAnim = paid && performance.now() - coinsAt < 3200 ? "cheer" : stage === 2 ? "bow" : "idle";
  const replay = () => setShown(false);
  return (
    <AppShell active="payroll" title="Payroll">
<main className="vin" style={{padding: 'clamp(20px,3vw,36px)', maxWidth: '1800px', margin: '0 auto'}}>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px'}}>
<div style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Current payroll pool</div><div style={{fontSize: '30px', fontWeight: '600', lineHeight: '1.3'}}>{poolStr} ETH</div><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>PayrollVault, epoch {epochId}</div></div>
<div style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Next payday</div><div style={{fontSize: '30px', fontWeight: '600', lineHeight: '1.3', color: 'var(--lime-ink)'}}>{payday}</div><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Epoch closes and finalizes</div></div>
<div style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Your shares</div><div style={{fontSize: '30px', fontWeight: '600', lineHeight: '1.3'}}>{sharesStr}</div><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Performance × active time</div></div>
<div style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '18px', padding: '18px 20px'}}><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>{label}</div><div style={{fontSize: '30px', fontWeight: '600', lineHeight: '1.3'}}>{amountStr} ETH</div><div style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>{statusShort}</div></div>
</div>

<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '16px', marginTop: '16px', alignItems: 'start'}}>
<section style={{background: '#E4E7DA', color: '#161A14', borderRadius: '16px', padding: 'clamp(24px,3vw,36px)', position: 'relative', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.4)'}}>
<div className="scan" aria-hidden="true" style={{position: 'absolute', left: '0', right: '0', top: '0', height: '26%', background: 'linear-gradient(rgba(200,241,53,0), rgba(200,241,53,.22), rgba(200,241,53,0))', pointerEvents: 'none'}} />
<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #161A14', paddingBottom: '12px'}}>
<span style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: '42px', letterSpacing: '0.04em', lineHeight: '1'}}>PAYDAY</span>
<span style={{fontSize: '14px', color: '#4A5146'}}>Epoch {epochId}, {empName}</span>
</div>
{me && PaydayC && <PaydayC look={me.look || fallbackLook()} anim={paydayAnim} coinsAt={coinsAt} />}
<div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '22px', marginTop: '22px'}}>
<div><div style={{fontSize: '13px', color: '#5A6156'}}>Payroll pool</div><div style={{fontSize: '30px', fontWeight: '600'}}>{poolStr} ETH</div></div>
<div><div style={{fontSize: '13px', color: '#5A6156'}}>Your shares</div><div style={{fontSize: '30px', fontWeight: '600'}}>{sharesStr}</div></div>
</div>
<div style={{marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #A9AE9C', position: 'relative'}}>
<div style={{fontSize: '13px', color: '#5A6156'}}>{label}</div>
<div style={{fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: '76px', lineHeight: '1'}}>{amountStr} ETH</div>
{paid && (<>
<div className="stamp4" style={{position: 'absolute', right: '0', top: '18px', border: '3px solid #4C7A0B', color: '#4C7A0B', padding: '4px 14px', borderRadius: '6px', fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: '900', fontSize: '34px', letterSpacing: '0.06em', background: 'rgba(200,241,53,.35)', transform: 'rotate(-8deg)'}}>PAID</div>
</>)}
</div>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px', marginTop: '22px'}} aria-label="Payroll status">
{stages.map((s, i) => (<Fragment key={i}>
<div className="tr" style={{textAlign: 'center', fontSize: '13px', fontWeight: '600', padding: '9px 4px', borderRadius: '8px', background: s.bg, color: s.fg}}>{s.name}</div>
</Fragment>))}
</div>
<button type="button" className="tr" onClick={claim} disabled={disabled} style={{marginTop: '20px', width: '100%', minHeight: '54px', border: '0', borderRadius: '999px', font: 'inherit', fontWeight: '600', fontSize: '16px', cursor: cursor, background: btnBg, color: btnFg}}>{btn}</button>
<p style={{margin: '12px 0 0', fontSize: '13px', color: '#5A6156', textAlign: 'center'}}>{note}</p>
{paid && (<>
<p style={{margin: '6px 0 0', textAlign: 'center'}}><button type="button" onClick={replay} style={{background: 'none', border: '0', padding: '0', font: 'inherit', fontSize: '13px', color: '#4A5146', textDecoration: 'underline', cursor: 'pointer', minHeight: '44px'}}>Dismiss</button></p>
</>)}
</section>

<div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
<section style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '22px', padding: '22px'}}>
<h2 style={{margin: '0 0 12px', fontSize: '17px', fontWeight: '600'}}>What each status means</h2>
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px'}}>
{legend.map((l, i) => (<Fragment key={i}>
<div className="tr" style={{border: `1px solid ${l.border}`, background: l.bg, borderRadius: '14px', padding: '14px 16px', fontSize: '14px', color: 'var(--ink-dimmer)'}}><span style={{display: 'block', color: 'var(--ink)', fontWeight: '600', fontSize: '15px'}}>{l.name}</span>{l.text}</div>
</Fragment>))}
</div>
</section>
<section style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '22px', padding: '22px'}}>
<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px'}}><h2 style={{margin: '0', fontSize: '17px', fontWeight: '600'}}>Revenue allocation</h2><span style={{fontSize: '13px', color: 'var(--ink-dimmer)'}}>Set in protocol config</span></div>
<div style={{display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', marginTop: '14px'}}><span className="grow" style={{width: `${cfg.payrollPct}%`, background: '#C8F135'}} /><span style={{width: `${cfg.treasuryPct}%`, background: 'var(--line-strong)'}} /></div>
<div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px', fontSize: '14px', marginTop: '8px'}}><span>Employee payroll pool <span style={{color: 'var(--ink-dimmer)'}}>{cfg.payrollPct}%</span></span><span>Protocol treasury <span style={{color: 'var(--ink-dimmer)'}}>{cfg.treasuryPct}%</span></span></div>
</section>
<div style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '14px', padding: '18px 20px', fontFamily: "'Geist Mono', monospace", fontSize: '14px', color: 'var(--ink-soft)', lineHeight: '1.8', overflowX: 'auto'}}>
<div><span style={{color: 'var(--ink-dimmer)'}}>employeeShares</span> = performanceWeight × activeTimeWeight</div>
<div><span style={{color: 'var(--ink-dimmer)'}}>employeePayroll</span> = payrollPool × employeeShares / totalEligibleShares</div>
</div>
</div>
</div>

<div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px 20px', margin: '36px 0 14px'}}>
<h2 style={{margin: '0', fontSize: '20px', fontWeight: '600'}}>Previous payrolls</h2>
<span style={{fontSize: '14px', color: 'var(--ink-dimmer)'}}>Every epoch is reproducible from public inputs</span>
</div>
<div style={{background: 'var(--card)', border: '1px solid var(--border-soft)', borderRadius: '20px', overflowX: 'auto'}}>
<div style={{minWidth: '760px'}}>
<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr 1fr 1fr 0.8fr', gap: '14px', padding: '12px 18px', borderBottom: '1px solid var(--line)', fontSize: '13px', color: 'var(--ink-dimmer)'}}>
<span>Epoch</span><span style={{textAlign: 'right'}}>Payroll pool</span><span>Merkle root</span><span>Finalized</span><span style={{textAlign: 'right'}}>Your pay</span><span />
</div>
{history.map((h, i) => (<Fragment key={i}>
<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr 1fr 1fr 0.8fr', gap: '14px', padding: '14px 18px', borderBottom: '1px solid var(--border)', alignItems: 'center', background: h.bg}}>
<span style={{fontWeight: '500'}}>{h.epoch}</span>
<span style={{textAlign: 'right'}}>{h.pool} ETH</span>
<span style={{fontFamily: "'Geist Mono', monospace", fontSize: '13px'}}>{h.root}</span>
<span style={{color: 'var(--ink-dim)'}}>{h.when}</span>
<span style={{textAlign: 'right', color: h.payColor}}>{h.pay}</span>
<Link href="/proof" style={{fontSize: '14px'}}>Proof ↗</Link>
</div>
</Fragment>))}
</div>
</div>
</main>
      {err && <p style={{ padding: "0 clamp(20px,3vw,36px)", color: "var(--amber-ink)" }}>{err}</p>}
    </AppShell>
  );
}
