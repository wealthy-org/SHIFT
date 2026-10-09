"use client";

// Rigged Haru-style office character (public/assets/office3d/characters/character_base.glb).
// One shared GLB, cloned per employee: parts are toggled by node name, colours
// come from the employee's deterministic Look via tinted material clones.
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Look } from "@/lib/engine/look";

export const CHARACTER_URL = "/assets/office3d/characters/character_base.glb";
useGLTF.setDecoderPath("/draco/");

const HAIRS = ["Hair_00_crop", "Hair_01_bob", "Hair_02_long", "Hair_03_ponytail", "Hair_04_buns", "Hair_05_swoop", "Hair_06_puff", "Hair_07_buzz"];
const TOPS = ["Top_hoodie", "Top_sweater", "Top_tee", "Top_shirt", "Top_blazer"];
const BOTTOM_COLORS = ["#2B2F3A", "#3C4A63", "#5B5F68", "#26272C", "#4F6C94", "#6B5A44"];
const TIE_COLORS = ["#B3202A", "#2E8B57", "#22304F", "#C8F135"];
const ALL_PARTS = [
  ...HAIRS, ...TOPS, "Bottom_pants", "Bottom_shorts", "Bottom_skirt", "Shoes_sneakers", "Shoes_flats",
  "Acc_cap", "Acc_backpack", "Acc_glasses", "Acc_headphones", "Acc_tie", "Acc_lanyard", "Skin_arms", "Skin_legs",
];

export type Outfit = { parts: Set<string>; colors: Record<string, string> };

const mixHex = (a: string, b: string, t: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

/** Deterministic outfit from employee id + their Look (style 0-3, acc 0-2). */
export function outfitOf(id: number, look: Look): Outfit {
  const r = (n: number) => (Math.imul(id + 1, 2654435761) >>> n) >>> 0;
  const hair = HAIRS[(look.style * 2 + (r(3) & 1)) % HAIRS.length];
  const top = TOPS[r(5) % TOPS.length];
  let bottom = ["Bottom_pants", "Bottom_shorts", "Bottom_skirt"][r(9) % 3];
  if ((top === "Top_blazer" || top === "Top_shirt") && bottom === "Bottom_shorts") bottom = "Bottom_pants";
  const shoes = bottom === "Bottom_skirt" || top === "Top_blazer" ? "Shoes_flats" : r(13) & 1 ? "Shoes_flats" : "Shoes_sneakers";
  const parts = new Set<string>([hair, top, bottom, shoes]);
  if (look.acc === 1) parts.add("Acc_glasses");
  if (look.acc === 2) parts.add("Acc_headphones");
  if (top === "Top_blazer" || (top === "Top_shirt" && r(15) & 1)) parts.add("Acc_tie");
  if (top === "Top_shirt" && !(r(15) & 1)) parts.add("Acc_lanyard");
  if (top === "Top_tee") parts.add("Skin_arms");
  if (bottom !== "Bottom_pants") parts.add("Skin_legs");
  const bot = BOTTOM_COLORS[r(17) % BOTTOM_COLORS.length];
  const colors: Record<string, string> = {
    M_Skin: look.skin,
    M_Hair: look.hair,
    M_Top: look.shirt,
    M_TopTrim: mixHex(look.shirt, "#000000", 0.18),
    M_Shirt: "#F1EFEA",
    M_Blazer: mixHex(look.shirt, "#101216", 0.55),
    M_Tie: TIE_COLORS[r(19) % TIE_COLORS.length],
    M_Bottom: bot,
    M_Skirt: bot,
    M_Shoes: "#F2EFEA",
    M_ShoesDark: "#1A1A1D",
    M_Iris: look.skin === "#F1C9A5" || look.skin === "#E8B894" ? "#4A6F9B" : "#3A2517",
  };
  return { parts, colors };
}

const matCache = new Map<string, THREE.Material>();
function tinted(src: THREE.Material, colors: Record<string, string>): THREE.Material {
  const hex = colors[src.name];
  if (!hex) return src;
  const key = `${src.name}|${hex}`;
  let m = matCache.get(key);
  if (!m) {
    m = src.clone();
    (m as THREE.MeshStandardMaterial).color.set(hex);
    matCache.set(key, m);
  }
  return m;
}

export type ModelApi = {
  /** Cross-fade to a clip. `once` plays through and holds the last pose. */
  play: (name: string, o?: { once?: boolean; fade?: number; speed?: number }) => void;
  update: (dt: number, t: number) => void;
  current: () => string;
  duration: (name: string) => number;
  /** Show or hide the coffee cup held in the right hand. */
  setCup: (on: boolean) => void;
};

export function useCharacterRig(id: number, look: Look) {
  const gltf = useGLTF(CHARACTER_URL);
  return useMemo(() => {
    const root = cloneSkinned(gltf.scene) as THREE.Object3D;
    const outfit = outfitOf(id, look);
    for (const name of ALL_PARTS) {
      const o = root.getObjectByName(name);
      if (o) o.visible = outfit.parts.has(name);
    }
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      m.raycast = () => {}; // clicks go to a cheap proxy capsule, not 30k-vertex skinned meshes
      if (Array.isArray(m.material)) m.material = m.material.map((x) => tinted(x, outfit.colors));
      else m.material = tinted(m.material, outfit.colors);
    });

    // A cup that lives on the right hand bone, hidden until someone fetches coffee.
    const cup = new THREE.Group();
    const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 10), new THREE.MeshStandardMaterial({ color: "#E4E7DA", roughness: 0.7 }));
    const cupCoffee = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 10), new THREE.MeshStandardMaterial({ color: "#3A2416" }));
    cupCoffee.position.y = 0.04;
    cup.add(cupBody, cupCoffee);
    cup.position.set(0, 0.06, 0.02);
    cup.rotation.set(Math.PI / 2, 0, 0.5); // upright when the forearm is raised
    cup.scale.setScalar(1.2);
    cup.visible = false;
    root.getObjectByName("Hand_R")?.add(cup);

    const mixer = new THREE.AnimationMixer(root);
    const clips = new Map(gltf.animations.map((c) => [c.name, c]));
    let cur: THREE.AnimationAction | null = null;
    let curName = "";
    let nextBlink = 1.5 + (id % 7) * 0.4;
    const blink = clips.get("blink") ? mixer.clipAction(clips.get("blink")!) : null;
    if (blink) { blink.setLoop(THREE.LoopOnce, 1); blink.clampWhenFinished = false; }

    const api: ModelApi = {
      play(name, o = {}) {
        const clip = clips.get(name);
        if (!clip) return;
        if (curName === name && !o.once) return;
        const a = mixer.clipAction(clip);
        a.enabled = true;
        a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        a.clampWhenFinished = !!o.once;
        a.timeScale = o.speed ?? 1;
        a.reset();
        if (cur && cur !== a) a.crossFadeFrom(cur, o.fade ?? 0.22, false);
        a.play();
        cur = a;
        curName = name;
      },
      update(dt, t) {
        mixer.update(dt);
        if (blink && dt > 0 && t > nextBlink) {
          blink.reset().play();
          nextBlink = t + 2.4 + ((Math.sin(t * 12.9898 + id) * 43758.5453) % 1 + 1) % 1 * 3.4;
        }
      },
      current: () => curName,
      duration: (n) => clips.get(n)?.duration ?? 1,
      setCup: (on) => { cup.visible = on; },
    };
    api.play("idle_breathe", { fade: 0 });
    return { root, api };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, id]);
}

useGLTF.preload(CHARACTER_URL);
