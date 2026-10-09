"use client";

// Room dressing: lounge, focus booths, hot desks, shelves, windows, planters,
// whiteboard. Purely visual and static. Nothing here is on a walking route, and
// every item stays inside the empty regions of layout.ts.
import { memo } from "react";
import * as THREE from "three";
import { DISPLAY, MONO, roundRect, useCanvasTexture } from "./textures";

const LIME = "#C8F135";
const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
const ico = new THREE.IcosahedronGeometry(1, 1);

const cache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, o: { rough?: number; emissive?: string; ei?: number; flat?: boolean; opacity?: number } = {}) {
  const key = JSON.stringify([color, o]);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.8,
      metalness: 0.04,
      emissive: o.emissive ?? "#000000",
      emissiveIntensity: o.ei ?? 0,
      flatShading: o.flat ?? false,
      transparent: o.opacity !== undefined,
      opacity: o.opacity ?? 1,
      depthWrite: o.opacity === undefined,
    });
    cache.set(key, m);
  }
  return m;
}

type V3 = [number, number, number];
function B({ p, s, m, cast = true }: { p: V3; s: V3; m: THREE.Material; cast?: boolean }) {
  return <mesh geometry={box} material={m} position={p} scale={s} castShadow={cast} receiveShadow />;
}
function Cyl({ p, r, h, m, cast = true }: { p: V3; r: number; h: number; m: THREE.Material; cast?: boolean }) {
  return <mesh geometry={cyl} material={m} position={[p[0], p[1] + h / 2, p[2]]} scale={[r, h, r]} castShadow={cast} receiveShadow />;
}

type Tone = { wood: string; woodDark: string; fabric: string; fabric2: string; rug: string; rugEdge: string; metal: string; pot: string; leaf: string; leaf2: string; glass: string; glassEi: number; paper: string };
const TONES: Record<"dark" | "light", Tone> = {
  dark: { wood: "#4A3424", woodDark: "#2F2218", fabric: "#3B3F58", fabric2: "#2E3A28", rug: "#202A1D", rugEdge: "#2F3A2A", metal: "#2A3324", pot: "#3A4436", leaf: "#4E7A3A", leaf2: "#5E8C44", glass: "#5C7FA0", glassEi: 0.45, paper: "#E4E7DA" },
  light: { wood: "#B79A72", woodDark: "#8D7455", fabric: "#7F86A8", fabric2: "#B5C28A", rug: "#D4D0BC", rugEdge: "#C2BEA8", metal: "#B3AE9C", pot: "#B9B6A6", leaf: "#6E9A4C", leaf2: "#86B05A", glass: "#CFE6F2", glassEi: 0.25, paper: "#F7F6EF" },
};

function Plant({ p, s = 1, tall = false, t }: { p: V3; s?: number; tall?: boolean; t: Tone }) {
  return (
    <group position={p} scale={s}>
      <Cyl p={[0, 0, 0]} r={0.17} h={0.3} m={mat(t.pot)} />
      <mesh geometry={ico} material={mat(t.leaf, { flat: true, rough: 0.9 })} position={[0, tall ? 0.95 : 0.58, 0]} scale={tall ? [0.3, 0.55, 0.3] : [0.3, 0.3, 0.3]} castShadow />
      <mesh geometry={ico} material={mat(t.leaf2, { flat: true, rough: 0.9 })} position={[0.1, tall ? 1.35 : 0.82, 0.04]} scale={tall ? [0.2, 0.34, 0.2] : [0.18, 0.18, 0.18]} castShadow />
      {tall && <Cyl p={[0, 0.3, 0]} r={0.03} h={0.45} m={mat(t.woodDark)} cast={false} />}
    </group>
  );
}

function Rug({ p, s, t }: { p: [number, number]; s: [number, number]; t: Tone }) {
  return (
    <group position={[p[0], 0.006, p[1]]}>
      <mesh geometry={box} material={mat(t.rugEdge, { rough: 1 })} scale={[s[0], 0.012, s[1]]} receiveShadow />
      <mesh geometry={box} material={mat(t.rug, { rough: 1 })} position={[0, 0.007, 0]} scale={[s[0] - 0.22, 0.012, s[1] - 0.22]} receiveShadow />
    </group>
  );
}

