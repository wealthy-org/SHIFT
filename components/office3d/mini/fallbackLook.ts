// A default look for the moment before `me.look` has loaded. Deliberately in
// its own file with zero three.js/fiber/drei imports: pages import this one
// eagerly (it's a few bytes), while the actual 3D components stay behind
// useLazyComponent. Importing it from AvatarMesh.tsx instead would drag the
// whole three.js bundle into every page's main chunk.
import type { Look } from "@/lib/engine/look";

const FALLBACK_LOOK: Look = { shirt: "#3E5A8A", skin: "#D9A47E", hair: "#1E1A16", style: 0, acc: 0 };

export function fallbackLook(): Look {
  return FALLBACK_LOOK;
}
