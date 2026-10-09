"use client";
// A small, self-contained 3D viewport for a single beat — an avatar badge, a
// podium, a desk, a payday burst — sharing lighting and camera conventions with
// the office scene without pulling in the office's floor plan or event stream.
// Always dynamic-imported with ssr:false from the page that uses it.
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { createContext, useContext, useRef, type ReactNode } from "react";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { usePageVisible, useReducedMotion } from "@/lib/useOffice";

const ReducedCtx = createContext(false);
export const useMiniReduced = () => useContext(ReducedCtx);

// Orbit controls that sweep back and forth across the front of the scene
// instead of spinning 360 degrees, so the camera never ends up behind the
// monitors (which would hide every face).
function SwayControls({ auto, speed }: { auto: boolean; speed: number }) {
  const ref = useRef<OrbitImpl>(null);
  const dir = useRef(1);
  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    const az = c.getAzimuthalAngle();
    if (az > 0.5) dir.current = -1;
    else if (az < -0.5) dir.current = 1;
    c.autoRotateSpeed = speed * dir.current;
  });
  return (
    <OrbitControls
      ref={ref}
      enablePan={false}
      enableZoom={false}
      autoRotate={auto}
      autoRotateSpeed={speed}
      minAzimuthAngle={-0.6}
      maxAzimuthAngle={0.6}
      minPolarAngle={0.9}
      maxPolarAngle={1.5}
    />
  );
}

export function MiniCanvas({
  children,
  height = 220,
  camera = [2.3, 1.7, 2.6],
  fov = 30,
  autoRotate = false,
  autoRotateSpeed = 0.6,
  controls = false,
  bg,
}: {
  children: ReactNode;
  height?: number | string;
  camera?: [number, number, number];
  fov?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  controls?: boolean;
  bg?: string;
}) {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  return (
    <div style={{ height, position: "relative" }}>
      <Canvas
        dpr={[1, 1.75]}
        shadows={false}
        frameloop={visible ? "always" : "never"}
        gl={{ antialias: true, alpha: !bg }}
        camera={{ position: camera, fov }}
      >
        {bg && <color attach="background" args={[bg]} />}
        <hemisphereLight args={["#FFEBD0", "#1A2216", 1.0]} />
        <ambientLight intensity={0.5} color="#E9EDE2" />
        <directionalLight position={[2.6, 3.4, 2.2]} intensity={2.0} color="#FFE2B8" />
        <pointLight position={[-1.4, 1.2, -1.2]} color="#C8F135" intensity={1.1} distance={6} decay={2} />
        <ReducedCtx.Provider value={reduced}>{children}</ReducedCtx.Provider>
        {controls && <SwayControls auto={autoRotate && !reduced} speed={autoRotateSpeed} />}
      </Canvas>
    </div>
  );
}
