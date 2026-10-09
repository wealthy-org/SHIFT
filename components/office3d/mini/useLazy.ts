"use client";
// next/dynamic's ssr:false still gets eagerly fetched as part of the route's
// script list, even for a component gated behind conditional JSX — the chunk
// is referenced statically at build time, so Next preloads it. These 3D
// snippets only matter once a specific condition is true (wallet connected,
// shift reached, a claim in flight), so we import() manually inside an effect
// gated on that condition: nothing is fetched until it's actually needed.
import { useEffect, useRef, useState, type ComponentType } from "react";

export function useLazyComponent<P extends object>(loader: () => Promise<{ default: ComponentType<P> }>, enabled: boolean) {
  const [Comp, setComp] = useState<ComponentType<P> | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  useEffect(() => {
    if (!enabled || Comp) return;
    let alive = true;
    loaderRef.current().then((m) => {
      if (alive) setComp(() => m.default);
    });
    return () => {
      alive = false;
    };
  }, [enabled, Comp]);
  return Comp;
}
