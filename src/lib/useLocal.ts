"use client";

import { useCallback, useEffect, useState } from "react";
import {
  emptyStore,
  LEGACY_SAVED_KEY,
  LEGACY_STATUS_KEY,
  LIBRARY_KEY,
  migrateLegacy,
  removeEntries,
  removeEntry,
  restoreEntries,
  sanitizeStore,
  setAgain,
  setMyTake,
  setStatus,
  type Again,
  type LibraryEntry,
  type LibraryStore,
  type LibraryStatus,
  type MyTake,
  type TitleRef,
} from "./library";
import { track } from "./analytics";

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Load the library, running the one-time legacy migration if needed. */
function loadLibrary(): LibraryStore {
  if (typeof window === "undefined") return emptyStore();
  const current = readJson(LIBRARY_KEY);
  if (current) return sanitizeStore(current);

  const migrated = migrateLegacy(readJson(LEGACY_SAVED_KEY), readJson(LEGACY_STATUS_KEY));
  if (migrated.entries.length > 0) {
    try {
      window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(migrated));
    } catch {
      /* ignore */
    }
  }
  return migrated;
}

function writeLibrary(store: LibraryStore) {
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function useLibrary() {
  const [store, setStore] = useState<LibraryStore>(emptyStore());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Client-only hydration of on-device data (not available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStore(loadLibrary());
    setHydrated(true);
  }, []);

  const apply = useCallback((fn: (prev: LibraryStore) => LibraryStore) => {
    setStore((prev) => {
      const next = fn(prev);
      writeLibrary(next);
      return next;
    });
  }, []);

  const mark = useCallback(
    (ref: TitleRef, status: LibraryStatus) => {
      track("title_marked", {
        status,
        content_title: ref.title,
        media_type: ref.mediaType,
      });
      apply((prev) => setStatus(prev, ref, status));
    },
    [apply],
  );

  const take = useCallback(
    (id: string, myTake: MyTake | undefined) => {
      if (myTake) {
        const entry = store.entries.find((e) => e.id === id);
        track("title_rated", { rating: myTake, content_title: entry?.title });
      }
      apply((prev) => setMyTake(prev, id, myTake));
    },
    [apply, store],
  );

  const again = useCallback(
    (id: string, value: Again | undefined) => {
      if (value) {
        const entry = store.entries.find((e) => e.id === id);
        track("title_again", { again: value, content_title: entry?.title });
      }
      apply((prev) => setAgain(prev, id, value));
    },
    [apply, store],
  );

  const remove = useCallback((id: string) => apply((prev) => removeEntry(prev, id)), [apply]);

  const removeMany = useCallback(
    (ids: string[]) => apply((prev) => removeEntries(prev, ids)),
    [apply],
  );

  const restore = useCallback(
    (entries: LibraryEntry[]) => apply((prev) => restoreEntries(prev, entries)),
    [apply],
  );

  const entryFor = useCallback(
    (id: string): LibraryEntry | undefined => store.entries.find((e) => e.id === id),
    [store],
  );

  return { store, entries: store.entries, hydrated, entryFor, mark, take, again, remove, removeMany, restore };
}
