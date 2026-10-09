// Deterministic avatar look, derived from employeeId + wallet. Used by both the
// office scene and the standalone 3D snippets (clock-in, podium, desk, payday),
// so the same employee renders identically everywhere. No dependency on
// views.ts or office3d.ts, to keep this import-cycle free.
import type { Employee } from "./types";
import { seedOf } from "./util";

export const SHIRTS = ["#3E5A8A", "#8A4F3E", "#4E7A5A", "#7A6A3E", "#5A4E7A", "#2F6F6F", "#9A5B6F", "#6B7A3E", "#3E6E8A", "#8A6E3E", "#5E5E66", "#7A3E4E"];
export const SKINS = ["#F1C9A5", "#D9A47E", "#B57A55", "#8A5A3C", "#6B4430", "#E8B894"];
export const HAIR = ["#1E1A16", "#3B2A1E", "#6B4A2B", "#C9A15A", "#2C2C30", "#8A3B2A", "#D8D2C4"];

export type Look = { shirt: string; skin: string; hair: string; style: number; acc: number };

export function lookOf(e: Pick<Employee, "employeeId" | "wallet">): Look {
  const h = seedOf(`look:${e.employeeId}:${e.wallet}`);
  return {
    shirt: SHIRTS[h % SHIRTS.length],
    skin: SKINS[(h >>> 4) % SKINS.length],
    hair: HAIR[(h >>> 8) % HAIR.length],
    style: (h >>> 12) % 4,
    acc: (h >>> 16) % 3,
  };
}
