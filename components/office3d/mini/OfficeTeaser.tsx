"use client";
// A decorative, auto-rotating row of desks for the marketing landing page.
// Purely atmospheric — these looks are hardcoded, not read from engine state,
// same spirit as the rest of this landing section's placeholder numbers. The
// real, live, data-driven office is the /office route.
import type { Look } from "@/lib/engine/look";
import { AvatarMesh } from "./AvatarMesh";
import { G, LIME, mat } from "./geo";
import { MiniCanvas } from "./MiniCanvas";

const LOOKS: Look[] = [
  { shirt: "#C8F135", skin: "#D9A47E", hair: "#1E1A16", style: 0, acc: 0 },
  { shirt: "#8A4F3E", skin: "#F1C9A5", hair: "#6B4A2B", style: 1, acc: 1 },
  { shirt: "#2F6F6F", skin: "#8A5A3C", hair: "#2C2C30", style: 2, acc: 2 },
  { shirt: "#5A4E7A", skin: "#E8B894", hair: "#C9A15A", style: 3, acc: 0 },
];

export default function OfficeTeaser() {
  const xs = [-1.5, -0.5, 0.5, 1.5];
  const desk = mat("#232B20");
  const floor = mat("#171C15", { rough: 0.95 });
  const monitorBody = mat("#0F130E");
  const screen = mat(LIME, { emissive: LIME, emissiveIntensity: 1.1 });
  return (
    <MiniCanvas height={220} camera={[0, 2.15, 3.7]} fov={34} autoRotate autoRotateSpeed={0.9} controls bg="#0F130E">
      <mesh geometry={G.box} material={floor} position={[0, -0.05, 0]} scale={[5.2, 0.1, 2.4]} receiveShadow />
      {xs.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh geometry={G.box} material={desk} position={[0, 0.36, -0.36]} scale={[0.9, 0.05, 0.5]} castShadow receiveShadow />
          {/* monitor, facing the avatar */}
          <mesh geometry={G.box} material={monitorBody} position={[0, 0.58, -0.48]} scale={[0.34, 0.21, 0.03]} castShadow />
          <mesh geometry={G.box} material={screen} position={[0, 0.58, -0.465]} scale={[0.28, 0.15, 0.012]} />
          <mesh geometry={G.box} material={monitorBody} position={[0, 0.44, -0.48]} scale={[0.03, 0.08, 0.02]} />
          <pointLight position={[0, 0.58, -0.4]} color={LIME} intensity={0.8} distance={1.1} decay={2} />
          {/* avatar faces the desk, not away from it */}
          <group rotation={[0, Math.PI, 0]}>
            <AvatarMesh look={LOOKS[i % LOOKS.length]} anim="typing" />
          </group>
        </group>
      ))}
    </MiniCanvas>
  );
}
