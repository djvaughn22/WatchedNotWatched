"use client";

// Global mode context: WatchedNotWatched (screen) vs. ReadNotRead (book).
// Source of truth is localStorage (survives refresh + cross-page nav); the
// current page's `?mode=` query string is a secondary, shareable mirror kept
// in sync via pushState/popstate so back/forward toggles it too. Default is
// "screen" so existing users see the unchanged product until they switch.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_MODE, MODE_QUERY_PARAM, MODE_STORAGE_KEY, parseMode, type AppMode } from "@/lib/mode";

const ModeContext = createContext<{ mode: AppMode; setMode: (m: AppMode) => void } | null>(null);

function readStoredMode(): AppMode {
  try {
    return parseMode(window.localStorage.getItem(MODE_STORAGE_KEY)) ?? DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function urlWithMode(mode: AppMode): string {
  const url = new URL(window.location.href);
  if (mode === DEFAULT_MODE) url.searchParams.delete(MODE_QUERY_PARAM);
  else url.searchParams.set(MODE_QUERY_PARAM, mode);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(DEFAULT_MODE);

  useEffect(() => {
    const fromUrl = parseMode(new URLSearchParams(window.location.search).get(MODE_QUERY_PARAM));
    const initial = fromUrl ?? readStoredMode();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModeState(initial);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, initial);
    } catch {
      /* ignore */
    }
    if (initial !== DEFAULT_MODE && !fromUrl) {
      window.history.replaceState(window.history.state, "", urlWithMode(initial));
    }

    const onPopState = () => {
      const next = parseMode(new URLSearchParams(window.location.search).get(MODE_QUERY_PARAM)) ?? DEFAULT_MODE;
      setModeState(next);
      try {
        window.localStorage.setItem(MODE_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    window.history.pushState(window.history.state, "", urlWithMode(next));
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): { mode: AppMode; setMode: (m: AppMode) => void } {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within a ModeProvider");
  return ctx;
}