function Sofa({ t, len = 2.4 }: { t: Tone; len?: number }) {
  // faces -z, back at +z (same convention as the break area sofa)
  const f = mat(t.fabric, { rough: 0.95 });
  const f2 = mat(t.fabric, { rough: 0.95 });
  return (
    <group>
      <B p={[0, 0.2, 0]} s={[len, 0.4, 0.8]} m={f} />
      <B p={[0, 0.62, 0.3]} s={[len, 0.5, 0.2]} m={f2} />
      <B p={[-len / 2 + 0.1, 0.42, 0]} s={[0.2, 0.3, 0.8]} m={f2} />
      <B p={[len / 2 - 0.1, 0.42, 0]} s={[0.2, 0.3, 0.8]} m={f2} />
      <B p={[-len / 4, 0.46, -0.04]} s={[len / 2 - 0.25, 0.1, 0.6]} m={mat(t.fabric2, { rough: 0.95 })} cast={false} />
      <B p={[len / 4, 0.46, -0.04]} s={[len / 2 - 0.25, 0.1, 0.6]} m={mat(t.fabric2, { rough: 0.95 })} cast={false} />
    </group>
  );
}

function Armchair({ t }: { t: Tone }) {
  const f = mat(t.fabric2, { rough: 0.95 });
  return (
    <group>
      <B p={[0, 0.2, 0]} s={[0.75, 0.4, 0.75]} m={f} />
      <B p={[0, 0.58, 0.3]} s={[0.75, 0.46, 0.18]} m={f} />
      <B p={[-0.33, 0.42, 0]} s={[0.12, 0.3, 0.75]} m={f} />
      <B p={[0.33, 0.42, 0]} s={[0.12, 0.3, 0.75]} m={f} />
    </group>
  );
}

function FloorLamp({ p, t }: { p: V3; t: Tone }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0, 0]} r={0.14} h={0.03} m={mat(t.metal)} />
      <Cyl p={[0, 0.03, 0]} r={0.015} h={1.3} m={mat(t.metal)} cast={false} />
      <mesh geometry={cyl} material={mat("#FFE9B8", { emissive: "#FFD58A", ei: 0.9 })} position={[0, 1.45, 0]} scale={[0.17, 0.24, 0.17]} />
      <pointLight position={[0, 1.4, 0]} color="#FFD7A0" intensity={1.6} distance={4} decay={2} />
    </group>
  );
}

function Bookshelf({ t, w = 1.6, rows = 4, seed = 1 }: { t: Tone; w?: number; rows?: number; seed?: number }) {
  // faces +z, depth along z
  const books: [number, number, number, string][] = [];
  const colors = ["#C8F135", "#8A4F3E", "#3E5A8A", "#E4E7DA", "#7A6A3E", "#2F6F6F", "#9A5B6F", "#5A4E7A"];
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const h = rows * 0.38 + 0.1;
  for (let row = 0; row < rows; row++) {
    let x = -w / 2 + 0.07;
    while (x < w / 2 - 0.12) {
      const bw = 0.05 + rnd() * 0.05;
      const bh = 0.2 + rnd() * 0.12;
      if (rnd() > 0.12) books.push([x + bw / 2, 0.12 + row * 0.38 + bh / 2 + 0.02, bh, colors[Math.floor(rnd() * colors.length)]]);
      books.push([0, 0, bw, ""]);
      x += bw + 0.012;
    }
  }
  let cursor: number[] = [];
  void cursor;
  const shown = books.filter((b) => b[3]);
  return (
    <group>
      <B p={[0, h / 2, -0.02]} s={[w, h, 0.34]} m={mat(t.woodDark)} />
      {Array.from({ length: rows }, (_, i) => (
        <B key={i} p={[0, 0.12 + i * 0.38 + 0.02, 0.07]} s={[w - 0.08, 0.03, 0.22]} m={mat(t.wood)} cast={false} />
      ))}
      {shown.map((b, i) => (
        <B key={i} p={[b[0], b[1], 0.08]} s={[b[2] * 0 + 0.055, b[2], 0.18]} m={mat(b[3], { rough: 0.7 })} cast={false} />
      ))}
    </group>
  );
}

