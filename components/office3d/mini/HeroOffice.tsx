"use client";
// The landing hero's centerpiece: a small working office, seen from above,
// camera drifting slowly on its own. Purely atmospheric — these looks are
// hardcoded, not read from engine state, same as the rest of this landing
// page's placeholder numbers. The real, live, data-driven office is /office.
import type { Look } from "@/lib/engine/look";
import { DISPLAY, useCanvasTexture } from "../textures";
import { AvatarMesh, type AvatarAnim } from "./AvatarMesh";
import { G, LIME, mat } from "./geo";
import { MiniCanvas } from "./MiniCanvas";

const DESKS: { x: number; z: number; look: Look; anim: AvatarAnim }[] = [
  { x: -1.9, z: -0.9, look: { shirt: "#C8F135", skin: "#D9A47E", hair: "#1E1A16", style: 0, acc: 0 }, anim: "typing" },
  { x: 0, z: -0.9, look: { shirt: "#8A4F3E", skin: "#F1C9A5", hair: "#6B4A2B", style: 1, acc: 1 }, anim: "typing" },
  { x: 1.9, z: -0.9, look: { shirt: "#2F6F6F", skin: "#8A5A3C", hair: "#2C2C30", style: 2, acc: 0 }, anim: "idle" },
  { x: -1.9, z: 0.9, look: { shirt: "#5A4E7A", skin: "#E8B894", hair: "#C9A15A", style: 3, acc: 0 }, anim: "typing" },
  { x: 0, z: 0.9, look: { shirt: "#9A5B6F", skin: "#B57A55", hair: "#8A3B2A", style: 0, acc: 2 }, anim: "typing" },
  { x: 1.9, z: 0.9, look: { shirt: "#3E6E8A", skin: "#6B4430", hair: "#D8D2C4", style: 1, acc: 0 }, anim: "idle" },
];

function FloorLabel() {
  const tex = useCanvasTexture(640, 128, (g, W, H) => {
    g.fillStyle = "#1D2518";
    g.font = `800 92px ${DISPLAY}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.letterSpacing = "10px";
    g.fillText("SHIFT", W / 2, H / 2 + 4);
  }, []);
  return (
    <mesh position={[0, -0.049, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[5.2, 1.04]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

function Desk({ x, z, look, anim }: { x: number; z: number; look: Look; anim: AvatarAnim }) {
  const top = mat("#232B20");
  const glow = anim === "typing";
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={G.box} material={top} position={[0, 0.36, -0.36]} scale={[0.95, 0.05, 0.52]} castShadow receiveShadow />
      {glow && <pointLight position={[0, 0.55, -0.36]} color={LIME} intensity={0.9} distance={1.4} decay={2} />}
      <AvatarMesh look={look} anim={anim} />
    </group>
  );
}

export default function HeroOffice() {
  return (
    <MiniCanvas height="100%" camera={[0.5, 4.3, 6.3]} fov={30} autoRotate autoRotateSpeed={1.3} controls bg="#0F130E">
      <hemisphereLight args={["#FFEBD0", "#1A2216", 0.55]} />
      <mesh geometry={G.box} material={mat("#171C15", { rough: 0.95 })} position={[0, -0.05, 0]} scale={[5.6, 0.1, 2.8]} receiveShadow />
      <FloorLabel />
      {DESKS.map((d, i) => (
        <Desk key={i} {...d} />
      ))}
    </MiniCanvas>
  );
}
