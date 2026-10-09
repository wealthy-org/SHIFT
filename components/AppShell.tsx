"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { mmss, short } from "@/lib/format";
import { useMe } from "@/lib/client";
import { useTheme } from "@/lib/useTheme";

const IC = { fill: "none", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONS: Record<string, string> = {
  office: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
  desk: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  leaderboard: "M8 21V11M12 21V4M16 21v-7M4 21h16",
  payroll: "M3 7h18v12H3zM3 11h18M7 15h4",
  proof: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM8.5 12l2.5 2.5 4.5-5",
};

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="btn-ghost" style={{ background: "transparent", cursor: "pointer", color: "var(--ink)", width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-soft)", borderRadius: 999, flex: "none" }}>
      {theme === "dark" ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.8 14.3A9 9 0 1 1 9.7 3.2a7 7 0 0 0 11.1 11.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
      )}
    </button>
  );
}

export default function AppShell({ active, title, subtitle, actions, children, overlay }: { active: string; title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; overlay?: ReactNode }) {
  const { me, wallet, secsToEpoch } = useMe();
  const deskHref = me ? `/employee/${me.id}` : "/clock-in";
  const nav = [
    ["office", "/office", "Office"],
    ["desk", deskHref, "My desk"],
    ["leaderboard", "/leaderboard", "Leaderboard"],
    ["payroll", "/payroll", "Payroll"],
    ["proof", "/proof", "Proof"],
  ];
  return (
    <div className="sh sh-app" style={{ background: "var(--bg)", color: "var(--ink)", fontFamily: "'Geist', 'Helvetica Neue', Helvetica, sans-serif", fontSize: 16, lineHeight: 1.55, minHeight: "100vh", display: "flex", flexWrap: "wrap", fontVariantNumeric: "tabular-nums", position: "relative" }}>
      <aside className="appside" style={{ flex: "1 1 232px", background: "var(--inset)", borderRight: "1px solid var(--border)", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
        <Link href="/" style={{ textDecoration: "none", color: "var(--ink)", display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 20px" }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: "#C8F135", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="#0F130E" strokeWidth="2" /><path d="M8 4.5V8l2.4 1.6" fill="none" stroke="#0F130E" strokeWidth="2" strokeLinecap="round" /></svg>
          </span>
          <span style={{ fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "0.04em" }}>SHIFT</span>
        </Link>
        <nav aria-label="App" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.map(([k, href, label]) => {
            const on = k === active;
            return (
              <Link key={k} className="nav" href={href} aria-current={on ? "page" : undefined} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 12, textDecoration: "none", minHeight: 44, background: on ? "var(--raise)" : undefined, color: on ? "var(--ink)" : "var(--ink-dim)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" stroke={on ? "var(--lime-ink)" : "currentColor"} aria-hidden="true" {...IC}><path d={ICONS[k]} /></svg>
                {label}
              </Link>
            );
          })}
        </nav>
        <div style={{ flex: 1, minHeight: 24 }} />
        <Link href={deskHref} style={{ border: "1px solid var(--line)", borderRadius: 16, padding: 14, display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "var(--ink)" }}>
          <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden="true" style={{ flex: "none" }}><rect width="44" height="44" rx="11" fill={me?.c1 || "var(--track)"} /><circle cx="22" cy="17" r="8" fill={me?.c2 || "var(--ink-ghost)"} /><rect x="9" y="28" width="26" height="16" rx="8" fill={me?.c2 || "var(--ink-ghost)"} /></svg>
          <span>
            <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{me ? me.name : "Not clocked in"}</span>
            <span style={{ display: "block", fontSize: 13, color: "var(--ink-dimmer)" }}>{me ? `${me.code}, ${me.rank}` : "Connect and clock in"}</span>
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-dimmer)", padding: "12px 6px 0" }}>
          <span className="live" style={{ width: 8, height: 8, borderRadius: "50%", background: "#C8F135", display: "inline-block" }} />
          Next payday <span style={{ color: "var(--ink)", fontWeight: 600 }}>{secsToEpoch == null ? "--:--" : mmss(secsToEpoch)}</span>
        </div>
      </aside>
      <div style={{ flex: "999 1 560px", minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 16px", padding: "16px clamp(18px,3vw,36px)", borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ margin: 0, flex: subtitle ? "0 0 auto" : "1 1 auto", fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif", fontWeight: 800, fontSize: 34, lineHeight: 1 }}>{title}</h1>
          {subtitle && <div style={{ flex: "1 1 auto", color: "var(--ink-dim)", fontSize: 15, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{subtitle}</div>}
          {actions}
          <span title="Simulated Pons market on a simulated chain. No real funds." style={{ border: "1px dashed var(--line-strong)", borderRadius: 999, padding: "6px 10px", fontSize: 12, color: "var(--ink-dimmer)" }}>Testnet · simulated market</span>
          <ThemeToggle />
          {wallet ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 999, padding: "8px 14px", fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C8F135", display: "inline-block" }} />
              {short(wallet)}
            </span>
          ) : (
            <Link href="/clock-in" className="btng" style={{ textDecoration: "none", color: "var(--ink)", border: "1px solid var(--line-strong)", borderRadius: 999, padding: "8px 14px", fontSize: 14 }}>Connect wallet</Link>
          )}
        </div>
        {children}
      </div>
      {overlay}
    </div>
  );
}
