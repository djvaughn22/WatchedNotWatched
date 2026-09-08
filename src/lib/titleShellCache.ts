// A small, ephemeral record of titles the reader has just SEEN in a card
// (search results, trending strips, picks decks). When they click through,
// the detail page can paint the essential shell — cover, title, author,
// year — on its very first render instead of a loading skeleton, using data
// that was already fetched for the card. Purely an optimization: a direct
// URL paste with no prior card view simply finds nothing here and falls back
// to the normal fetch — never a correctness requirement.

import type { SearchResultItem } from "./media/types";

const KEY = "wnw.titleshell.v1";
const MAX_ENTRIES = 80;

export interface TitleShell {
  id: string;
  source: string;
  sourceId: string;
  mediaType: string;
  title: string;
  creators?: string[];
  releaseYear?: number;
  posterUrl?: string;
  genres?: string[];
}

function readMap(): Record<string, TitleShell> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeTitleShell(item: SearchResultItem | TitleShell): void {
  if (typeof window === "undefined") return;
  try {
    const map = readMap();
    map[item.id] = {
      id: item.id,
      source: item.source,
      sourceId: item.sourceId,
      mediaType: item.mediaType,
      title: item.title,
      creators: item.creators,
      releaseYear: item.releaseYear,
      posterUrl: item.posterUrl,
      genres: "genres" in item ? item.genres : undefined,
    };
    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) {
      // Cheap bound, not LRU-accurate: drop from the front of insertion order.
      for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete map[k];
    }
    window.sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore — this is a nice-to-have, never load-bearing */
  }
}

export function readTitleShell(id: string): TitleShell | null {
  const map = readMap();
  return map[id] ?? null;
}
