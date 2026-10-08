"use client";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

// Text inside the scene is painted onto canvas textures rather than floated as
// DOM. It stays crisp, costs one draw per change, and needs no font download.
export const DISPLAY = "'Big Shoulders Display', 'Arial Narrow', sans-serif";
export const SANS = "'Geist', 'Helvetica Neue', Helvetica, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, monospace";

let fontsReady: Promise<unknown> | null = null;
export function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    fontsReady ||= document.fonts?.ready ?? Promise.resolve();
    let alive = true;
    fontsReady.then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

export function useCanvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, deps: unknown[]) {
  const fonts = useFontsReady();
  const { canvas, tex } = useMemo(() => {
    const canvas = typeof document !== "undefined" ? document.createElement("canvas") : (null as unknown as HTMLCanvasElement);
    if (canvas) {
      canvas.width = w;
      canvas.height = h;
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { canvas, tex };
  }, [w, h]);

  useEffect(() => {
    const g = canvas?.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, w, h);
    draw(g, w, h);
    tex.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, tex, fonts, ...deps]);

  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function fit(g: CanvasRenderingContext2D, text: string, maxW: number) {
  if (g.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
