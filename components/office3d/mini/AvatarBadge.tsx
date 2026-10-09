"use client";
// A tight, icon-sized 3D avatar for slots that used to hold a flat colored SVG
// (the "you're hired" card, the on-the-clock header). Transparent background so
// it drops into any dark card. Default export: this file is always loaded via
// next/dynamic.
import type { Look } from "@/lib/engine/look";
import { AvatarMesh, type AvatarAnim } from "./AvatarMesh";
import { MiniCanvas } from "./MiniCanvas";

// Framed as a bust shot (chest up), like a profile photo, not full-body: at
// badge size there is no room for legs, and the previous full-body framing
// clipped the head for any look with taller hair (style 2's flat top). The
// group offset here is tuned so the head clears the top of the frustum with
// margin even for the tallest hair variant.
export default function AvatarBadge({ look, anim = "idle" }: { look: Look; anim?: AvatarAnim }) {
  return (
    <MiniCanvas height="100%" camera={[0, 0.05, 2.0]} fov={34}>
      <group position={[0, -0.68, 0]}>
        <AvatarMesh look={look} anim={anim} />
      </group>
    </MiniCanvas>
  );
}
