"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import AppShell from "../AppShell";
import { Sk } from "../Skeleton";
import type { Fx, Preset } from "../office3d/OfficeScene";
import type { OfficeEmployee, OfficeEvent } from "@/lib/engine/office3d";
import { useMe } from "@/lib/client";
import { LIME, ago, mmss, short } from "@/lib/format";
import { useIsCompact, useOfficeStream, usePageVisible, useReducedMotion } from "@/lib/useOffice";

const OfficeCanvas = dynamic(() => import("../office3d/OfficeScene"), { ssr: false, loading: () => null });

const AMBER = "#E0A44A";
const DISPLAY = "'Big Shoulders Display', 'Arial Narrow', sans-serif";
const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: "#151A13", border: "1px solid #263023", borderRadius: 22 };
const PRESETS: readonly Preset[] = ["Overview", "Follow", "Status wall", "Payroll board"];
const VIEWS = ["3D office", "List view"] as const;

const REACTS: [string, string][] = [
  ["Employee registered", "Appears at reception"],
  ["Pons launch confirmed", "Walks to the assigned desk"],
  ["Shift active", "Types, monitor on, countdown runs"],
  ["Market snapshot", "Monitor updates with new numbers"],
  ["Promotion confirmed", "Cheers, confetti, new title badge"],
  ["Shift completed", "Stops work, walks to the break area"],
  ["Payroll epoch finalized", "Payroll board turns claimable"],
  ["Claim confirmed", "Payday coins, proof link in the feed"],
  ["Pending or reverted", "Dashed amber, no movement until final"],
];

const STATUS_STYLE: Record<string, [string, string, string]> = {
  WORKING: ["rgba(200,241,53,0.12)", LIME, "rgba(200,241,53,0.35)"],
  "CLOCKED IN": ["transparent", "#C9D0C2", "#4A5446"],
  PROMOTED: [LIME, "#0F130E", LIME],
  "SHIFT COMPLETE": ["#2A3127", "#E9EDE2", "#3A4436"],
  PAID: ["#E4E7DA", "#0F130E", "#E4E7DA"],
  LAUNCHING: ["rgba(224,164,74,0.12)", AMBER, "rgba(224,164,74,0.45)"],
  HIRED: ["transparent", "#AEB7A8", "#3A4436"],
};

function Chip({ status }: { status: string }) {
  const [bg, fg, b] = STATUS_STYLE[status] || STATUS_STYLE.HIRED;
  return <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap", background: bg, color: fg, border: `1px ${status === "LAUNCHING" ? "dashed" : "solid"} ${b}` }}>{status}</span>;
}

function Hud({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ background: "rgba(18,23,16,.88)", backdropFilter: "blur(6px)", border: "1px solid #2A3227", borderRadius: 12, padding: "8px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "#8E978A", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.35, whiteSpace: "nowrap" }}>{children}</div>
    </div>
  );
}

function Seg<T extends string>({ items, value, onPick, disabled, label }: { items: readonly T[]; value: T; onPick: (v: T) => void; disabled?: (v: T) => boolean; label: string }) {
  return (
    <div role="group" aria-label={label} style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, background: "rgba(18,23,16,.9)", border: "1px solid #2A3227", borderRadius: 999, padding: 4 }}>
      {items.map((v) => {
        const on = v === value;
        const off = disabled?.(v);
        return (
          <button key={v} type="button" className="segb" aria-pressed={on} disabled={off} onClick={() => onPick(v)}
            style={{ border: 0, cursor: off ? "not-allowed" : "pointer", font: "inherit", fontSize: 14, padding: "7px 13px", minHeight: 36, borderRadius: 999, background: on ? "#E9EDE2" : "transparent", color: on ? "#0F130E" : off ? "#5F685B" : "#AEB7A8", fontWeight: on ? 600 : 400 }}>
            {v}
          </button>
        );
      })}
    </div>
  );
}

