// Editorial catalog: titles marked for review by admins.
// These are drafts with empty guidance — never mark reviewed automatically.
import type { MediaTitle, SearchResultItem } from "@/lib/media/types";
import { ALL_CATEGORIES } from "@/lib/filter/types";
import { notReviewedGuidance } from "@/lib/guidance";

export interface EditorialDraft {
  id: string; // internal: `editorial:${externalSource}:${externalId}`
  externalSource: string; // "tvmaze", "wikidata", etc.
  externalId: string;
  title: string;
  mediaType: "movie" | "series" | "episode" | "video";
  releaseYear?: number;
  posterUrl?: string;
  synopsis?: string;
  createdAt: string;
  lastModified: string;
  reviewStatus: "draft" | "in-review" | "ready" | "published"; // published = moved to SAMPLE_CATALOG
}

// In-memory store for MVP2 Lite. Later: Vercel KV or database.
const EDITORIAL_DRAFTS: Map<string, EditorialDraft> = new Map();

export function addEditorialDraft(
  externalSource: string,
  externalId: string,
  item: SearchResultItem,
): EditorialDraft {
  const id = `editorial:${externalSource}:${externalId}`;

  // Check if already exists
  if (EDITORIAL_DRAFTS.has(id)) {
    const existing = EDITORIAL_DRAFTS.get(id)!;
    existing.lastModified = new Date().toISOString();
    return existing;
  }

  const draft: EditorialDraft = {
    id,
    externalSource,
    externalId,
    title: item.title,
    mediaType: item.mediaType,
    releaseYear: item.releaseYear,
    posterUrl: item.posterUrl,
    synopsis: undefined,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    reviewStatus: "draft",
  };

  EDITORIAL_DRAFTS.set(id, draft);
  return draft;
}

export function getEditorialDraft(id: string): EditorialDraft | null {
  return EDITORIAL_DRAFTS.get(id) ?? null;
}

export function listEditorialDrafts(): EditorialDraft[] {
  return Array.from(EDITORIAL_DRAFTS.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function convertToMediaTitle(draft: EditorialDraft): MediaTitle {
  return {
    id: draft.id,
    source: "editorial",
    sourceId: `${draft.externalSource}:${draft.externalId}`,
    mediaType: draft.mediaType,
    title: draft.title,
    releaseYear: draft.releaseYear,
    posterUrl: draft.posterUrl,
    synopsis: draft.synopsis,
    guidance: notReviewedGuidance([...ALL_CATEGORIES]),
    availability: [],
    attribution: [{ source: "Editorial", text: "In review for WatchedNotWatched guidance." }],
    dataStatus: "editorial",
    updatedAt: draft.lastModified,
  };
}
