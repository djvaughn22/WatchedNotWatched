// The personal library — the product. Pure functions over a plain store so
// the logic is testable; localStorage wiring lives in useLocal.ts.
// Saved on this device only. Export a backup anytime.

export type LibraryStatus = "want_to_watch" | "watched" | "prob_not";
export type MyTake = "loved" | "liked" | "fine" | "not_for_me";
export type Again = "yes" | "maybe" | "no";

export interface LibraryEntry {
  id: string; // canonical title id, e.g. "tmdb:27205"
  source: string;
  sourceId: string;
  mediaType: string; // "movie" | "series" (open for future media)
  title: string;
  releaseYear?: number;
  posterUrl?: string;
  genres?: string[];
  status: LibraryStatus;
  myTake?: MyTake;
  again?: Again;
  addedAt: string;
  watchedAt?: string; // set when status becomes "watched"
}

export interface LibraryStore {
  version: 2;
  entries: LibraryEntry[];
}

export const LIBRARY_KEY = "wnw.library.v2";
// Legacy keys (pre-reset). Read once by migrate(), never written again.
export const LEGACY_SAVED_KEY = "wnw.saved.v1";
export const LEGACY_STATUS_KEY = "wnw.status.v1";

const STATUSES = new Set<LibraryStatus>(["want_to_watch", "watched", "prob_not"]);
const TAKES = new Set<MyTake>(["loved", "liked", "fine", "not_for_me"]);
const AGAINS = new Set<Again>(["yes", "maybe", "no"]);

export const MY_TAKE_LABELS: Record<MyTake, string> = {
  loved: "Loved it",
  liked: "Liked it",
  fine: "Fine",
  not_for_me: "Not for me",
};

export const AGAIN_LABELS: Record<Again, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
};

export const STATUS_LABELS: Record<LibraryStatus, string> = {
  want_to_watch: "Want to Watch",
  watched: "Watched",
  prob_not: "Prob Not",
};

export function emptyStore(): LibraryStore {
  return { version: 2, entries: [] };
}

/** Keep only well-formed entries from untrusted storage data. */
export function sanitizeStore(raw: unknown): LibraryStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const entries = (raw as LibraryStore).entries;
  if (!Array.isArray(entries)) return emptyStore();
  const clean = entries.filter(
    (e): e is LibraryEntry =>
      !!e &&
      typeof e === "object" &&
      typeof e.id === "string" &&
      typeof e.title === "string" &&
      STATUSES.has(e.status),
  );
  return {
    version: 2,
    entries: clean.map((e) => ({
      ...e,
      myTake: e.myTake && TAKES.has(e.myTake) ? e.myTake : undefined,
      again: e.again && AGAINS.has(e.again) ? e.again : undefined,
    })),
  };
}

export function getEntry(store: LibraryStore, id: string): LibraryEntry | undefined {
  return store.entries.find((e) => e.id === id);
}

export interface TitleRef {
  id: string;
  source: string;
  sourceId: string;
  mediaType: string;
  title: string;
  releaseYear?: number;
  posterUrl?: string;
  genres?: string[];
}

/**
 * Set a title's status. New titles are added at the front. Existing titles
 * keep their My Take / Again answers when moving between statuses; watchedAt
 * is set the first time a title becomes watched.
 */
export function setStatus(
  store: LibraryStore,
  ref: TitleRef,
  status: LibraryStatus,
  at = new Date().toISOString(),
): LibraryStore {
  const existing = getEntry(store, ref.id);
  const entry: LibraryEntry = existing
    ? {
        ...existing,
        ...ref,
        status,
        watchedAt: status === "watched" ? (existing.watchedAt ?? at) : existing.watchedAt,
      }
    : {
        ...ref,
        status,
        addedAt: at,
        watchedAt: status === "watched" ? at : undefined,
      };
  return {
    version: 2,
    entries: [entry, ...store.entries.filter((e) => e.id !== ref.id)],
  };
}

/** Set or clear My Take on a watched (or any saved) title. */
export function setMyTake(store: LibraryStore, id: string, myTake: MyTake | undefined): LibraryStore {
  return {
    version: 2,
    entries: store.entries.map((e) => (e.id === id ? { ...e, myTake } : e)),
  };
}

/** Set or clear the rewatch answer. */
export function setAgain(store: LibraryStore, id: string, again: Again | undefined): LibraryStore {
  return {
    version: 2,
    entries: store.entries.map((e) => (e.id === id ? { ...e, again } : e)),
  };
}