function Banner({ tone, children, action }: { tone: "amber" | "red"; children: ReactNode; action?: ReactNode }) {
  const c = tone === "amber" ? AMBER : "#E46B5A";
  return (
    <div role="status" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px", background: "rgba(15,19,14,.92)", border: `1px dashed ${c}`, color: c, borderRadius: 12, padding: "10px 14px", fontSize: 14 }}>
      <span style={{ flex: "1 1 260px" }}>{children}</span>
      {action}
    </div>
  );
}

function Details({ e, onClose, onFollow, following }: { e: OfficeEmployee; onClose: () => void; onFollow: () => void; following: boolean }) {
  const rows: [string, ReactNode][] = [
    ["Wallet", <span key="w" style={{ fontFamily: MONO }}>{short(e.wallet)}</span>],
    ["Pons token", e.token ? <span key="t" style={{ fontFamily: MONO }}>{short(e.token)}</span> : "Not launched"],
    ["Rank", e.rank],
    ["Score", <span key="s" style={{ color: LIME }}>{e.score.toFixed(1)}</span>],
    ["Shift timer", e.pose === "working" ? `${mmss(e.secs)} · ${mmss(e.left)} left` : e.shiftCode ? "Off shift" : "No shift yet"],
    ["Market cap", `${e.mcap.toFixed(1)} ETH`],
    ["Volume", `${e.volume.toFixed(1)} ETH`],
    ["Holders and traders", String(e.holders)],
    ["Estimated pay", <span key="ep">{e.estPay.toFixed(3)} ETH <span style={{ color: "#8E978A", fontSize: 12 }}>estimated</span></span>],
    ["Verified earnings", <span key="ve">{e.earned.toFixed(3)} ETH <span style={{ color: "#8E978A", fontSize: 12 }}>finalized</span></span>],
  ];
  return (
    <section aria-label="Employee details" className="vin" style={{ ...card, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <svg width="48" height="48" viewBox="0 0 44 44" aria-hidden="true" style={{ flex: "none" }}>
          <rect width="44" height="44" rx="11" fill={e.look.shirt} />
          <circle cx="22" cy="17" r="8" fill={e.look.skin} />
          <rect x="9" y="28" width="26" height="16" rx="8" fill={e.look.skin} />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 19, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
          <div style={{ fontSize: 13, color: "#8E978A" }}><span style={{ fontFamily: MONO, color: LIME }}>{e.ticker}</span> · {e.code}{e.sim && " · SIM"}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" style={{ background: "none", border: "1px solid #3A4436", color: "#AEB7A8", borderRadius: 999, width: 36, height: 36, cursor: "pointer", fontSize: 16, flex: "none" }}>×</button>
      </div>
      <div style={{ marginTop: 12 }}><Chip status={e.status} /></div>
      <dl style={{ margin: "16px 0 0", display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 14 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt style={{ color: "#8E978A" }}>{k}</dt>
            <dd style={{ margin: 0, textAlign: "right" }}>{v}</dd>
          </div>
        ))}
      </dl>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
        <Link href={`/employee/${e.id}`} className="btnl" style={{ textDecoration: "none", background: LIME, color: "#0F130E", fontWeight: 600, fontSize: 14, padding: "0 16px", minHeight: 42, display: "inline-flex", alignItems: "center", borderRadius: 999 }}>Open profile</Link>
        <button type="button" className="btng" onClick={onFollow} aria-pressed={following} style={{ background: following ? "#1D251A" : "transparent", color: "#E9EDE2", font: "inherit", fontSize: 14, padding: "0 16px", minHeight: 42, border: `1px solid ${following ? LIME : "#3A4436"}`, borderRadius: 999, cursor: "pointer" }}>{following ? "Following" : "Follow"}</button>
        <Link href="/proof" className="btng" style={{ textDecoration: "none", color: "#E9EDE2", fontSize: 14, padding: "0 16px", minHeight: 42, display: "inline-flex", alignItems: "center", border: "1px solid #3A4436", borderRadius: 999 }}>Proof ↗</Link>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 12, color: "#6E776A" }}>Updated {ago(e.updatedAt, Date.now())}</p>
    </section>
  );
}

