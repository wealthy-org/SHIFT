"use client";
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "shift.theme";

// Default is light. The blocking script in app/layout.tsx already sets
// data-theme on <html> before first paint, so this hook just reads whatever
// that settled on, then keeps state and DOM in sync after that.
function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const apply = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    setTheme(t);
  }, []);

  const toggle = useCallback(() => apply(theme === "dark" ? "light" : "dark"), [apply, theme]);

  return { theme, setTheme: apply, toggle };
}

// For components that need the current theme but don't own the toggle (the
// toggle lives in AppShell's own useTheme instance) — follows the
// <html data-theme> attribute directly.
export function useDocTheme(): Theme {
  const [t, setT] = useState<Theme>("light");
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setT(el.getAttribute("data-theme") === "dark" ? "dark" : "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return t;
}