function Cabinet({ t, tint }: { t: Tone; tint: string }) {
  return (
    <group>
      <B p={[0, 0.5, 0]} s={[0.5, 1.0, 0.5]} m={mat(tint)} />
      {[0.2, 0.5, 0.8].map((y) => (
        <group key={y}>
          <B p={[0, y, 0.255]} s={[0.4, 0.22, 0.012]} m={mat(t.metal)} cast={false} />
          <B p={[0, y, 0.265]} s={[0.12, 0.02, 0.012]} m={mat(LIME, { emissive: LIME, ei: 0.4 })} cast={false} />
        </group>
      ))}
    </group>
  );
}

function Window({ p, w, h, t, rot = 0 }: { p: V3; w: number; h: number; t: Tone; rot?: number }) {
  const frame = mat(t.metal);
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <B p={[0, 0, 0]} s={[w + 0.1, h + 0.1, 0.05]} m={frame} cast={false} />
      <mesh position={[0, 0, 0.03]} geometry={box} scale={[w, h, 0.01]} material={mat(t.glass, { emissive: t.glass, ei: t.glassEi, rough: 0.2 })} />
      <B p={[0, 0, 0.04]} s={[0.03, h, 0.02]} m={frame} cast={false} />
      <B p={[0, 0, 0.04]} s={[w, 0.03, 0.02]} m={frame} cast={false} />
    </group>
  );
}

function Frame({ p, w, h, color, rot = 0 }: { p: V3; w: number; h: number; color: string; rot?: number }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <B p={[0, 0, 0]} s={[w + 0.08, h + 0.08, 0.04]} m={mat("#161A14")} cast={false} />
      <B p={[0, 0, 0.025]} s={[w, h, 0.01]} m={mat(color, { rough: 0.6 })} cast={false} />
      <B p={[-w * 0.2, -h * 0.1, 0.035]} s={[w * 0.35, h * 0.5, 0.005]} m={mat(LIME)} cast={false} />
    </group>
  );
}

const Whiteboard = memo(function Whiteboard({ t }: { t: Tone }) {
  const tex = useCanvasTexture(1024, 600, (g, W, H) => {
    g.fillStyle = t.paper;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#161A14";
    g.font = `900 78px ${DISPLAY}`;
    g.textBaseline = "top";
    g.fillText("EPOCH ROADMAP", 44, 34);
    g.fillRect(44, 128, W - 88, 5);
    const steps = ["HIRE", "LAUNCH", "WORK", "PAY"];
    steps.forEach((s, i) => {
      const x = 44 + i * 236;
      roundRect(g, x, 190, 200, 120, 22);
      g.fillStyle = i === 2 ? LIME : "#FFFFFF";
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = "#161A14";
      g.stroke();
      g.fillStyle = "#161A14";
      g.font = `800 44px ${DISPLAY}`;
      g.textAlign = "center";
      g.fillText(s, x + 100, 228);
      g.textAlign = "left";
      if (i < 3) {
        g.beginPath();
        g.moveTo(x + 204, 250);
        g.lineTo(x + 232, 250);
        g.stroke();
      }
    });
    g.font = `500 34px ${MONO}`;
    g.fillStyle = "#5A6156";
    ["score = hours x quality", "rank up at 100", "pool splits by score"].forEach((l, i) => g.fillText(`- ${l}`, 60, 366 + i * 56));
  }, [t.paper]);
  return (
    <group>
      <B p={[0, 0, -0.02]} s={[2.6, 1.5, 0.05]} m={mat("#161A14")} cast={false} />
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[2.5, 1.4]} />
        <meshStandardMaterial map={tex} roughness={0.7} />
      </mesh>
      <B p={[0, -0.78, 0.04]} s={[2.0, 0.04, 0.08]} m={mat("#2A3324")} cast={false} />
    </group>
  );
});

