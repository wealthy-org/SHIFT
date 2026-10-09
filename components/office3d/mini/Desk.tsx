"use client";
// A single desk, lifted out of the office at 1:1 scale, for "My desk". Same
// geometry proportions as the office's own Desk component, so it reads as the
// same place, just zoomed in.
import type { Look } from "@/lib/engine/look";
import type { Theme } from "@/lib/useTheme";
import { DISPLAY, MONO, fit, useCanvasTexture } from "../textures";
import { AvatarMesh } from "./AvatarMesh";
import { G, LIME, mat } from "./geo";
import { MiniCanvas } from "./MiniCanvas";

function MonitorScreen({ ticker, score, working }: { ticker: string; score: number; working: boolean }) {
  const tex = useCanvasTexture(
    256,
    152,
    (g, W, H) => {
      g.fillStyle = working ? "#16200F" : "#0B0E0A";
      g.fillRect(0, 0, W, H);
      if (!working) {
        g.fillStyle = "#3A4436";
        g.font = `600 26px ${MONO}`;
        g.fillText(ticker, 18, 40);
        return;
      }
      g.fillStyle = LIME;
      g.font = `600 28px ${MONO}`;
      g.textBaseline = "top";
      g.fillText(fit(g, ticker, W - 36), 18, 14);
      g.fillStyle = "#E9EDE2";
      g.font = `800 50px ${DISPLAY}`;
      g.fillText(score.toFixed(1), 18, 52);
      g.fillStyle = "#2A3127";
      g.fillRect(0, H - 6, W, 6);
      g.fillStyle = LIME;
      g.fillRect(0, H - 6, W * Math.min(1, score / 100), 6);
    },
    [ticker, working, score.toFixed(1)],
  );
  return (
    <mesh position={[0, 0, 0.026]}>
      <planeGeometry args={[0.56, 0.33]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

const PALETTE = {
  dark: { bg: "#0F130E", top: "#3A4535", leg: "#1E241B" },
  light: { bg: "#F3F2EC", top: "#D9D6C7", leg: "#B9B6A7" },
};

export default function Desk({ look, ticker, score, working, theme = "dark" }: { look: Look; ticker: string; score: number; working: boolean; theme?: Theme }) {
  const p = PALETTE[theme];
  const top = mat(p.top, { rough: 0.62 });
  const leg = mat(p.leg);
  return (
    <MiniCanvas height={230} camera={[2.2, 1.0, 2.7]} fov={34} bg={p.bg}>
      <group position={[0, -0.6, 0]}>
        <mesh geometry={G.box} material={top} position={[0, 0.5, 0]} scale={[1.3, 0.05, 0.72]} castShadow receiveShadow />
        <mesh geometry={G.box} material={leg} position={[-0.58, 0.25, 0]} scale={[0.05, 0.5, 0.62]} />
        <mesh geometry={G.box} material={leg} position={[0.58, 0.25, 0]} scale={[0.05, 0.5, 0.62]} />
        <group position={[0, 0.8, -0.2]}>
          <mesh geometry={G.box} material={mat("#0F130E")} position={[0, 0, 0]} scale={[0.62, 0.38, 0.04]} />
          <MonitorScreen ticker={ticker} score={score} working={working} />
          <mesh geometry={G.box} material={leg} position={[0, -0.24, 0]} scale={[0.05, 0.12, 0.04]} />
        </group>
        <group position={[0, 0, 0.46]}>
          <mesh geometry={G.box} material={mat("#1D231B")} position={[0, 0.265, 0]} scale={[0.5, 0.07, 0.46]} />
          <mesh geometry={G.box} material={mat("#1D231B")} position={[0, 0.58, 0.22]} scale={[0.5, 0.5, 0.06]} />
        </group>
        <group position={[0, 0, 0.46]} rotation={[0, Math.PI, 0]}>
          <AvatarMesh look={look} anim={working ? "typing" : "seated"} chair={false} scale={1} />
        </group>
        {working && <pointLight position={[0, 0.85, -0.05]} color={LIME} intensity={0.8} distance={1.6} decay={2} />}
      </group>
    </MiniCanvas>
  );
}
