"use client";
// The landing hero's centerpiece: a small working office, seen from above,
// camera drifting slowly on its own. Purely atmospheric — these looks are
// hardcoded, not read from engine state, same as the rest of this landing
// page's placeholder numbers. The real, live, data-driven office is /office.
//
// Three.js materials need real color values, not CSS var() strings, so the
// room's surfaces (floor, desks) are re-tuned per theme here directly; the
// avatars' own outfit colors and the monitor bezels stay fixed in both.
import type { Look } from "@/lib/engine/look";
import type { Theme } from "@/lib/useTheme";
import { DISPLAY, useCanvasTexture } from "../textures";
import { AvatarMesh, type AvatarAnim } from "./AvatarMesh";
import { G, LIME, mat } from "./geo";
import { MiniCanvas } from "./MiniCanvas";

const DESKS: { x: number; z: number; look: Look; anim: AvatarAnim }[] = [
  { x: -1.9, z: -0.9, look: { shirt: "#C8F135", skin: "#D9A47E", hair: "#1E1A16", style: 0, acc: 0 }, anim: "typing" },
  { x: 0, z: -0.9, look: { shirt: "#8A4F3E", skin: "#F1C9A5", hair: "#6B4A2B", style: 1, acc: 1 }, anim: "typing" },
  { x: 1.9, z: -0.9, look: { shirt: "#2F6F6F", skin: "#8A5A3C", hair: "#2C2C30", style: 2, acc: 0 }, anim: "seated" },
  { x: -1.9, z: 0.9, look: { shirt: "#5A4E7A", skin: "#E8B894", hair: "#C9A15A", style: 3, acc: 0 }, anim: "typing" },
  { x: 0, z: 0.9, look: { shirt: "#9A5B6F", skin: "#B57A55", hair: "#8A3B2A", style: 0, acc: 2 }, anim: "typing" },
  { x: 1.9, z: 0.9, look: { shirt: "#3E6E8A", skin: "#6B4430", hair: "#D8D2C4", style: 1, acc: 0 }, anim: "seated" },
];

const PALETTE = {
  dark: { bg: "#0F130E", floor: "#171C15", label: "#1D2518", desk: "#232B20" },
  light: { bg: "#F3F2EC", floor: "#E7E5D8", label: "#D6D3C2", desk: "#D9D6C7" },
};

function FloorLabel({ color }: { color: string }) {
  const tex = useCanvasTexture(640, 128, (g, W, H) => {
    g.fillStyle = color;
    g.font = `800 92px ${DISPLAY}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.letterSpacing = "10px";
    g.fillText("SHIFT", W / 2, H / 2 + 4);
  }, [color]);
  return (
    <mesh position={[0, -0.049, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[5.2, 1.04]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

function Desk({ x, z, look, anim, deskColor }: { x: number; z: number; look: Look; anim: AvatarAnim; deskColor: string }) {
  const top = mat(deskColor);
  const monitorBody = mat("#23251F");
  const screen = mat(LIME, { emissive: LIME, emissiveIntensity: 1.1 });
  const screenOff = mat("#1A1F18");
  const glow = anim === "typing";
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={G.box} material={top} position={[0, 0.425, -0.36]} scale={[0.95, 0.05, 0.52]} castShadow receiveShadow />
      <mesh geometry={G.box} material={mat(deskColor)} position={[-0.42, 0.21, -0.36]} scale={[0.04, 0.42, 0.44]} />
      <mesh geometry={G.box} material={mat(deskColor)} position={[0.42, 0.21, -0.36]} scale={[0.04, 0.42, 0.44]} />
      {/* monitor, facing the avatar */}
      <mesh geometry={G.box} material={monitorBody} position={[0, 0.67, -0.48]} scale={[0.36, 0.22, 0.03]} castShadow />
      <mesh geometry={G.box} material={glow ? screen : screenOff} position={[0, 0.67, -0.465]} scale={[0.3, 0.16, 0.012]} />
      <mesh geometry={G.box} material={monitorBody} position={[0, 0.51, -0.48]} scale={[0.03, 0.08, 0.02]} />
      {glow && <pointLight position={[0, 0.67, -0.4]} color={LIME} intensity={0.35} distance={1.0} decay={2} />}
      {/* avatar faces the desk, not away from it */}
      <group rotation={[0, Math.PI, 0]}>
        <AvatarMesh look={look} anim={anim} />
      </group>
    </group>
  );
}

export default function HeroOffice({ theme = "dark" }: { theme?: Theme }) {
  const p = PALETTE[theme];
  return (
    <MiniCanvas height="100%" camera={[0.3, 5.4, 11.6]} fov={30} autoRotate autoRotateSpeed={1.3} controls bg={p.bg}>
      <mesh geometry={G.box} material={mat(p.floor, { rough: 0.95 })} position={[0, -0.05, 0]} scale={[5.6, 0.1, 2.8]} receiveShadow />
      <FloorLabel color={p.label} />
      {DESKS.map((d, i) => (
        <Desk key={i} {...d} deskColor={p.desk} />
      ))}
    </MiniCanvas>
  );
}
