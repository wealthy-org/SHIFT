"use client";
// Lives inside the light PAYDAY card, transparent so it sits on the card's own
// background. Coins burst once, right when a claim actually confirms.
import type { Look } from "@/lib/engine/look";
import type { AvatarAnim } from "./AvatarMesh";
import { AvatarMesh } from "./AvatarMesh";
import { Coins } from "./Fx";
import { MiniCanvas } from "./MiniCanvas";

// Pulled back further than a first pass, with a wider fov: the previous
// camera left too little vertical headroom and clipped the head for taller
// hair variants (style 2's flat top in particular).
export default function Payday({ look, anim, coinsAt }: { look: Look; anim: AvatarAnim; coinsAt: number }) {
  return (
    <MiniCanvas height={150} camera={[0, 1.38, 2.62]} fov={30}>
      <group position={[0, -0.56, 0]}>
        <AvatarMesh look={look} anim={anim} />
        <Coins startAt={coinsAt} origin={[0, 1.15, 0]} />
      </group>
    </MiniCanvas>
  );
}
