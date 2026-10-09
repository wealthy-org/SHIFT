"use client";

import { useEffect, useState } from "react";
import { TestnetSkeleton } from "../Skeleton";
import AppShell from "../AppShell";
import { errorText, post, useApi } from "@/lib/client";
import { ago } from "@/lib/format";

const PROFILES: [string, string, string][] = [
  ["normal", "Normal launch", "Typical organic trading"],
  ["high", "High volume", "Heavy buying from many wallets"],
  ["low", "Low volume", "Quiet market, few trades"],
  ["pumpdump", "Pump then dump", "One whale spikes the cap, then exits"],
  ["wash", "Wash trading", "Self trades, circular flow, sybil cluster"],
  ["liqmanip", "Liquidity manipulation", "Liquidity in before close, out right after"],
];
const TOKEN_KEY = "shift.admin.token";
const card = { background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: 20, padding: 22 } as const;
const btn = { background: "transparent", color: "var(--ink)", font: "inherit", fontSize: 14, padding: "0 16px", minHeight: 44, border: "1px solid var(--line-strong)", borderRadius: 999, cursor: "pointer" } as const;

export default function TestnetPage() {
  const [token, setToken] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    try { setToken(localStorage.getItem(TOKEN_KEY) ?? ""); } catch { setToken(""); }
  }, []);
  const headers = token ? { "x-admin-token": token } : undefined;
  const { data, error, reload } = useApi<any>(token === null ? null : "/api/testnet", 1000, false, headers);
  const [out, setOut] = useState<any>(null);

  const saveToken = (v: string) => {
    const t = v.trim();
    try { localStorage.setItem(TOKEN_KEY, t); } catch {}
    setToken(t);
  };

  if (error === "ADMIN_FORBIDDEN" || error === "ADMIN_DISABLED") {
    return (
      <AppShell active="" title="Testnet console">
        <main style={{ padding: "clamp(20px,3vw,36px)", maxWidth: 560 }}>
          <div style={{ ...card, padding: 24 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{error === "ADMIN_DISABLED" ? "Console disabled" : "Admin token required"}</h2>
            <p style={{ margin: "8px 0 0", color: "var(--ink-dimmer)", fontSize: 14 }}>
              {error === "ADMIN_DISABLED"
                ? "This deployment has no ADMIN_TOKEN set, so the scenario controls stay closed."
                : "These controls spawn employees and inject failures, so they are kept behind the ADMIN_TOKEN from the server env."}
            </p>
            {error === "ADMIN_FORBIDDEN" && (
              <form onSubmit={(ev) => { ev.preventDefault(); saveToken(draft); }} style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <input type="password" value={draft} onChange={(ev) => setDraft(ev.target.value)} placeholder="Admin token" aria-label="Admin token"
                  style={{ flex: "1 1 220px", minHeight: 44, padding: "0 14px", borderRadius: 999, border: "1px solid var(--line-strong)", background: "var(--inset)", color: "var(--ink)", font: "inherit" }} />
                <button type="submit" style={{ ...btn, background: "#C8F135", color: "#0F130E", border: 0, fontWeight: 600 }}>Unlock</button>
              </form>
            )}
          </div>
        </main>
      </AppShell>
    );
  }
  if (!data) return <AppShell active="" title="Testnet console"><TestnetSkeleton /></AppShell>;
  const act = async (action: string, profile?: string) => {
    setErr("");
    try {
      const r = await post("/api/testnet", { action, profile }, headers);
      setOut(r.tries ? { action, tries: r.tries, epoch: r.epoch } : null);
      reload();
    } catch (e: unknown) {
      setErr(errorText(e));
    }
  };
  const inv = data.invariants;
  const ok = inv.overpaidEpochs === 0 && inv.claimedMatchesLeaves;
  return (
    <AppShell active="" title="Testnet console">
      <main className="vin" style={{ padding: "clamp(20px,3vw,36px)", maxWidth: 1800, margin: "0 auto", display: "grid", gap: 16 }}>
        <p style={{ margin: 0, color: "var(--ink-dim)", maxWidth: "70ch" }}>
          Scenario controls for the phase 6 checklist. Spawned employees run a real shift through the same scoring, anti-manipulation and payroll code as everyone else.
        </p>
        <section style={card}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Spawn a simulated employee</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
            {PROFILES.map(([k, label, hint]) => (
              <button key={k} type="button" className="wopt" onClick={() => act("spawn", k)} style={{ textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer", background: "var(--inset)", border: "1px solid var(--line)", borderRadius: 14, padding: 14 }}>
                <span style={{ display: "block", fontWeight: 600 }}>{label}</span>
                <span style={{ display: "block", fontSize: 13, color: "var(--ink-dimmer)" }}>{hint}</span>
              </button>
            ))}
          </div>
        </section>
        <section style={card}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Failure injection</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button type="button" className="btng" style={btn} onClick={() => act("rpc")}>{data.toggles.rpcDown ? "RPC down: click to restore" : "Take RPC down (missed snapshots)"}</button>
            <button type="button" className="btng" style={btn} onClick={() => act("failLaunch")}>{data.toggles.failNextLaunch ? "Next launch will revert (armed)" : "Revert the next Pons launch"}</button>
            <button type="button" className="btng" style={btn} onClick={() => act("reorg")}>Simulate chain reorg</button>
            <button type="button" className="btng" style={btn} onClick={() => act("doubleClaim")}>Attempt double claim</button>
          </div>
          {out && (
            <div style={{ marginTop: 14, fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "var(--ink-soft)" }}>
              Epoch {out.epoch}:
              {Object.entries(out.tries).map(([k, v]) => (<div key={k}>{k}: {String(v)}</div>))}
            </div>
          )}
        </section>
        <section style={card}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Invariants <span style={{ fontSize: 13, color: ok ? "var(--lime-ink)" : "var(--amber-ink)" }}>{ok ? "all holding" : "CHECK"}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, fontSize: 13, color: "var(--ink-dimmer)" }}>
            {([
              ["Epochs finalized", inv.epochsFinalized], ["Overpaid epochs", inv.overpaidEpochs], ["Vault funded", inv.vaultFunded.toFixed(3) + " ETH"], ["Vault claimed", inv.vaultClaimed.toFixed(3) + " ETH"],
              ["Claims reconcile", inv.claimedMatchesLeaves ? "yes" : "NO"], ["Carry-over", inv.carry.toFixed(6) + " ETH"], ["Active shifts", inv.activeShifts], ["Completed shifts", inv.completedShifts], ["Excluded shifts", inv.invalidShifts], ["Chain head", data.head.toLocaleString("en-US")],
            ] as [string, any][]).map(([k, v]) => (
              <div key={k} style={{ background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" }}>{k}<div style={{ color: "var(--ink)", fontSize: 18, fontWeight: 600 }}>{v}</div></div>
            ))}
          </div>
        </section>
        {data.tests.length > 0 && (
          <section style={{ ...card, overflowX: "auto" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Scenario results</h2>
            <div style={{ minWidth: 700, fontSize: 14 }}>
              {data.tests.map((t: any) => (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr 0.5fr 2fr", gap: 12, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  <span>{t.label} <span style={{ color: "var(--ink-dimmer)" }}>{t.code}</span></span>
                  <span style={{ color: t.status === "INVALID" ? "var(--amber-ink)" : t.status === "COMPLETED" ? "var(--lime-ink)" : "var(--ink-dim)" }}>{t.status}</span>
                  <span>{t.score != null ? t.score.toFixed(1) : "-"}</span>
                  <span style={{ color: "var(--ink-dimmer)", fontFamily: "'Geist Mono', monospace", fontSize: 12 }}>{[...new Set(t.flags as string[])].join(", ") || "no flags"}{t.reason ? ` · ${t.reason}` : ""}{t.rawVolume != null ? ` · raw ${t.rawVolume.toFixed(1)} / counted ${t.counted.toFixed(1)} ETH` : ""}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {err && <p style={{ color: "var(--amber-ink)", margin: 0 }}>{err}</p>}
        <section style={card}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Backend log</h2>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "var(--ink-dimmer)", display: "grid", gap: 4 }}>
            {data.log.map((l: any, i: number) => (<div key={i}>{ago(l.ts, data.now)} · {l.msg}</div>))}
            {!data.log.length && <div>Nothing yet.</div>}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
