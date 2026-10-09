"use client";
// Shared geometry/material cache for the small standalone 3D snippets (avatar
// badges, podium, desk diorama, payday). Deliberately separate from the main
// office scene's cache: those meshes are keyed to the office's own proportions
// and we don't want a change there to ripple into every other page.
import * as THREE from "three";

export const LIME = "#C8F135";
export const AMBER = "#E0A44A";

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  head: new THREE.SphereGeometry(0.15, 20, 16),
  eye: new THREE.SphereGeometry(0.02, 8, 6),
  hairCap: new THREE.SphereGeometry(0.162, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2.1),
  bun: new THREE.SphereGeometry(0.07, 10, 8),
  headset: new THREE.TorusGeometry(0.16, 0.018, 6, 20, Math.PI),
  coin: new THREE.CylinderGeometry(0.06, 0.06, 0.017, 16),
  confetti: new THREE.PlaneGeometry(0.065, 0.11),
};

const cache = new Map<string, THREE.Material>();
export function mat(color: string, o: { emissive?: string; emissiveIntensity?: number; rough?: number; metal?: number; opacity?: number } = {}) {
  const key = color + JSON.stringify(o);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.78,
      metalness: o.metal ?? 0.05,
      emissive: o.emissive ?? "#000000",
      emissiveIntensity: o.emissiveIntensity ?? 0,
      transparent: o.opacity !== undefined,
      opacity: o.opacity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}
