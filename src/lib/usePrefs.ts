"use client";

// localStorage wiring for viewing preferences (model lives in prefs.ts).
// Same shape as useLibrary in useLocal.ts. This hook is the ONLY place that
// touches the prefs storage key, so swapping in cloud sync later means
// changing this file, not the feature.

import { useCallback, useEffect, useState } from "react";
import { emptyPrefs, PREFS_KEY, sanitizePrefs, type ViewingPrefs } from "./prefs";

function loadPrefs(): ViewingPrefs {
  if (typeof window === "undefined") return emptyPrefs();
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? sanitizePrefs(JSON.parse(raw)) : emptyPrefs();
  } catch {
    return emptyPrefs();
  }
}

function writePrefs(prefs: ViewingPrefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function usePrefs() {
  const [prefs, setPrefsState] = useState<ViewingPrefs>(emptyPrefs());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Client-only hydration of on-device data (not available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefsState(loadPrefs());
    setHydrated(true);
  }, []);

  const setPrefs = useCallback((update: (prev: ViewingPrefs) => ViewingPrefs) => {
    setPrefsState((prev) => {
      const next = sanitizePrefs(update(prev));
      writePrefs(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefsState(() => {
      const next = emptyPrefs();
      writePrefs(next);
      return next;
    });
  }, []);

  return { prefs, hydrated, setPrefs, reset };
}
