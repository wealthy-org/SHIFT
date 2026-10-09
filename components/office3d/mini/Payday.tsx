"use client";
// Lives inside the light PAYDAY card, transparent so it sits on the card's own
// background. Coins burst once, right when a claim actually confirms.
import type { Look } from "@/lib/engine/look";
import type { AvatarAnim } from "./AvatarMesh";
import { AvatarMesh } from "./AvatarMesh";
import { Coins } from "./Fx";
import { MiniCanvas } from "./MiniCanvas";

export default function Payday({ look, anim, coinsAt }: { look: Look; anim: AvatarAnim; coinsAt: number }) {
  return (
    <MiniCanvas height={150} camera={[0, 1.0, 1.9]} fov={28}>
      <group position={[0, -0.56, 0]}>
        <AvatarMesh look={look} anim={anim} />
        <Coins startAt={coinsAt} origin={[0, 1.15, 0]} />
      </group>
    </MiniCanvas>
  );
}