function Booth({ p, t }: { p: [number, number]; t: Tone }) {
  // Low half-height pod so it never hides the status wall behind it.
  return (
    <group position={[p[0], 0, p[1]]}>
      <B p={[0, 0.05, 0]} s={[1.2, 0.1, 1.1]} m={mat(t.metal)} />
      <B p={[-0.58, 0.7, 0]} s={[0.04, 1.2, 1.1]} m={mat(t.woodDark)} />
      <B p={[0.58, 0.7, 0]} s={[0.04, 1.2, 1.1]} m={mat(t.woodDark)} />
      <B p={[0, 0.7, -0.53]} s={[1.2, 1.2, 0.04]} m={mat(t.woodDark)} />
      <B p={[0, 0.62, -0.38]} s={[0.9, 0.04, 0.3]} m={mat(t.wood)} />
      <Cyl p={[0, 0.1, 0.1]} r={0.17} h={0.3} m={mat(t.fabric)} />
      <mesh geometry={box} material={mat(LIME, { emissive: LIME, ei: 1 })} position={[0, 0.85, -0.5]} scale={[0.4, 0.22, 0.01]} />
    </group>
  );
}

function HotDesks({ t }: { t: Tone }) {
  return (
    <group position={[15.3, 0, 2.3]}>
      <B p={[0, 1.0, 0]} s={[3.4, 0.06, 0.62]} m={mat(t.wood)} />
      <B p={[0, 0.5, 0.05]} s={[3.3, 1.0, 0.1]} m={mat(t.woodDark)} />
      {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
        <group key={i}>
          <B p={[x, 1.2, -0.15]} s={[0.46, 0.3, 0.03]} m={mat("#161A14")} />
          <mesh geometry={box} material={mat(i % 2 ? LIME : "#6E9A4C", { emissive: i % 2 ? LIME : "#6E9A4C", ei: 0.7 })} position={[x, 1.2, -0.13]} scale={[0.4, 0.24, 0.01]} />
          <Cyl p={[x, 0.0, 0.62]} r={0.16} h={0.68} m={mat(t.fabric)} />
          <Cyl p={[x, 0.0, 0.62]} r={0.03} h={0.68} m={mat(t.metal)} cast={false} />
        </group>
      ))}
    </group>
  );
}

function FrontPlanter({ t }: { t: Tone }) {
  const bushes = Array.from({ length: 9 }, (_, i) => 5.2 + i * 0.7);
  return (
    <group position={[0, 0, 13.2]}>
      <B p={[8.0, 0.22, 0]} s={[6.6, 0.44, 0.5]} m={mat(t.pot)} />
      <B p={[8.0, 0.45, 0]} s={[6.5, 0.04, 0.42]} m={mat("#2E2318", { rough: 1 })} cast={false} />
      {bushes.map((x, i) => (
        <mesh key={i} geometry={ico} material={mat(i % 2 ? t.leaf : t.leaf2, { flat: true, rough: 0.9 })} position={[x, 0.7 + (i % 3) * 0.05, 0]} scale={[0.3, 0.26 + (i % 3) * 0.04, 0.26]} castShadow />
      ))}
    </group>
  );
}

function Bench({ p, t }: { p: [number, number]; t: Tone }) {
  return (
    <group position={[p[0], 0, p[1]]}>
      <B p={[0, 0.4, 0]} s={[1.5, 0.07, 0.45]} m={mat(t.wood)} />
      <B p={[-0.62, 0.2, 0]} s={[0.07, 0.4, 0.4]} m={mat(t.metal)} />
      <B p={[0.62, 0.2, 0]} s={[0.07, 0.4, 0.4]} m={mat(t.metal)} />
    </group>
  );
}

function WaterCooler({ p, t }: { p: V3; t: Tone }) {
  return (
    <group position={p}>
      <B p={[0, 0.45, 0]} s={[0.34, 0.9, 0.34]} m={mat(t.paper)} />
      <Cyl p={[0, 0.9, 0]} r={0.15} h={0.36} m={mat("#9ED2E8", { opacity: 0.7, rough: 0.1 })} cast={false} />
      <B p={[0, 0.7, 0.18]} s={[0.1, 0.04, 0.04]} m={mat(LIME, { emissive: LIME, ei: 0.6 })} cast={false} />
    </group>
  );
}

function Printer({ p, t }: { p: V3; t: Tone }) {
  return (
    <group position={p}>
      <B p={[0, 0.45, 0]} s={[0.6, 0.9, 0.5]} m={mat(t.woodDark)} />
      <B p={[0, 1.0, 0]} s={[0.55, 0.22, 0.45]} m={mat(t.paper)} />
      <B p={[0, 1.13, 0.0]} s={[0.5, 0.04, 0.4]} m={mat(t.metal)} cast={false} />
      <B p={[0.2, 1.0, 0.24]} s={[0.1, 0.03, 0.02]} m={mat(LIME, { emissive: LIME, ei: 1 })} cast={false} />
    </group>
  );
}