function Feed({ events }: { events: OfficeEvent[] }) {
  return (
    <section aria-label="Recent events" style={{ ...card, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid #2E382A", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Recent events</h2>
        <span style={{ fontSize: 13, color: "#8E978A" }}>By sequence</span>
      </div>
      {!events.length && <p style={{ margin: 0, padding: 18, color: "#8E978A", fontSize: 14 }}>Nothing yet. Events appear here as they are recorded.</p>}
      <ol style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 460, overflowY: "auto" }}>
        {events.map((ev) => {
          const ok = ev.confirmation === "confirmed";
          return (
            <li key={ev.seq} className={ok ? undefined : "flash"} style={{ padding: "13px 18px", borderBottom: "1px solid #222A20", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "4px 12px", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{ev.label}{ev.extra && <span style={{ fontWeight: 400, color: "#AEB7A8" }}> {ev.extra}</span>}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: ok ? LIME : AMBER, border: `1px ${ok ? "solid" : "dashed"} ${ok ? "rgba(200,241,53,.5)" : AMBER}` }}>{ok ? "Confirmed" : "Pending"}</span>
              <span style={{ fontSize: 13, color: "#8E978A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{ev.seq} {ev.who}, block {ev.block.toLocaleString("en-US")}</span>
              <Link href="/proof" style={{ fontFamily: MONO, fontSize: 12 }}>{short(ev.tx)} ↗</Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Roster({ list, selectedId, onSelect }: { list: OfficeEmployee[]; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <section aria-label="Office roster" style={{ ...card, overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ color: "#8E978A", fontSize: 13, textAlign: "left" }}>
            {["Employee", "Status", "Rank", "Score", "Market cap", "Shift", "Earned"].map((h, i) => (
              <th key={h} scope="col" style={{ padding: "14px 18px", fontWeight: 500, borderBottom: "1px solid #2E382A", textAlign: i > 2 ? "right" : "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((e) => (
            <tr key={e.id} onClick={() => onSelect(e.id)} className="lrow" style={{ cursor: "pointer", background: e.id === selectedId ? "#1A2117" : "transparent" }}>
              <td style={{ padding: "12px 18px", borderBottom: "1px solid #222A20" }}>
                <button type="button" onClick={() => onSelect(e.id)} style={{ background: "none", border: 0, padding: 0, color: "inherit", font: "inherit", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontWeight: 600 }}>{e.name}</span> <span style={{ fontFamily: MONO, fontSize: 12, color: LIME }}>{e.ticker}</span>{e.sim && <span style={{ fontSize: 11, color: "#8E978A" }}> SIM</span>}
                </button>
              </td>
              <td style={{ padding: "12px 18px", borderBottom: "1px solid #222A20" }}><Chip status={e.status} /></td>
              <td style={{ padding: "12px 18px", borderBottom: "1px solid #222A20" }}>{e.rank}</td>
              <td style={{ padding: "12px 18px", borderBottom: "1px solid #222A20", textAlign: "right", color: LIME }}>{e.score.toFixed(1)}</td>
              <td style={{ padding: "12px 18px", borderBottom: "1px solid #222A20", textAlign: "right" }}>{e.mcap.toFixed(1)} ETH</td>
              <td style={{ padding: "12px 18px", borderBottom: "1px solid #222A20", textAlign: "right", fontFamily: MONO, fontSize: 13 }}>{e.pose === "working" ? mmss(e.secs) : "—"}</td>
              <td style={{ padding: "12px 18px", borderBottom: "1px solid #222A20", textAlign: "right" }}>{e.earned.toFixed(3)} ETH</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && <p style={{ padding: 18, margin: 0, color: "#8E978A" }}>Nobody has clocked in yet.</p>}
    </section>
  );
}

export default function Office3DPage() {
  const { scene, link, lastAt, reconnect } = useOfficeStream();
  const { me } = useMe(5000);
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const compact = useIsCompact();
  const [view, setView] = useState<"3D office" | "List view">("3D office");
  const [preset, setPreset] = useState<Preset>("Overview");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [floor, setFloor] = useState(0);
  const [zoomCmd, setZoomCmd] = useState({ n: 0, factor: 1 });
  const [fx, setFx] = useState<Fx>({});
  const [boardFlashAt, setBoardFlashAt] = useState(0);
  const [tick, setTick] = useState(0);
  const seen = useRef<Set<number> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Animations follow confirmed events only, and each event plays once. On the
  // first snapshot everything already on record is marked seen, so a refresh or
  // reconnect never replays old promotions or paydays.
  useEffect(() => {
    if (!scene) return;
    const confirmed = scene.events.filter((e) => e.confirmation === "confirmed");
    if (!seen.current) {
      seen.current = new Set(confirmed.map((e) => e.seq));
      return;
    }
    if (link !== "live") return;
    const now = performance.now();
    let changed = false;
    const next: Fx = { ...fx };
    for (const ev of [...confirmed].reverse()) {
      if (seen.current.has(ev.seq)) continue;
      seen.current.add(ev.seq);
      const id = ev.employeeId;
      if (ev.type === "rank.updated" && id != null) {
        next[id] = { ...next[id], cheerAt: now, badge: ev.to || "promoted", badgeAt: now };
        changed = true;
      } else if (ev.type === "payroll.claimed" && id != null) {
        next[id] = { ...next[id], payoutAt: now };
        changed = true;
      } else if (ev.type === "payroll.finalized") {
        setBoardFlashAt(now);
      }
    }
    if (changed) setFx(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const employees = scene?.employees ?? [];
  const selected = employees.find((e) => e.id === selectedId) || null;
  const floors = scene?.floors ?? 1;
  const per = scene?.desksPerFloor ?? 16;
  const onFloor = employees.filter((e) => (e.desk >= 0 ? Math.floor(e.desk / per) === floor : floor === 0));
  const desksUsed = onFloor.filter((e) => e.desk >= 0).length;
  const stale = !!scene?.stale;
  const disconnected = !!scene && link === "disconnected";
  const empty = !!scene && employees.length === 0;
  const hud = scene?.hud;
  const sinceSync = lastAt ? Math.max(0, Math.round((Date.now() - lastAt) / 1000)) : 0;
  void tick;

  // Keep the selected person on screen when they move floors.
  useEffect(() => {
    if (selected && selected.desk >= 0) setFloor(Math.floor(selected.desk / per));
  }, [selected?.desk, per]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (preset === "Follow" && selectedId == null) setPreset("Overview");
  }, [preset, selectedId]);

  const roster = useMemo(() => [...employees].sort((a, b) => (b.pose === "working" ? 1 : 0) - (a.pose === "working" ? 1 : 0) || b.score - a.score), [employees]);

  const subtitle = scene ? (
    <>
      <span>Floor {floor + 1} of {floors}, {desksUsed} of {per} desks in use</span>
      {floors > 1 && (
        <span style={{ display: "inline-flex", gap: 4 }}>
          <button type="button" className="btng" disabled={floor === 0} onClick={() => setFloor((f) => Math.max(0, f - 1))} aria-label="Previous floor" style={{ background: "transparent", color: "#E9EDE2", border: "1px solid #3A4436", borderRadius: 999, width: 32, height: 32, cursor: "pointer" }}>‹</button>
          <button type="button" className="btng" disabled={floor >= floors - 1} onClick={() => setFloor((f) => Math.min(floors - 1, f + 1))} aria-label="Next floor" style={{ background: "transparent", color: "#E9EDE2", border: "1px solid #3A4436", borderRadius: 999, width: 32, height: 32, cursor: "pointer" }}>›</button>
        </span>
      )}
    </>
  ) : (
    <span>Loading floor plan…</span>
  );

  return (
    <AppShell active="office" title="Office" subtitle={subtitle} actions={<Seg<(typeof VIEWS)[number]> label="View" items={VIEWS} value={view} onPick={setView} />}>
      <main className="vin" style={{ padding: "clamp(16px,2.6vw,32px)", maxWidth: 1800, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 16, alignItems: "start" }} className="o3-grid">
          <div style={{ display: "grid", gap: 16, minWidth: 0 }} className="o3-main">
            {view === "3D office" ? (
              <section role="region" aria-label="Isometric office" style={{ ...card, position: "relative", overflow: "hidden", height: compact ? "min(70vh, 560px)" : "clamp(520px, 68vh, 820px)", background: "#0F130E" }}>
                {scene && (
                  <OfficeCanvas
                    scene={scene}
                    floor={floor}
                    selectedId={selectedId}
                    onSelect={(id) => setSelectedId(id)}
                    preset={preset}
                    zoomCmd={zoomCmd}
                    fx={fx}
                    boardFlashAt={boardFlashAt}
                    compact={compact}
                    reduced={reduced}
                    paused={!visible}
                    frozen={disconnected || stale}
                  />
                )}

                {/* HUD */}
                {hud && (
                  <div style={{ position: "absolute", left: 14, right: 14, top: 14, display: "flex", flexWrap: "wrap", gap: 8, pointerEvents: "none" }}>
                    <Hud label="Active employees">{hud.active}</Hud>
                    <Hud label="Next shift ends">{hud.nextShift ? <><span style={{ color: LIME }}>{mmss(hud.nextShift.secs)}</span> <span style={{ fontSize: 13, fontWeight: 500, color: "#AEB7A8" }}>{hud.nextShift.name}</span></> : <span style={{ color: "#6E776A" }}>—</span>}</Hud>
                    <Hud label="Payroll epoch">{hud.epochId} <span style={{ fontSize: 13, fontWeight: 500, color: "#AEB7A8" }}>estimated · {mmss(hud.epochSecs)}</span></Hud>
                    <Hud label="Robinhood Chain">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: disconnected ? "#E46B5A" : stale ? AMBER : LIME }}>
                        <span className={disconnected || stale ? undefined : "live"} style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                        {disconnected ? "Disconnected" : stale ? "Delayed" : "Connected"}
                      </span>
                    </Hud>
                    <Hud label="Last synced block"><span style={{ fontFamily: MONO, fontSize: 16 }}>{hud.head.toLocaleString("en-US")}</span> <span style={{ fontSize: 13, fontWeight: 500, color: "#AEB7A8" }}>{sinceSync <= 2 ? "just now" : `${sinceSync}s ago`}</span></Hud>
                  </div>
                )}

                {/* state overlays */}
                {!scene && (
                  <div aria-busy="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24 }}>
                    <div style={{ width: "min(560px, 100%)", display: "grid", gap: 12 }}>
                      <Sk h={260} r={18} />
                      <Sk w="60%" h={14} />
                      <p style={{ margin: 0, color: "#8E978A", fontSize: 14 }}>Loading the office snapshot, then subscribing to live events.</p>
                    </div>
                  </div>
                )}
                {empty && (
                  <div style={{ position: "absolute", left: "50%", top: "55%", transform: "translate(-50%,-50%)", textAlign: "center", ...card, padding: "22px 26px", width: "min(420px, 90%)" }}>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>The office is empty</div>
                    <p style={{ margin: "6px 0 16px", color: "#AEB7A8", fontSize: 14 }}>Employees appear at reception as soon as they are hired, and walk to a desk once their Pons launch is confirmed.</p>
                    <Link href="/clock-in" className="btnl" style={{ textDecoration: "none", background: LIME, color: "#0F130E", fontWeight: 600, padding: "0 22px", minHeight: 46, display: "inline-flex", alignItems: "center", borderRadius: 999 }}>Be the first to clock in</Link>
                  </div>
                )}
                {(disconnected || stale) && (
                  <div style={{ position: "absolute", left: 14, right: 14, top: compact ? 150 : 88 }}>
                    {disconnected ? (
                      <Banner tone="red" action={<button type="button" onClick={reconnect} className="btng" style={{ background: "transparent", color: "#E9EDE2", border: "1px solid #3A4436", borderRadius: 999, padding: "6px 14px", cursor: "pointer", font: "inherit", fontSize: 13 }}>Retry connection</button>}>
                        Connection lost. Showing the last snapshot from block {hud?.head.toLocaleString("en-US")}. Nothing new is animated until the stream is back.
                      </Banner>
                    ) : (
                      <Banner tone="amber">Indexer delayed. Market numbers are frozen at block {hud?.head.toLocaleString("en-US")} and no new movements are shown.</Banner>
                    )}
                  </div>
                )}

                {/* controls */}
                {scene && (
                  <>
                    <div style={{ position: "absolute", left: 14, bottom: 14, display: compact ? "none" : "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 14px", background: "rgba(18,23,16,.88)", border: "1px solid #2A3227", borderRadius: 999, padding: "7px 14px", fontSize: 13, color: "#AEB7A8", pointerEvents: "none" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: LIME }} />Working</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6E776A" }} />Break or done</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: "50%", border: `1.5px dashed ${AMBER}` }} />Pending, not confirmed</span>
                      <span title="Drag to rotate, right-drag to pan, scroll to zoom">Drag to look around</span>
                    </div>
                    <div style={{ position: "absolute", right: 14, bottom: 68, ...(compact ? { right: "auto", left: 14 } : {}) }}>
                      <Seg<Preset> label="Camera" items={PRESETS} value={preset} onPick={setPreset} disabled={(v) => v === "Follow" && selectedId == null} />
                    </div>
                    <div style={{ position: "absolute", right: 14, bottom: 14, display: "flex", gap: 8 }}>
                      {(["−", "+"] as const).map((s) => (
                        <button key={s} type="button" aria-label={s === "+" ? "Zoom in" : "Zoom out"} onClick={() => setZoomCmd((z) => ({ n: z.n + 1, factor: s === "+" ? 1.25 : 0.8 }))}
                          style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid #3A4436", background: "rgba(18,23,16,.9)", color: "#E9EDE2", fontSize: 20, cursor: "pointer" }}>{s}</button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            ) : (
              <Roster list={roster} selectedId={selectedId} onSelect={setSelectedId} />
            )}

            <section aria-label="How the office reacts" style={{ ...card, padding: 22 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "6px 16px" }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>How the office reacts</h2>
                <span style={{ fontSize: 13, color: "#8E978A" }}>Animations show confirmed state. They are never the proof.</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 24px", marginTop: 12 }}>
                {REACTS.map(([k, v]) => (
                  <div key={k} style={{ borderTop: "1px solid #263023", padding: "12px 0" }}>
                    <div style={{ fontSize: 14, color: "#8E978A" }}>{k}</div>
                    <div style={{ fontSize: 15 }}>{v}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div style={{ display: "grid", gap: 16, minWidth: 0 }} className="o3-side">
            {selected ? (
              <Details e={selected} onClose={() => setSelectedId(null)} onFollow={() => setPreset((p) => (p === "Follow" ? "Overview" : "Follow"))} following={preset === "Follow"} />
            ) : (
              <section style={{ ...card, padding: 22, borderStyle: "dashed" }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>Pick someone</div>
                <p style={{ margin: "6px 0 0", color: "#AEB7A8", fontSize: 15 }}>Click a character or a desk to see their wallet, Pons token, shift timer, rank, verified earnings and proof links.</p>
                {me && (
                  <button type="button" onClick={() => setSelectedId(me.id)} className="btng" style={{ marginTop: 14, background: "transparent", color: "#E9EDE2", font: "inherit", fontSize: 14, padding: "0 16px", minHeight: 40, border: "1px solid #3A4436", borderRadius: 999, cursor: "pointer" }}>Find my desk</button>
                )}
              </section>
            )}
            <Feed events={scene?.events ?? []} />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
