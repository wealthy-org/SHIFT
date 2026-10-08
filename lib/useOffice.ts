"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OfficeScene } from "./engine/office3d";

export type Link = "connecting" | "live" | "disconnected";

// One EventSource for the whole office. If the stream drops we keep showing the
// last snapshot and freeze it: nothing new is animated until data flows again.
export function useOfficeStream() {
  const [scene, setScene] = useState<OfficeScene | null>(null);
  const [link, setLink] = useState<Link>("connecting");
  const [lastAt, setLastAt] = useState(0);
  const es = useRef<EventSource | null>(null);
  const lastSeq = useRef(0);

  const open = useCallback(() => {
    es.current?.close();
    setLink("connecting");
    const src = new EventSource("/api/office/stream");
    es.current = src;
    src.addEventListener("snapshot", (m) => {
      try {
        const next = JSON.parse((m as MessageEvent).data) as OfficeScene;
        // Ignore anything older than what is already on screen.
        if (next.seq < lastSeq.current) return;
        lastSeq.current = next.seq;
        setScene(next);
        setLastAt(Date.now());
        setLink("live");
      } catch {
        /* a malformed frame is dropped, the next one replaces it */
      }
    });
    src.onerror = () => setLink("disconnected");
  }, []);

  useEffect(() => {
    open();
    return () => es.current?.close();
  }, [open]);

  // A stream that stops sending without erroring is also a disconnect.
  useEffect(() => {
    const t = setInterval(() => {
      if (lastAt && Date.now() - lastAt > 5000) setLink("disconnected");
    }, 1000);
    return () => clearInterval(t);
  }, [lastAt]);

  return { scene, link, lastAt, reconnect: open };
}

export function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const f = () => setVisible(!document.hidden);
    f();
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  return visible;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setReduced(q.matches);
    f();
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return reduced;
}

export function useIsCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 820px), (pointer: coarse)");
    const f = () => setCompact(q.matches);
    f();
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return compact;
}
