"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getActiveProfile,
  loadStore,
  resetStore,
  saveStore,
  type ProfileStore,
  type ViewingProfile,
} from "./profiles";
import {
  applyDecision,
  clearDecision,
  getDecision,
  sanitizeEntries,
  WATCH_STATUS_KEY,
  type WatchDecision,
  type WatchStatusEntry,
} from "./watchStatus";

export function useProfiles() {
  const [store, setStore] = useState<ProfileStore | null>(null);

  useEffect(() => {
    // Client-only hydration of on-device data (not available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStore(loadStore());
  }, []);

  const update = useCallback((next: ProfileStore) => {
    setStore(next);
    saveStore(next);
  }, []);

  const setActive = useCallback(
    (id: string) => {
      setStore((prev) => {
        if (!prev) return prev;
        const next = { ...prev, activeId: id };
        saveStore(next);
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => setStore(resetStore()), []);

  const active: ViewingProfile | null = store ? getActiveProfile(store) : null;
  return { store, active, setActive, update, reset };
}

// ---- Saved titles ------------------------------------------------------
export interface SavedTitle {
  id: string;
  source: string;
  sourceId: string;
  mediaType: string;
  title: string;
  releaseYear?: number;
  posterUrl?: string;
  savedAt: string;
}

const SAVED_KEY = "wnw.saved.v1";

function readSaved(): SavedTitle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.id === "string" && typeof t.title === "string");
  } catch {
    return [];
  }
}

export function useSaved() {
  const [saved, setSaved] = useState<SavedTitle[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(readSaved());
  }, []);

  const persist = useCallback((next: SavedTitle[]) => {
    setSaved(next);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const isSaved = useCallback((id: string) => saved.some((t) => t.id === id), [saved]);

  const toggle = useCallback(
    (item: Omit<SavedTitle, "savedAt">) => {
      setSaved((prev) => {
        const exists = prev.some((t) => t.id === item.id);
        const next = exists ? prev.filter((t) => t.id !== item.id) : [{ ...item, savedAt: new Date().toISOString() }, ...prev];
        try {
          window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  const remove = useCallback(
    (id: string) => persist(readSaved().filter((t) => t.id !== id)),
    [persist],
  );

  return { saved, isSaved, toggle, remove };
}

// ---- Watched / Not Watched ----------------------------------------------
function readStatuses(): WatchStatusEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WATCH_STATUS_KEY);
    return raw ? sanitizeEntries(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writeStatuses(next: WatchStatusEntry[]) {
  try {
    window.localStorage.setItem(WATCH_STATUS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function useWatchStatus() {
  const [entries, setEntries] = useState<WatchStatusEntry[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(readStatuses());
  }, []);

  const decisionFor = useCallback(
    (id: string): WatchDecision | null => getDecision(entries, id),
    [entries],
  );

  /** Set a decision; choosing the same decision again clears it. */
  const mark = useCallback(
    (entry: Omit<WatchStatusEntry, "decidedAt">) => {
      setEntries((prev) => {
        const next =
          getDecision(prev, entry.id) === entry.decision
            ? clearDecision(prev, entry.id)
            : applyDecision(prev, entry);
        writeStatuses(next);
        return next;
      });
    },
    [],
  );

  const clear = useCallback((id: string) => {
    setEntries((prev) => {
      const next = clearDecision(prev, id);
      writeStatuses(next);
      return next;
    });
  }, []);

  return { entries, decisionFor, mark, clear };
}