export default function Decor({ dark }: { dark: boolean }) {
  const t = TONES[dark ? "dark" : "light"];
  return (
    <group>
      {/* carpet under the desk block */}
      <Rug p={[8.5, 7.2]} s={[7.6, 7.4]} t={t} />

      {/* lounge, back left */}
      <Rug p={[2.3, 1.9]} s={[3.6, 2.6]} t={t} />
      <group position={[2.2, 0, 0.5]} rotation={[0, Math.PI, 0]}><Sofa t={t} /></group>
      <group position={[3.6, 0, 1.9]} rotation={[0, Math.PI / 2, 0]}><Armchair t={t} /></group>
      <B p={[2.2, 0.28, 1.7]} s={[1.1, 0.05, 0.6]} m={mat(t.wood)} />
      <B p={[2.2, 0.13, 1.7]} s={[0.9, 0.26, 0.4]} m={mat(t.woodDark)} />
      <mesh geometry={cyl} material={mat(t.paper)} position={[2.0, 0.34, 1.7]} scale={[0.04, 0.07, 0.04]} />
      <group position={[0.28, 0, 1.4]} rotation={[0, Math.PI / 2, 0]}><Bookshelf t={t} w={1.7} rows={4} seed={3} /></group>
      <FloorLamp p={[3.9, 0, 0.45]} t={t} />
      <Plant p={[0.55, 0, 2.75]} s={1.1} tall t={t} />
      <Plant p={[3.95, 0, 2.85]} s={0.85} t={t} />
      <Window p={[1.2, 1.9, 0.03]} w={1.0} h={1.3} t={t} />
      <Window p={[2.5, 1.9, 0.03]} w={1.0} h={1.3} t={t} />
      <Window p={[3.8, 1.9, 0.03]} w={1.0} h={1.3} t={t} />

      {/* back wall, above the meeting room */}
      <Frame p={[5.4, 2.55, 0.04]} w={0.7} h={0.45} color={t.paper} />
      <Frame p={[7.0, 2.55, 0.04]} w={0.9} h={0.45} color={t.paper} />
      <Frame p={[8.6, 2.55, 0.04]} w={0.7} h={0.45} color={t.paper} />

      {/* focus booths between the meeting room and the status wall */}
      <Booth p={[10.2, 0.75]} t={t} />
      <Booth p={[11.5, 0.75]} t={t} />
      <Plant p={[9.95, 0, 2.5]} s={0.9} t={t} />

      {/* hot desks, back right */}
      <HotDesks t={t} />
      <Plant p={[17.15, 0, 2.7]} s={1.1} tall t={t} />

      {/* left wall: archive, copier, water */}
      <group position={[0.3, 0, 7.15]} rotation={[0, Math.PI / 2, 0]}><Cabinet t={t} tint={t.woodDark} /></group>
      <group position={[0.3, 0, 7.7]} rotation={[0, Math.PI / 2, 0]}><Cabinet t={t} tint={t.metal} /></group>
      <group position={[0.3, 0, 8.25]} rotation={[0, Math.PI / 2, 0]}><Printer p={[0, 0, 0]} t={t} /></group>
      <WaterCooler p={[0.35, 0, 6.5]} t={t} />
      <group position={[0.05, 1.7, 11.6]} rotation={[0, Math.PI / 2, 0]}><Whiteboard t={t} /></group>
      <Window p={[0.03, 1.9, 10.2]} w={0.9} h={1.2} t={t} rot={Math.PI / 2} />

      {/* front edge: planter and benches */}
      <FrontPlanter t={t} />
      <Bench p={[6.6, 12.35]} t={t} />
      <Bench p={[9.4, 12.35]} t={t} />
      <Plant p={[4.5, 0, 12.2]} s={1} tall t={t} />
      <Plant p={[11.6, 0, 12.5]} s={0.9} t={t} />

      {/* floor labels are in the shell; extra zone markers */}
    </group>
  );
}
