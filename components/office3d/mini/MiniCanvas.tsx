"use client";
// A small, self-contained 3D viewport for a single beat — an avatar badge, a
// podium, a desk, a payday burst — sharing lighting and camera conventions with
// the office scene without pulling in the office's floor plan or event stream.
// Always dynamic-imported with ssr:false from the page that uses it.
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { createContext, useContext, type ReactNode } from "react";
import { usePageVisible, useReducedMotion } from "@/lib/useOffice";

const ReducedCtx = createContext(false);
export const useMiniReduced = () => useContext(ReducedCtx);

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
        {controls && (
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            autoRotate={autoRotate && !reduced}
            autoRotateSpeed={autoRotateSpeed}
            minPolarAngle={0.9}
            maxPolarAngle={1.5}
          />
        )}
      </Canvas>
    </div>
  );
}
