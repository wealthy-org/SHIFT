"use client";

import { Edges, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OfficeEmployee, OfficeScene as Scene } from "@/lib/engine/office3d";
import { BREAK_SPOTS, CENTER, DOOR, FLOOR, PAYROLL_BOARD, RECEPTION_SPOTS, STATUS_WALL, ZONES, chairPos, deskPos, route } from "./layout";
import { DISPLAY, MONO, SANS, fit, roundRect, useCanvasTexture } from "./textures";

const LIME = "#C8F135";
const AMBER = "#E0A44A";

export type Preset = "Overview" | "Follow" | "Status wall" | "Payroll board";
export type Fx = Record<number, { cheerAt?: number; payoutAt?: number; badge?: string; badgeAt?: number }>;

export type SceneProps = {
  scene: Scene;
  floor: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  preset: Preset;
  zoomCmd: { n: number; factor: number };
  fx: Fx;
  boardFlashAt: number;
  compact: boolean;
  reduced: boolean;
  paused: boolean;
  frozen: boolean;
};

// ---------------------------------------------------------------------------
// shared geometry and materials: one instance each, however many desks
// ---------------------------------------------------------------------------

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  head: new THREE.SphereGeometry(0.15, 18, 14),
  eye: new THREE.SphereGeometry(0.018, 8, 6),
  hairCap: new THREE.SphereGeometry(0.162, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.1),
  bun: new THREE.SphereGeometry(0.07, 10, 8),
  headset: new THREE.TorusGeometry(0.16, 0.018, 6, 20, Math.PI),
  coin: new THREE.CylinderGeometry(0.055, 0.055, 0.016, 14),
  confetti: new THREE.PlaneGeometry(0.06, 0.1),
  pot: new THREE.CylinderGeometry(0.18, 0.14, 0.32, 10),
  leaves: new THREE.IcosahedronGeometry(0.34, 0),
  mug: new THREE.CylinderGeometry(0.045, 0.04, 0.09, 10),
};

const matCache = new Map<string, THREE.Material>();
function mat(color: string, o: { emissive?: string; emissiveIntensity?: number; rough?: number; metal?: number; opacity?: number; flat?: boolean } = {}) {
  const key = JSON.stringify([color, o]);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.78,
      metalness: o.metal ?? 0.05,
      emissive: o.emissive ?? "#000000",
      emissiveIntensity: o.emissiveIntensity ?? 0,
      transparent: o.opacity !== undefined,
      opacity: o.opacity ?? 1,
      flatShading: o.flat ?? false,
    });
    matCache.set(key, m);
  }
  return m;
}

function Box({ p, s, m, cast = true, receive = true, onClick }: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material; cast?: boolean; receive?: boolean; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  return <mesh geometry={G.box} material={m} position={p} scale={s} castShadow={cast} receiveShadow={receive} onClick={onClick} />;
}

// ---------------------------------------------------------------------------
// room shell
// ---------------------------------------------------------------------------

