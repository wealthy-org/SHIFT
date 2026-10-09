"use client";
// A tight, icon-sized 3D avatar for slots that used to hold a flat colored SVG
// (the "you're hired" card, the on-the-clock header). Transparent background so
// it drops into any dark card. Default export: this file is always loaded via
// next/dynamic.
import type { Look } from "@/lib/engine/look";
import { AvatarMesh, type AvatarAnim } from "./AvatarMesh";
import { MiniCanvas } from "./MiniCanvas";

export default function AvatarBadge({ look, anim = "idle" }: { look: Look; anim?: AvatarAnim }) {
  return (
    <MiniCanvas height="100%" camera={[0, 1.02, 1.5]} fov={24}>
      <group position={[0, -0.56, 0]}>
        <AvatarMesh look={look} anim={anim} />
      </group>
    </MiniCanvas>
  );
}
