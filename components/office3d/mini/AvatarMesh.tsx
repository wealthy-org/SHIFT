"use client";
// A standalone character: the same rigged GLB the office uses, with the same
// deterministic look, but no pathing and a tiny clip set. Used anywhere a
// person's avatar shows up outside the office scene itself: clock-in, the
// leaderboard podium, the desk diorama, payday, the landing hero.
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import type { Look } from "@/lib/engine/look";
import { useCharacterRig, type ModelApi } from "../CharacterModel";
import { G, mat } from "./geo";
import { useMiniReduced } from "./MiniCanvas";

export type AvatarAnim = "idle" | "seated" | "typing" | "wave" | "cheer" | "bow";

const CLIP: Record<AvatarAnim, string> = { idle: "idle_breathe", seated: "seated_idle", typing: "typing_loop", wave: "wave", cheer: "celebrate_promotion", bow: "disappointed" };
// The GLB is 1.46 m tall; the mini scenes were framed for ~1.2 m figures.
const SCALE = 0.85;

function Body({ look, anim, reduced, id }: { look: Look; anim: AvatarAnim; reduced: boolean; id: number }) {
  const { root, api } = useCharacterRig(id, look);
  const apiRef = useRef<ModelApi>(api);
  apiRef.current = api;
  useEffect(() => {
    api.play(CLIP[anim], { fade: 0.2 });
  }, [api, anim]);
  useFrame((state, dt) => {
    api.update(reduced ? 0 : Math.min(dt, 0.05), state.clock.elapsedTime);
  });
  return <primitive object={root} />;
}

// Stable per-look id so the same look always gets the same outfit.
function idOf(look: Look) {
  let h = 0;
  for (const ch of `${look.shirt}${look.skin}${look.hair}${look.style}${look.acc}`) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h % 9973;
}

export function AvatarMesh({ look, anim = "idle", reduced, chair, scale = SCALE }: { look: Look; anim?: AvatarAnim; reduced?: boolean; chair?: boolean; scale?: number }) {
  const ctxReduced = useMiniReduced();
  const effReduced = reduced ?? ctxReduced;
  const wrap = useRef<THREE.Group>(null);
  const seat = chair ?? (anim === "typing" || anim === "seated");
  useFrame((state) => {
    if (!wrap.current || effReduced) return;
    const t = state.clock.elapsedTime;
    wrap.current.rotation.x = anim === "bow" ? Math.min(0.2, Math.max(0, Math.sin(t * 1.4)) * 0.2) : 0;
  });
  return (
    <group ref={wrap}>
      <group scale={scale}>
        <Suspense fallback={null}>
          <Body look={look} anim={anim} reduced={effReduced} id={idOf(look)} />
        </Suspense>
        {seat && (
          <>
            <mesh geometry={G.box} material={mat("#1D231B")} position={[0, 0.265, 0]} scale={[0.5, 0.07, 0.46]} castShadow />
            <mesh geometry={G.box} material={mat("#1D231B")} position={[0, 0.58, -0.22]} scale={[0.5, 0.5, 0.06]} castShadow />
            <mesh geometry={G.box} material={mat("#1E241B")} position={[0, 0.13, 0]} scale={[0.06, 0.26, 0.06]} />
          </>
        )}
      </group>
    </group>
  );
}