function FloorLabel({ text, p, size = 0.42, rot = 0, color = "#5F685B", w = 4 }: { text: string; p: [number, number, number]; size?: number; rot?: number; color?: string; w?: number }) {
  const tex = useCanvasTexture(1024, 160, (g, W, H) => {
    g.fillStyle = color;
    g.font = `800 96px ${DISPLAY}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.letterSpacing = "10px";
    g.fillText(text, W / 2, H / 2);
  }, [text, color]);
  return (
    <mesh position={p} rotation={[-Math.PI / 2, 0, rot]} renderOrder={1}>
      <planeGeometry args={[w, w * (160 / 1024) * (size / 0.42)]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

function FloorGrid() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let x = 1; x < FLOOR.w; x += 1) pts.push(x, 0.002, 0, x, 0.002, FLOOR.d);
    for (let z = 1; z < FLOOR.d; z += 1) pts.push(0, 0.002, z, FLOOR.w, 0.002, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#2C3628" transparent opacity={0.7} />
    </lineSegments>
  );
}

function Shell() {
  const wall = mat("#1C2318", { rough: 0.95 });
  const trim = mat(LIME, { emissive: LIME, emissiveIntensity: 0.9 });
  return (
    <group>
      {/* floor slab */}
      <Box p={[FLOOR.w / 2, -0.1, FLOOR.d / 2]} s={[FLOOR.w, 0.2, FLOOR.d]} m={mat("#1C2419", { rough: 0.88 })} cast={false} />
      <FloorGrid />
      {/* two walls, open toward the viewer like the mockup */}
      <Box p={[-0.08, 1.5, FLOOR.d / 2]} s={[0.16, 3.0, FLOOR.d]} m={wall} cast={false} />
      <Box p={[FLOOR.w / 2, 1.5, -0.08]} s={[FLOOR.w, 3.0, 0.16]} m={wall} cast={false} />
      {/* lime trim along the floor edges */}
      <Box p={[0.02, 0.012, FLOOR.d / 2]} s={[0.04, 0.024, FLOOR.d]} m={trim} cast={false} receive={false} />
      <Box p={[FLOOR.w / 2, 0.012, 0.02]} s={[FLOOR.w, 0.024, 0.04]} m={trim} cast={false} receive={false} />
      <Box p={[FLOOR.w / 2, 0.012, FLOOR.d - 0.02]} s={[FLOOR.w, 0.024, 0.04]} m={mat("#3A4436")} cast={false} receive={false} />
      <Box p={[FLOOR.w - 0.02, 0.012, FLOOR.d / 2]} s={[0.04, 0.024, FLOOR.d]} m={mat("#3A4436")} cast={false} receive={false} />
      {/* wall top trim */}
      <Box p={[-0.08, 3.01, FLOOR.d / 2]} s={[0.18, 0.03, FLOOR.d]} m={mat("#2A3324")} cast={false} />
      <Box p={[FLOOR.w / 2, 3.01, -0.08]} s={[FLOOR.w, 0.03, 0.18]} m={mat("#2A3324")} cast={false} />

      <FloorLabel text="RECEPTION" p={[2.4, 0.01, 8.6]} w={3.2} />
      <FloorLabel text="MEETING" p={[7.0, 0.01, 3.35]} w={2.8} />
      <FloorLabel text="MANAGER OFFICE" p={[15.4, 0.01, 8.75]} w={3.6} />
      <FloorLabel text="BREAK AREA" p={[14.2, 0.01, 13.05]} w={3.2} />
      <FloorLabel text="SHIFT" p={[2.5, 0.012, 11.7]} w={3.4} size={0.9} color="#2B3B16" rot={0.0} />
    </group>
  );
}

function Plant({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh geometry={G.pot} material={mat("#3A4436")} position={[0, 0.16, 0]} castShadow receiveShadow />
      <mesh geometry={G.leaves} material={mat("#4E7A3A", { flat: true, rough: 0.9 })} position={[0, 0.58, 0]} castShadow />
      <mesh geometry={G.leaves} material={mat("#5E8C44", { flat: true, rough: 0.9 })} position={[0.12, 0.8, 0.05]} scale={0.6} castShadow />
    </group>
  );
}

function Glass({ x0, z0, x1, z1, h = 2.1 }: { x0: number; z0: number; x1: number; z1: number; h?: number }) {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9DBF3A", transparent: true, opacity: 0.07, roughness: 0.1, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }), []);
  const w = x1 - x0;
  const d = z1 - z0;
  const panes: [number, number, number, number, number][] = [
    [x0 + w / 2, z1, w, 0.03, 0],
    [x1, z0 + d / 2, 0.03, d, 0],
  ];
  return (
    <group>
      {panes.map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, h / 2, z]} scale={[sx, h, sz]} geometry={G.box} material={m} renderOrder={2}>
          <Edges color={LIME} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function MeetingRoom() {
  const z = ZONES.meeting;
  const cx = (z.x0 + z.x1) / 2;
  const cz = (z.z0 + z.z1) / 2 + 0.1;
  const seat = mat("#1D231B");
  return (
    <group>
      <Glass {...z} />
      <Box p={[cx, 0.72, cz]} s={[2.8, 0.06, 1.0]} m={mat("#2E3A28")} />
      <Box p={[cx, 0.36, cz]} s={[0.18, 0.72, 0.5]} m={mat("#1A2017")} />
      {[-1, 0, 1].map((i) => (
        <group key={i}>
          <Box p={[cx + i * 0.9, 0.42, cz - 0.82]} s={[0.42, 0.08, 0.42]} m={seat} />
          <Box p={[cx + i * 0.9, 0.42, cz + 0.82]} s={[0.42, 0.08, 0.42]} m={seat} />
        </group>
      ))}
      <Plant p={[z.x0 + 0.4, 0, z.z0 + 0.45]} s={0.9} />
    </group>
  );
}

function ManagerOffice() {
  const z = ZONES.manager;
  return (
    <group>
      <Glass {...z} />
      <Box p={[15.6, 0.74, 5.4]} s={[1.9, 0.07, 0.9]} m={mat("#3A2A1E", { rough: 0.6 })} />
      <Box p={[15.6, 0.37, 5.4]} s={[1.7, 0.74, 0.12]} m={mat("#2A1E15")} />
      <Box p={[15.6, 0.5, 6.25]} s={[0.55, 0.1, 0.5]} m={mat("#1D231B")} />
      <Box p={[15.6, 0.85, 6.5]} s={[0.55, 0.6, 0.08]} m={mat("#1D231B")} />
      <Box p={[16.9, 0.7, 7.4]} s={[0.6, 1.4, 1.0]} m={mat("#4A3424")} />
      <Plant p={[13.9, 0, 4.1]} />
    </group>
  );
}

function Reception() {
  const z = ZONES.reception;
  return (
    <group>
      <Box p={[(z.x0 + z.x1) / 2, 0.5, (z.z0 + z.z1) / 2]} s={[z.x1 - z.x0, 1.0, z.z1 - z.z0]} m={mat("#1A2017")} />
      <Box p={[(z.x0 + z.x1) / 2, 1.02, (z.z0 + z.z1) / 2]} s={[z.x1 - z.x0 + 0.1, 0.05, z.z1 - z.z0 + 0.12]} m={mat("#2A3324")} />
      <Box p={[(z.x0 + z.x1) / 2, 0.6, z.z1 + 0.005]} s={[z.x1 - z.x0 - 0.2, 0.04, 0.01]} m={mat(LIME, { emissive: LIME, emissiveIntensity: 1.2 })} cast={false} />
      <Plant p={[0.55, 0, 8.3]} s={1.05} />
      <pointLight position={[2.4, 1.6, 11]} color={LIME} intensity={2.2} distance={5} decay={2} />
    </group>
  );
}

function BreakArea() {
  return (
    <group>
      {/* sofa */}
      <Box p={[13.8, 0.25, 12.95]} s={[2.6, 0.5, 0.75]} m={mat("#3B3F58", { rough: 0.95 })} />
      <Box p={[13.8, 0.62, 13.25]} s={[2.6, 0.55, 0.2]} m={mat("#33374D", { rough: 0.95 })} />
      {/* coffee table */}
      <Box p={[13.8, 0.3, 11.9]} s={[1.2, 0.06, 0.6]} m={mat("#4A3424", { rough: 0.6 })} />
      <mesh geometry={G.mug} material={mat("#E4E7DA")} position={[13.5, 0.38, 11.85]} castShadow />
      {/* kitchenette */}
      <Box p={[17.0, 0.5, 10.6]} s={[0.6, 1.0, 2.8]} m={mat("#4A3424", { rough: 0.7 })} />
      <Box p={[17.0, 1.02, 10.6]} s={[0.66, 0.05, 2.86]} m={mat("#2A3324")} />
      <pointLight position={[15.6, 1.8, 11]} color="#FFD7A0" intensity={2.4} distance={6} decay={2} />
      <Plant p={[16.9, 0, 12.9]} s={1.1} />
      <Plant p={[12.3, 0, 8.9]} s={0.8} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// boards
// ---------------------------------------------------------------------------

function PayrollBoard({ scene, flashAt }: { scene: Scene; flashAt: number }) {
  const b = scene.board;
  const tex = useCanvasTexture(1024, 528, (g, W, H) => {
    g.fillStyle = "#E4E7DA";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#161A14";
    g.font = `900 92px ${DISPLAY}`;
    g.textBaseline = "top";
    g.fillText("PAYROLL BOARD", 48, 36);
    g.fillRect(48, 146, W - 96, 5);
    g.font = `500 40px ${SANS}`;
    g.fillStyle = "#5A6156";
    g.fillText(`Epoch ${b.epochId}`, 48, 178);
    g.fillStyle = "#161A14";
    g.font = `900 150px ${DISPLAY}`;
    g.fillText(`${b.poolEth.toFixed(2)} ETH`, 44, 230);
    g.font = `500 36px ${SANS}`;
    g.fillStyle = "#5A6156";
    g.fillText("Payroll pool", 48, 400);
    const claim = b.status === "Claimable";
    roundRect(g, W - 330, 392, 282, 72, 36);
    g.fillStyle = claim ? "#161A14" : "transparent";
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = "#161A14";
    g.stroke();
    g.fillStyle = claim ? LIME : "#161A14";
    g.font = `600 36px ${SANS}`;
    g.textAlign = "center";
    g.fillText(b.status, W - 189, 410);
    g.textAlign = "left";
  }, [b.epochId, b.poolEth.toFixed(2), b.status]);

  const m = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!m.current) return;
    const k = Math.max(0, 1 - (performance.now() - flashAt) / 1600);
    m.current.emissiveIntensity = 0.32 + k * 0.6;
  });
  const p = PAYROLL_BOARD;
  return (
    <group position={[p.x + 0.04, p.y, p.z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, -0.03]} geometry={G.box} scale={[p.w + 0.14, p.h + 0.14, 0.05]} material={mat("#0F130E")} />
      <mesh>
        <planeGeometry args={[p.w, p.h]} />
        <meshStandardMaterial ref={m} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.32} roughness={0.9} />
      </mesh>
    </group>
  );
}

function StatusWall({ scene }: { scene: Scene }) {
  const h = scene.hud;
  const mmss = (x: number) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  const topKey = h.top.map((t) => `${t.id}:${t.score.toFixed(1)}`).join("|");
  const tex = useCanvasTexture(1280, 512, (g, W) => {
    g.fillStyle = "#0E120D";
    g.fillRect(0, 0, W, 512);
    g.fillStyle = "#8E978A";
    g.font = `600 30px ${SANS}`;
    g.letterSpacing = "6px";
    g.textBaseline = "top";
    g.fillText("STATUS WALL", 48, 34);
    g.letterSpacing = "0px";
    g.fillStyle = "#E9EDE2";
    g.font = `800 64px ${DISPLAY}`;
    g.fillText(`Active shifts ${h.active}`, 48, 80);

    g.fillStyle = "#8E978A";
    g.font = `500 28px ${SANS}`;
    g.fillText("TOP PERFORMERS", 48, 176);
    h.top.forEach((t, i) => {
      const y = 220 + i * 70;
      g.fillStyle = i === 0 ? LIME : "#AEB7A8";
      g.font = `900 52px ${DISPLAY}`;
      g.fillText(String(i + 1), 48, y);
      g.fillStyle = "#E9EDE2";
      g.font = `600 38px ${SANS}`;
      g.fillText(fit(g, t.name, 360), 100, y + 6);
      g.fillStyle = LIME;
      g.font = `500 34px ${MONO}`;
      g.fillText(t.score.toFixed(1), 480, y + 8);
    });
    if (!h.top.length) {
      g.fillStyle = "#6E776A";
      g.font = `500 32px ${SANS}`;
      g.fillText("No one on shift", 48, 228);
    }

    g.fillStyle = "#8E978A";
    g.font = `500 28px ${SANS}`;
    g.fillText("NEXT PAYROLL", 720, 176);
    g.fillStyle = LIME;
    g.font = `900 96px ${DISPLAY}`;
    g.fillText(mmss(h.epochSecs), 720, 212);
    g.fillStyle = "#8E978A";
    g.font = `500 28px ${SANS}`;
    g.fillText("FINALIZED BLOCK", 720, 340);
    g.fillStyle = "#E9EDE2";
    g.font = `500 44px ${MONO}`;
    g.fillText(h.finalizedBlock.toLocaleString("en-US"), 720, 378);
  }, [h.active, topKey, h.epochSecs, h.finalizedBlock]);
  const p = STATUS_WALL;
  return (
    <group position={[p.x, p.y, p.z + 0.04]}>
      <mesh position={[0, 0, -0.03]} geometry={G.box} scale={[p.w + 0.14, p.h + 0.14, 0.05]} material={mat("#232B20")} />
      <mesh>
        <planeGeometry args={[p.w, p.h]} />
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.85} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// desks
// ---------------------------------------------------------------------------

const MonitorScreen = memo(function MonitorScreen({ e }: { e?: OfficeEmployee }) {
  const working = e?.pose === "working";
  const tex = useCanvasTexture(256, 152, (g, W, H) => {
    g.fillStyle = working ? "#16200F" : "#0B0E0A";
    g.fillRect(0, 0, W, H);
    if (!e) return;
    if (!working) {
      g.fillStyle = "#3A4436";
      g.font = `600 26px ${MONO}`;
      g.fillText(e.ticker, 18, 40);
      return;
    }
    g.fillStyle = LIME;
    g.font = `600 30px ${MONO}`;
    g.textBaseline = "top";
    g.fillText(fit(g, e.ticker, W - 36), 18, 14);
    g.fillStyle = "#E9EDE2";
    g.font = `800 52px ${DISPLAY}`;
    g.fillText(e.score.toFixed(1), 18, 52);
    g.fillStyle = "#AEB7A8";
    g.font = `500 22px ${SANS}`;
    g.fillText(`${e.mcap.toFixed(1)} ETH · ${e.rank}`, 18, 112);
    // shift progress
    g.fillStyle = "#2A3127";
    g.fillRect(0, H - 6, W, 6);
    g.fillStyle = LIME;
    g.fillRect(0, H - 6, W * Math.min(1, e.secs / 300), 6);
  }, [e?.ticker, working, e?.score.toFixed(1), e?.mcap.toFixed(1), e?.rank, Math.floor((e?.secs ?? 0) / 10)]);
  return (
    <mesh position={[0, 0, 0.026]}>
      <planeGeometry args={[0.56, 0.33]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
});

function Desk({ local, occupant, selected, onSelect, flashAt }: { local: number; occupant?: OfficeEmployee; selected: boolean; onSelect: (id: number | null) => void; flashAt: number }) {
  const [x, z] = deskPos(local);
  const top = mat("#3A4535", { rough: 0.62 });
  const leg = mat("#1E241B");
  const onClick = (ev: ThreeEvent<MouseEvent>) => {
    ev.stopPropagation();
    if (occupant) onSelect(occupant.id);
  };
  const glow = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (!glow.current) return;
    const k = Math.max(0, 1 - (performance.now() - flashAt) / 900);
    glow.current.intensity = occupant?.pose === "working" ? 0.55 + k * 1.4 : 0;
  });
  return (
    <group position={[x, 0, z]} onClick={onClick} onPointerOver={(e) => { e.stopPropagation(); if (occupant) document.body.style.cursor = "pointer"; }} onPointerOut={() => (document.body.style.cursor = "")}>
      <Box p={[0, 0.72, 0]} s={[1.3, 0.05, 0.72]} m={selected ? mat("#3A4A2C", { rough: 0.6 }) : top} />
      <Box p={[-0.58, 0.36, 0]} s={[0.05, 0.72, 0.62]} m={leg} />
      <Box p={[0.58, 0.36, 0]} s={[0.05, 0.72, 0.62]} m={leg} />
      {/* monitor */}
      <group position={[0, 1.02, -0.2]}>
        <Box p={[0, 0, 0]} s={[0.62, 0.38, 0.04]} m={mat("#0F130E")} />
        <MonitorScreen e={occupant} />
        <Box p={[0, -0.24, 0.0]} s={[0.05, 0.12, 0.04]} m={leg} />
        <Box p={[0, -0.29, 0.02]} s={[0.24, 0.02, 0.14]} m={leg} />
      </group>
      <pointLight ref={glow} position={[0, 1.05, 0.15]} color={LIME} intensity={0} distance={1.6} decay={2} />
      {/* keyboard */}
      <Box p={[0, 0.755, 0.12]} s={[0.42, 0.015, 0.14]} m={mat("#1A1F18")} cast={false} />
      {/* chair */}
      <group position={[0, 0, 0.78]}>
        <Box p={[0, 0.44, 0]} s={[0.44, 0.07, 0.42]} m={mat("#1D231B")} />
        <Box p={[0, 0.74, 0.2]} s={[0.44, 0.52, 0.06]} m={mat("#1D231B")} />
        <Box p={[0, 0.22, 0]} s={[0.05, 0.44, 0.05]} m={leg} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// characters
// ---------------------------------------------------------------------------

type Target = { x: number; z: number; seat: boolean; face: number };

function targetOf(e: OfficeEmployee, local: number, breakSpot: number, receptionSpot: number): Target {
  if ((e.pose === "working" || e.pose === "seated") && local >= 0) {
    const [x, z] = chairPos(local);
    return { x, z, seat: true, face: Math.PI };
  }
  if (e.pose === "break" && breakSpot >= 0) {
    const [x, z] = BREAK_SPOTS[breakSpot];
    return { x, z, seat: false, face: Math.atan2(13.8 - x, 11.9 - z) };
  }
  if (e.pose === "break" && local >= 0) {
    const [x, z] = chairPos(local);
    return { x, z, seat: true, face: Math.PI };
  }
  const [x, z] = RECEPTION_SPOTS[Math.max(0, receptionSpot) % RECEPTION_SPOTS.length];
  return { x, z, seat: false, face: Math.atan2(2.45 - x, 9.65 - z) };
}

const SPEED = 2.1;
const keyOf = (t: Target) => `${t.x.toFixed(2)},${t.z.toFixed(2)}`;

function Character({
  e, target, entrance, selected, onSelect, fx, reduced, frozen, posOut,
}: {
  e: OfficeEmployee; target: Target; entrance: boolean; selected: boolean; onSelect: (id: number | null) => void; fx?: Fx[number]; reduced: boolean; frozen: boolean; posOut: Map<number, THREE.Vector3>;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const ringSel = useRef<THREE.Mesh>(null);
  const pendingRing = useRef<THREE.Group>(null);
  const coins = useRef<THREE.Group>(null);
  const confetti = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);

  const st = useRef<{ x: number; z: number; path: [number, number][]; face: number; walking: boolean; key: string }>(null as any);
  if (!st.current) {
    const start = entrance ? DOOR : [target.x, target.z];
    st.current = { x: start[0], z: start[1], path: entrance ? route([start[0], start[1]], [target.x, target.z]) : [], face: target.face, walking: false, key: keyOf(target) };
  }

  // New destination: walk there along the aisles. Reduced motion just arrives.
  const key = keyOf(target);
  useEffect(() => {
    const s = st.current;
    if (s.key === key) return;
    s.key = key;
    if (reduced) {
      s.x = target.x;
      s.z = target.z;
      s.path = [];
      return;
    }
    s.path = route([s.x, s.z], [target.x, target.z]);
  }, [key, reduced, target.x, target.z]);

  const look = e.look;
  const shirt = mat(look.shirt, { rough: 0.85 });
  const skin = mat(look.skin, { rough: 0.6 });
  const hair = mat(look.hair, { rough: 0.9 });
  const pants = mat("#1F2330");
  const dark = mat("#111111");

  const confettiBits = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2, v: 0.6 + ((i * 37) % 10) / 14, c: [LIME, "#E4E7DA", "#8FA34A", AMBER][i % 4] })),
    [],
  );

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    const g = root.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const now = performance.now();

    // movement
    s.walking = false;
    if (!frozen && s.path.length) {
      const [nx, nz] = s.path[0];
      const dx = nx - s.x;
      const dz = nz - s.z;
      const d = Math.hypot(dx, dz);
      const stepLen = SPEED * dt;
      if (d <= stepLen) {
        s.x = nx;
        s.z = nz;
        s.path.shift();
      } else {
        s.x += (dx / d) * stepLen;
        s.z += (dz / d) * stepLen;
        s.face = Math.atan2(dx, dz);
        s.walking = true;
      }
    }
    const arrived = !s.path.length;
    const seated = arrived && target.seat;
    if (arrived) {
      // turn to the desk or the room once there
      let df = target.face - s.face;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      s.face += df * Math.min(1, dt * 8);
    }

    const cheering = fx?.cheerAt && now - fx.cheerAt < 2600;
    const jump = cheering && !reduced ? Math.abs(Math.sin((now - fx!.cheerAt!) / 120)) * 0.28 : 0;
    g.position.set(s.x, jump, s.z);
    g.rotation.y = s.face;
    posOut.set(e.id, g.position);

    // pose
    const typing = seated && e.pose === "working" && !reduced;
    const walkPhase = s.walking && !reduced ? Math.sin(t * 11) : 0;
    if (body.current) body.current.position.y = seated ? -0.2 : 0;
    if (body.current) body.current.position.z = seated ? 0.06 : 0;
    if (legL.current && legR.current) {
      const sitAngle = seated ? -Math.PI / 2 : 0;
      legL.current.rotation.x = sitAngle + walkPhase * 0.55;
      legR.current.rotation.x = sitAngle - walkPhase * 0.55;
    }
    if (armL.current && armR.current) {
      if (cheering && !reduced) {
        armL.current.rotation.x = -Math.PI + Math.sin(t * 14) * 0.25;
        armR.current.rotation.x = -Math.PI - Math.sin(t * 14) * 0.25;
      } else if (typing) {
        armL.current.rotation.x = -1.15 + Math.sin(t * 18) * 0.08;
        armR.current.rotation.x = -1.15 + Math.sin(t * 18 + 1.7) * 0.08;
      } else {
        armL.current.rotation.x = -walkPhase * 0.5;
        armR.current.rotation.x = walkPhase * 0.5;
      }
    }
    if (head.current) head.current.rotation.x = typing ? Math.sin(t * 2.2 + e.id) * 0.06 + 0.12 : 0;

    if (ringSel.current) {
      const m = ringSel.current.material as THREE.MeshBasicMaterial;
      m.opacity = selected ? 0.55 + Math.sin(t * 4) * 0.25 : 0;
    }
    if (pendingRing.current) pendingRing.current.rotation.y = t * 0.8;

    // payout coins rising
    if (coins.current) {
      const k = fx?.payoutAt ? (now - fx.payoutAt) / 2800 : 2;
      coins.current.visible = k >= 0 && k < 1 && !reduced;
      if (coins.current.visible) {
        coins.current.children.forEach((c, i) => {
          const a = (i / coins.current!.children.length) * Math.PI * 2 + k * 3;
          c.position.set(Math.cos(a) * 0.32 * (0.6 + k), 1.3 + k * 1.3 + Math.sin(i) * 0.08, Math.sin(a) * 0.32 * (0.6 + k));
          c.rotation.x = t * 6 + i;
          ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 1 - k;
        });
      }
    }
    // confetti burst on promotion
    if (confetti.current) {
      const k = fx?.cheerAt ? (now - fx.cheerAt) / 2400 : 2;
      confetti.current.visible = k >= 0 && k < 1 && !reduced;
      if (confetti.current.visible) {
        confetti.current.children.forEach((c, i) => {
          const b = confettiBits[i];
          const r = b.v * k * 1.2;
          c.position.set(Math.cos(b.a) * r, 1.4 + k * 1.6 - k * k * 2.4, Math.sin(b.a) * r);
          c.rotation.set(t * 5 + i, t * 3, 0);
        });
      }
    }
  });

  const onClick = (ev: ThreeEvent<MouseEvent>) => {
    ev.stopPropagation();
    onSelect(e.id);
  };
  const ringColor = e.pending ? AMBER : e.pose === "working" ? LIME : "#6E776A";
  const showBadge = fx?.badge && fx.badgeAt && performance.now() - fx.badgeAt < 9000;

  return (
    <group
      ref={root}
      onClick={onClick}
      onPointerOver={(ev) => { ev.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}
    >
      {/* status ring */}
      {e.pending ? (
        <group ref={pendingRing} position={[0, 0.02, 0]}>
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.27, 0.33, 6, 1, (i / 10) * Math.PI * 2, (Math.PI * 2) / 10 * 0.55]} />
              <meshBasicMaterial color={AMBER} transparent opacity={0.9} />
            </mesh>
          ))}
        </group>
      ) : (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.27, 0.32, 28]} />
          <meshBasicMaterial color={ringColor} transparent opacity={e.pose === "working" ? 0.85 : 0.5} />
        </mesh>
      )}
      <mesh ref={ringSel} position={[0, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.44, 32]} />
        <meshBasicMaterial color={LIME} transparent opacity={0} />
      </mesh>

      <group ref={body}>
        {/* legs pivot at the hip */}
        <group ref={legL} position={[-0.075, 0.42, 0]}>
          <mesh geometry={G.box} material={pants} position={[0, -0.2, 0]} scale={[0.11, 0.42, 0.13]} castShadow />
          <mesh geometry={G.box} material={dark} position={[0, -0.39, 0.04]} scale={[0.12, 0.05, 0.2]} castShadow />
        </group>
        <group ref={legR} position={[0.075, 0.42, 0]}>
          <mesh geometry={G.box} material={pants} position={[0, -0.2, 0]} scale={[0.11, 0.42, 0.13]} castShadow />
          <mesh geometry={G.box} material={dark} position={[0, -0.39, 0.04]} scale={[0.12, 0.05, 0.2]} castShadow />
        </group>
        <RoundedBox args={[0.36, 0.44, 0.22]} radius={0.06} smoothness={3} position={[0, 0.65, 0]} material={shirt} castShadow />
        {/* arms pivot at the shoulder */}
        <group ref={armL} position={[-0.23, 0.84, 0]}>
          <mesh geometry={G.box} material={shirt} position={[0, -0.17, 0]} scale={[0.09, 0.34, 0.1]} castShadow />
          <mesh geometry={G.box} material={skin} position={[0, -0.36, 0]} scale={[0.08, 0.06, 0.09]} />
        </group>
        <group ref={armR} position={[0.23, 0.84, 0]}>
          <mesh geometry={G.box} material={shirt} position={[0, -0.17, 0]} scale={[0.09, 0.34, 0.1]} castShadow />
          <mesh geometry={G.box} material={skin} position={[0, -0.36, 0]} scale={[0.08, 0.06, 0.09]} />
        </group>
        <group ref={head} position={[0, 1.02, 0]}>
          <mesh geometry={G.head} material={skin} castShadow />
          <mesh geometry={G.eye} material={dark} position={[-0.052, 0.015, 0.138]} />
          <mesh geometry={G.eye} material={dark} position={[0.052, 0.015, 0.138]} />
          {look.style !== 3 && <mesh geometry={G.hairCap} material={hair} position={[0, 0.012, -0.004]} rotation={[-0.25, 0, 0]} />}
          {look.style === 1 && <mesh geometry={G.bun} material={hair} position={[0, 0.1, -0.14]} />}
          {look.style === 2 && <mesh geometry={G.box} material={hair} position={[0, 0.15, -0.02]} scale={[0.22, 0.08, 0.2]} />}
          {look.style === 3 && <mesh geometry={G.box} material={hair} position={[0, 0.13, -0.03]} scale={[0.2, 0.03, 0.2]} />}
          {look.acc === 1 && (
            <>
              <mesh geometry={G.box} material={dark} position={[-0.052, 0.015, 0.15]} scale={[0.07, 0.045, 0.01]} />
              <mesh geometry={G.box} material={dark} position={[0.052, 0.015, 0.15]} scale={[0.07, 0.045, 0.01]} />
            </>
          )}
          {look.acc === 2 && <mesh geometry={G.headset} material={mat("#2C2C30")} position={[0, 0.02, 0]} rotation={[0, Math.PI / 2, 0]} />}
        </group>
      </group>

      <group ref={coins} visible={false}>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} geometry={G.coin}>
            <meshStandardMaterial color="#E0C14A" emissive="#B8901E" emissiveIntensity={0.8} metalness={0.7} roughness={0.3} transparent />
          </mesh>
        ))}
      </group>
      <group ref={confetti} visible={false}>
        {confettiBits.map((b, i) => (
          <mesh key={i} geometry={G.confetti}>
            <meshBasicMaterial color={b.c} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {(hover || selected) && (
        <Html position={[0, 1.55, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ whiteSpace: "nowrap", background: "rgba(15,19,14,.92)", border: `1px solid ${selected ? LIME : "#3A4436"}`, color: "#E9EDE2", borderRadius: 999, padding: "4px 10px", font: `600 12px ${SANS}` }}>
            {e.name} <span style={{ color: LIME, fontFamily: MONO, fontWeight: 500 }}>{e.ticker}</span>
            {e.sim && <span style={{ color: "#8E978A", fontWeight: 500 }}> · SIM</span>}
          </div>
        </Html>
      )}
      {showBadge && (
        <Html position={[0, 1.95, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
          <div className="o3-badge" style={{ whiteSpace: "nowrap", background: LIME, color: "#0F130E", borderRadius: 8, padding: "4px 10px", font: `900 14px ${DISPLAY}`, letterSpacing: "0.06em" }}>
            PROMOTED · {fx!.badge!.toUpperCase()}
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// camera
// ---------------------------------------------------------------------------

const ISO_OFFSET = new THREE.Vector3(17, 15.5, 17);

function CameraRig({ preset, selectedId, posOut, zoomCmd, controlsRef }: { preset: Preset; selectedId: number | null; posOut: Map<number, THREE.Vector3>; zoomCmd: { n: number; factor: number }; controlsRef: React.MutableRefObject<any> }) {
  const { camera, size } = useThree();
  const anim = useRef<{ t: number; ft: THREE.Vector3; tt: THREE.Vector3; fz: number; tz: number; fo: THREE.Vector3; to: THREE.Vector3 } | null>(null);
  const fitZoom = Math.max(16, Math.min(80, Math.min(size.width / 20.5, size.height / 13.4)));

  const start = (tt: THREE.Vector3, tz: number, keepAngle: boolean) => {
    const c = controlsRef.current;
    if (!c) return;
    const fo = camera.position.clone().sub(c.target);
    const to = keepAngle ? fo.clone() : ISO_OFFSET.clone();
    anim.current = { t: 0, ft: c.target.clone(), tt, fz: (camera as THREE.OrthographicCamera).zoom, tz, fo, to };
  };

  useEffect(() => {
    if (preset === "Overview") start(new THREE.Vector3(...CENTER), fitZoom, false);
    if (preset === "Status wall") start(new THREE.Vector3(STATUS_WALL.x - 0.4, 2.4, 1.0), fitZoom * 2.0, false);
    if (preset === "Payroll board") start(new THREE.Vector3(1.6, 1.2, PAYROLL_BOARD.z), fitZoom * 2.1, false);
    if (preset === "Follow" && selectedId != null) {
      const p = posOut.get(selectedId);
      if (p) start(new THREE.Vector3(p.x, 0.6, p.z), fitZoom * 2.2, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, selectedId, size.width, size.height]);

  useEffect(() => {
    if (!zoomCmd.n) return;
    const c = controlsRef.current;
    if (!c) return;
    const cam = camera as THREE.OrthographicCamera;
    anim.current = { t: 0, ft: c.target.clone(), tt: c.target.clone(), fz: cam.zoom, tz: Math.max(12, Math.min(180, cam.zoom * zoomCmd.factor)), fo: camera.position.clone().sub(c.target), to: camera.position.clone().sub(c.target) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomCmd.n]);

  useFrame((_, dt) => {
    const c = controlsRef.current;
    if (!c) return;
    const cam = camera as THREE.OrthographicCamera;
    const a = anim.current;
    if (a) {
      a.t = Math.min(1, a.t + dt / 0.7);
      const k = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
      const target = a.ft.clone().lerp(a.tt, k);
      const off = a.fo.clone().lerp(a.to, k);
      c.target.copy(target);
      cam.position.copy(target).add(off);
      cam.zoom = a.fz + (a.tz - a.fz) * k;
      cam.updateProjectionMatrix();
      c.update();
      if (a.t >= 1) anim.current = null;
    } else if (preset === "Follow" && selectedId != null) {
      const p = posOut.get(selectedId);
      if (p) {
        const off = cam.position.clone().sub(c.target);
        c.target.lerp(new THREE.Vector3(p.x, 0.6, p.z), Math.min(1, dt * 4));
        cam.position.copy(c.target).add(off);
        c.update();
      }
    }
  });
  return null;
}

// ---------------------------------------------------------------------------
// scene root
// ---------------------------------------------------------------------------

function World(props: SceneProps) {
  const { scene, floor, selectedId, onSelect, fx, reduced, frozen, boardFlashAt } = props;
  const posOut = useRef(new Map<number, THREE.Vector3>()).current;
  const firstSeen = useRef<Set<number> | null>(null);
  const controls = useRef<any>(null);
  const per = scene.desksPerFloor;

  // Who belongs on this floor, and where they stand.
  const placed = useMemo(() => {
    const here = scene.employees.filter((e) => (e.desk >= 0 ? Math.floor(e.desk / per) === floor : floor === 0));
    let b = 0;
    let r = 0;
    return here.map((e) => {
      const local = e.desk >= 0 ? e.desk % per : -1;
      const breakSpot = e.pose === "break" && b < BREAK_SPOTS.length ? b++ : -1;
      const receptionSpot = e.pose === "reception" ? r++ : -1;
      return { e, local, target: targetOf(e, local, breakSpot, receptionSpot) };
    });
  }, [scene.employees, floor, per]);

  // Only people who show up after the first snapshot walk in from the door.
  if (!firstSeen.current) firstSeen.current = new Set(scene.employees.map((e) => e.id));
  const occupantAt = useMemo(() => {
    const m = new Map<number, OfficeEmployee>();
    placed.forEach((p) => p.local >= 0 && m.set(p.local, p.e));
    return m;
  }, [placed]);

  return (
    <>
      <color attach="background" args={["#0F130E"]} />
      <hemisphereLight args={["#FFEBD0", "#1A2216", 1.05]} />
      <ambientLight intensity={0.42} color="#E9EDE2" />
      <directionalLight
        position={[CENTER[0] + 9, 17, CENTER[2] + 6]}
        intensity={2.4}
        color="#FFE2B8"
        castShadow={!props.compact}
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-bias={-0.0006}
        target-position={[CENTER[0], 0, CENTER[2]]}
      />
      <pointLight position={[8.3, 2.6, 7.2]} color={LIME} intensity={2.4} distance={10} decay={2} />
      <pointLight position={[3.5, 3.2, 3.5]} color="#FFD9A8" intensity={6} distance={11} decay={2} />
      <pointLight position={[14.5, 3.2, 6.0]} color="#FFD9A8" intensity={5} distance={10} decay={2} />

      <Shell />
      <MeetingRoom />
      <ManagerOffice />
      <Reception />
      <BreakArea />
      <Plant p={[12.3, 0, 3.4]} s={0.9} />
      <Plant p={[4.2, 0, 10.2]} s={0.85} />
      <PayrollBoard scene={scene} flashAt={boardFlashAt} />
      <StatusWall scene={scene} />

      {Array.from({ length: per }, (_, i) => {
        const occ = occupantAt.get(i);
        return <Desk key={i} local={i} occupant={occ} selected={!!occ && occ.id === selectedId} onSelect={onSelect} flashAt={occ ? fx[occ.id]?.payoutAt ?? 0 : 0} />;
      })}

      {placed.map(({ e, target }) => (
        <Character
          key={e.id}
          e={e}
          target={target}
          entrance={!firstSeen.current!.has(e.id)}
          selected={e.id === selectedId}
          onSelect={onSelect}
          fx={fx[e.id]}
          reduced={reduced}
          frozen={frozen}
          posOut={posOut}
        />
      ))}

      <OrbitControls
        ref={controls}
        makeDefault
        target={CENTER}
        enableDamping
        dampingFactor={0.12}
        minPolarAngle={0.42}
        maxPolarAngle={1.18}
        minAzimuthAngle={Math.PI / 4 - 1.0}
        maxAzimuthAngle={Math.PI / 4 + 1.0}
        minZoom={12}
        maxZoom={180}
        screenSpacePanning={false}
        zoomToCursor
      />
      <CameraRig preset={props.preset} selectedId={selectedId} posOut={posOut} zoomCmd={props.zoomCmd} controlsRef={controls} />
    </>
  );
}

export default function OfficeCanvas(props: SceneProps) {
  return (
    <Canvas
      orthographic
      shadows={!props.compact}
      dpr={props.compact ? [1, 1.25] : [1, 1.75]}
      frameloop={props.paused ? "never" : "always"}
      gl={{ antialias: true, powerPreference: "high-performance", toneMappingExposure: 1.15 }}
      camera={{ position: [CENTER[0] + ISO_OFFSET.x, ISO_OFFSET.y, CENTER[2] + ISO_OFFSET.z], zoom: 36, near: 0.1, far: 200 }}
      style={{ touchAction: "none" }}
    >
      <World {...props} />
    </Canvas>
  );
}

