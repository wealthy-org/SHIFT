"use client";
// The top-3 podium, rendered as three pedestals with the real avatars standing
// on them. Confetti fires once when the #1 spot actually changes hands, not on
// every poll — the leaderboard refetches every second and most ticks change
// nothing worth celebrating.
import { useEffect, useRef, useState } from "react";
import type { Look } from "@/lib/engine/look";
import type { Theme } from "@/lib/useTheme";
import { DISPLAY, useCanvasTexture } from "../textures";
import { AvatarMesh } from "./AvatarMesh";
import { Confetti } from "./Fx";
import { G, LIME, mat } from "./geo";
import { MiniCanvas } from "./MiniCanvas";

const PALETTE = {
  dark: { bg: "#101611", unlit: "#2A3127", unlitInk: "#E9EDE2" },
  light: { bg: "#F3F2EC", unlit: "#D9D6C7", unlitInk: "#161A14" },
};

function Pedestal({ h, n, lit, unlit, unlitInk }: { h: number; n: number; lit: boolean; unlit: string; unlitInk: string }) {
  const tex = useCanvasTexture(
    128,
    128,
    (g, W, H) => {
      g.fillStyle = lit ? "#0F130E" : unlitInk;
      g.font = `900 72px ${DISPLAY}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(n), W / 2, H / 2 + 4);
    },
    [n, lit, unlitInk],
  );
  return (
    <group>
      <mesh geometry={G.box} material={mat(lit ? LIME : unlit, { emissive: lit ? LIME : "#000000", emissiveIntensity: lit ? 0.3 : 0 })} position={[0, h / 2, 0]} scale={[0.62, h, 0.62]} castShadow receiveShadow />
      <mesh position={[0, h + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.46, 0.46]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
    </group>
  );
}

export type PodiumEntry = { id: number; look: Look };

export default function Podium({ top3, theme = "dark" }: { top3: (PodiumEntry | null)[]; theme?: Theme }) {
  const p = PALETTE[theme];
  const order = [top3[1], top3[0], top3[2]];
  const heights = [0.4, 0.6, 0.28];
  const xs = [-0.92, 0, 0.92];
  const leaderId = top3[0]?.id;
  const prevLeader = useRef<number | undefined>(undefined);
  const [confettiAt, setConfettiAt] = useState(0);

  useEffect(() => {
    if (leaderId == null) return;
    if (prevLeader.current !== undefined && prevLeader.current !== leaderId) setConfettiAt(performance.now());
    prevLeader.current = leaderId;
  }, [leaderId]);

  return (
    <MiniCanvas height={240} camera={[0, 1.0, 4.1]} fov={34} bg={p.bg}>
      <group position={[0, -0.82, 0]}>
        {order.map((e, i) =>
          e ? (
            <group key={e.id} position={[xs[i], 0, 0]}>
              <Pedestal h={heights[i]} n={top3.indexOf(e) + 1} lit={i === 1} unlit={p.unlit} unlitInk={p.unlitInk} />
              <group position={[0, heights[i], 0]}>
                <AvatarMesh look={e.look} anim={i === 1 ? "cheer" : "idle"} />
              </group>
            </group>
          ) : null,
        )}
        <Confetti startAt={confettiAt} origin={[0, 1.95, 0]} />
      </group>
    </MiniCanvas>
  );
}
