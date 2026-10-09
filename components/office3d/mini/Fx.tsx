"use client";
// Small particle effects shared by payday and promotion moments, wherever they
// happen (office desk, payroll page, podium). Not physically simulated — just
// enough motion to read as a celebration at a glance.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AMBER, G, LIME } from "./geo";

export function Coins({ startAt, duration = 2600, origin = [0, 1.1, 0] as [number, number, number] }: { startAt: number; duration?: number; origin?: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const n = 9;
  useFrame((state) => {
    if (!group.current) return;
    const now = performance.now();
    const k = (now - startAt) / duration;
    group.current.visible = k >= 0 && k < 1;
    if (!group.current.visible) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((c, i) => {
      const a = (i / n) * Math.PI * 2 + k * 3;
      c.position.set(origin[0] + Math.cos(a) * 0.3 * (0.6 + k), origin[1] + k * 1.3 + Math.sin(i) * 0.08, origin[2] + Math.sin(a) * 0.3 * (0.6 + k));
      c.rotation.x = t * 6 + i;
      ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 1 - k;
    });
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} geometry={G.coin}>
          <meshStandardMaterial color="#E0C14A" emissive="#B8901E" emissiveIntensity={0.8} metalness={0.7} roughness={0.3} transparent />
        </mesh>
      ))}
    </group>
  );
}

export function Confetti({ startAt, duration = 2200, origin = [0, 1.3, 0] as [number, number, number] }: { startAt: number; duration?: number; origin?: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const bits = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ a: (i / 16) * Math.PI * 2, v: 0.55 + ((i * 37) % 10) / 13, c: [LIME, "#E4E7DA", "#8FA34A", AMBER][i % 4] })), []);
  useFrame((state) => {
    if (!group.current) return;
    const now = performance.now();
    const k = (now - startAt) / duration;
    group.current.visible = k >= 0 && k < 1;
    if (!group.current.visible) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((c, i) => {
      const b = bits[i];
      const r = b.v * k * 1.1;
      c.position.set(origin[0] + Math.cos(b.a) * r, origin[1] + k * 1.5 - k * k * 2.2, origin[2] + Math.sin(b.a) * r);
      c.rotation.set(t * 5 + i, t * 3, 0);
    });
  });
  return (
    <group ref={group} visible={false}>
      {bits.map((b, i) => (
        <mesh key={i} geometry={G.confetti}>
          <meshBasicMaterial color={b.c} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