export function removeEntry(store: LibraryStore, id: string): LibraryStore {
  return { version: 2, entries: store.entries.filter((e) => e.id !== id) };
}

export function removeEntries(store: LibraryStore, ids: string[]): LibraryStore {
  const gone = new Set(ids);
  return { version: 2, entries: store.entries.filter((e) => !gone.has(e.id)) };
}

/** Restore previously removed entries (undo). Keeps current entries on id clash. */
export function restoreEntries(store: LibraryStore, entries: LibraryEntry[]): LibraryStore {
  const have = new Set(store.entries.map((e) => e.id));
  const back = entries.filter((e) => !have.has(e.id));
  return { version: 2, entries: [...back, ...store.entries] };
}

// ---- Derived views -------------------------------------------------------

export type LibraryView =
  | "all"
  | "want_to_watch"
  | "watched"
  | "watch_again"
  | "favorites"
  | "not_for_me"
  | "prob_not";

export const VIEW_LABELS: Record<LibraryView, string> = {
  all: "All",
  want_to_watch: "Want to Watch",
  watched: "Watched",
  watch_again: "Watch Again",
  favorites: "Favorites",
  not_for_me: "Not for Me",
  prob_not: "Prob Not",
};

export function inView(e: LibraryEntry, view: LibraryView): boolean {
  switch (view) {
    case "all":
      return true;
    case "want_to_watch":
      return e.status === "want_to_watch";
    case "watched":
      return e.status === "watched";
    case "watch_again":
      return e.status === "watched" && (e.again === "yes" || e.again === "maybe");
    case "favorites":
      return e.myTake === "loved";
    case "not_for_me":
      return e.myTake === "not_for_me"; // watched it, hated it
    case "prob_not":
      return e.status === "prob_not"; // never watched, not interested
  }
}

// ---- Migration from the pre-reset keys ------------------------------------

interface LegacySaved {
  id?: string;
  source?: string;
  sourceId?: string;
  mediaType?: string;
  title?: string;
  releaseYear?: number;
  posterUrl?: string;
  savedAt?: string;
}

interface LegacyStatus extends LegacySaved {
  decision?: string; // "watched" | "not-watched"
  decidedAt?: string;
}

/**
 * One-time merge of the old saved list + watched/not-watched decisions:
 *   saved-for-later  → want_to_watch
 *   watched          → watched
 *   not-watched      → want_to_watch (it marked intent, never rejection)
 * Malformed rows are dropped. Legacy keys are left untouched as a backup.
 */
export function migrateLegacy(savedRaw: unknown, statusRaw: unknown): LibraryStore {
  const byId = new Map<string, LibraryEntry>();

  const refOf = (r: LegacySaved): TitleRef | null => {
    if (!r || typeof r.id !== "string" || typeof r.title !== "string") return null;
    return {
      id: r.id,
      source: r.source ?? r.id.split(":")[0] ?? "",
      sourceId: r.sourceId ?? r.id.split(":")[1] ?? "",
      mediaType: r.mediaType ?? "movie",
      title: r.title,
      releaseYear: typeof r.releaseYear === "number" ? r.releaseYear : undefined,
      posterUrl: typeof r.posterUrl === "string" ? r.posterUrl : undefined,
    };
  };

  if (Array.isArray(savedRaw)) {
    for (const r of savedRaw as LegacySaved[]) {
      const ref = refOf(r);
      if (!ref) continue;
      byId.set(ref.id, {
        ...ref,
        status: "want_to_watch",
        addedAt: r.savedAt ?? new Date().toISOString(),
      });
    }
  }

  if (Array.isArray(statusRaw)) {
    for (const r of statusRaw as LegacyStatus[]) {
      const ref = refOf(r);
      if (!ref) continue;
      const at = r.decidedAt ?? new Date().toISOString();
      if (r.decision === "watched") {
        const prev = byId.get(ref.id);
        byId.set(ref.id, {
          ...ref,
          status: "watched",
          addedAt: prev?.addedAt ?? at,
          watchedAt: at,
        });
      } else if (!byId.has(ref.id)) {
        // "not-watched" (or unknown) → intent to watch, never rejection.
        byId.set(ref.id, { ...ref, status: "want_to_watch", addedAt: at });
      }
    }
  }

  return { version: 2, entries: [...byId.values()] };
}
