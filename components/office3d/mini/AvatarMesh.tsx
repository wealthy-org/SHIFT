"use client";
// A standalone character, visually identical to the one standing in the office
// (same body-building code, same deterministic look), but with no pathing and a
// small, self-contained animation set. Used anywhere a person's avatar shows up
// outside the office scene itself: clock-in, the leaderboard podium, the desk
// diorama, payday.
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { Look } from "@/lib/engine/look";
import { G, mat } from "./geo";
import { useMiniReduced } from "./MiniCanvas";

export type AvatarAnim = "idle" | "typing" | "wave" | "cheer" | "bow";

export function AvatarMesh({ look, anim = "idle", reduced }: { look: Look; anim?: AvatarAnim; reduced?: boolean }) {
  const ctxReduced = useMiniReduced();
  const effReduced = reduced ?? ctxReduced;
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);

  const shirt = mat(look.shirt, { rough: 0.85 });
  const skin = mat(look.skin, { rough: 0.6 });
  const hair = mat(look.hair, { rough: 0.9 });
  const pants = mat("#1F2330");
  const dark = mat("#111111");

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (effReduced) return;
    if (root.current) root.current.position.y = anim === "idle" || anim === "wave" ? Math.sin(t * 1.5) * 0.02 : 0;
    if (head.current) head.current.rotation.y = anim === "idle" ? Math.sin(t * 0.55) * 0.1 : 0;
    if (!armL.current || !armR.current) return;
    if (anim === "wave") {
      armR.current.rotation.x = -Math.PI + 0.3;
      armR.current.rotation.z = Math.sin(t * 7) * 0.35;
      armL.current.rotation.x = -0.15;
      armL.current.rotation.z = 0;
    } else if (anim === "cheer") {
      armL.current.rotation.x = -Math.PI + Math.sin(t * 9) * 0.22;
      armR.current.rotation.x = -Math.PI - Math.sin(t * 9) * 0.22;
      armL.current.rotation.z = 0;
      armR.current.rotation.z = 0;
    } else if (anim === "typing") {
      armL.current.rotation.x = -1.15 + Math.sin(t * 16) * 0.07;
      armR.current.rotation.x = -1.15 + Math.sin(t * 16 + 1.6) * 0.07;
      armL.current.rotation.z = 0;
      armR.current.rotation.z = 0;
    } else if (anim === "bow") {
      armL.current.rotation.x = -0.3;
      armR.current.rotation.x = -0.3;
    } else {
      armL.current.rotation.x = Math.sin(t * 1.1) * 0.03;
      armR.current.rotation.x = -Math.sin(t * 1.1) * 0.03;
      armL.current.rotation.z = 0;
      armR.current.rotation.z = 0;
    }
    if (root.current) root.current.rotation.x = anim === "bow" ? Math.min(0.22, Math.max(0, Math.sin(t * 1.4)) * 0.22) : 0;
  });

  return (
    <group ref={root}>
      <mesh geometry={G.box} material={pants} position={[-0.075, 0.22, 0]} scale={[0.11, 0.44, 0.13]} castShadow />
      <mesh geometry={G.box} material={pants} position={[0.075, 0.22, 0]} scale={[0.11, 0.44, 0.13]} castShadow />
      <mesh geometry={G.box} material={dark} position={[-0.075, 0.025, 0.04]} scale={[0.12, 0.05, 0.2]} />
      <mesh geometry={G.box} material={dark} position={[0.075, 0.025, 0.04]} scale={[0.12, 0.05, 0.2]} />
      <RoundedBox args={[0.36, 0.44, 0.22]} radius={0.06} smoothness={3} position={[0, 0.65, 0]} material={shirt} castShadow />
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
  );
}

