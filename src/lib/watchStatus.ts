// Watched / Not Watched decisions — the product name as working state.
// Pure functions over a plain array so the logic is testable; the
// localStorage wiring lives in useLocal.ts. Stored on this device only.

export type WatchDecision = "watched" | "not-watched";

export interface WatchStatusEntry {
  id: string; // canonical title id, e.g. "tvmaze:41821"
  source: string;
  sourceId: string;
  mediaType: string;
  title: string;
  releaseYear?: number;
  posterUrl?: string;
  decision: WatchDecision;
  decidedAt: string;
}

export const WATCH_STATUS_KEY = "wnw.status.v1";

const DECISIONS = new Set<WatchDecision>(["watched", "not-watched"]);

/** Keep only well-formed entries from untrusted storage data. */
export function sanitizeEntries(raw: unknown): WatchStatusEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is WatchStatusEntry =>
      !!e &&
      typeof e === "object" &&
      typeof (e as WatchStatusEntry).id === "string" &&
      typeof (e as WatchStatusEntry).title === "string" &&
      DECISIONS.has((e as WatchStatusEntry).decision),
  );
}

export function getDecision(list: WatchStatusEntry[], id: string): WatchDecision | null {
  return list.find((e) => e.id === id)?.decision ?? null;
}

/** Set or replace the decision for a title. One entry per title id. */
export function applyDecision(
  list: WatchStatusEntry[],
  entry: Omit<WatchStatusEntry, "decidedAt">,
  decidedAt = new Date().toISOString(),
): WatchStatusEntry[] {
  return [{ ...entry, decidedAt }, ...list.filter((e) => e.id !== entry.id)];
}

export function clearDecision(list: WatchStatusEntry[], id: string): WatchStatusEntry[] {
  return list.filter((e) => e.id !== id);
}
