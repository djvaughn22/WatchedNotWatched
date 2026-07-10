// Local SAMPLE catalog — for offline/no-key testing only. Every record is
// marked dataStatus:"sample". Titles here are public-domain films with minimal
// factual fields; detailed guidance is honestly "not-reviewed". Sample records
// carry NO provider availability (we never fake live availability).
import { ALL_CATEGORIES } from "@/lib/filter/types";
import { notReviewedGuidance } from "@/lib/guidance";
import type { MediaTitle, SearchResultItem } from "@/lib/media/types";

const base = (
  sourceId: string,
  title: string,
  releaseYear: number,
  synopsis: string,
  officialRating: string,
): MediaTitle => ({
  id: `sample:${sourceId}`,
  source: "sample",
  sourceId,
  mediaType: "movie",
  title,
  releaseYear,
  synopsis,
  officialRating,
  genres: [],
  guidance: notReviewedGuidance([...ALL_CATEGORIES]),
  availability: [],
  attribution: [{ source: "Public Domain", text: "Sample record — public-domain film metadata." }],
  dataStatus: "sample",
});

export const SAMPLE_CATALOG: MediaTitle[] = [
  base("nightlivingdead", "Night of the Living Dead", 1968, "A group shelters in a farmhouse from the reanimated dead. Released without a rating; widely noted for its era. Public domain.", "NR"),
  base("nosferatu", "Nosferatu", 1922, "A silent-era vampire classic. Public domain.", "NR"),
  base("charade", "Charade", 1963, "A widow is pursued by men seeking a fortune her late husband stole. Public domain.", "NR"),
  base("hisgirlfriday", "His Girl Friday", 1940, "A newspaper editor schemes to keep his ex-wife reporter from remarrying. Public domain.", "NR"),
  base("thegeneral", "The General", 1926, "A railway engineer chases his stolen locomotive during wartime. Silent comedy. Public domain.", "NR"),
];

export function sampleSearch(query: string): SearchResultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SAMPLE_CATALOG.filter((t) => t.title.toLowerCase().includes(q)).map((t) => ({
    id: t.id,
    source: t.source,
    sourceId: t.sourceId,
    mediaType: t.mediaType,
    title: t.title,
    releaseYear: t.releaseYear,
    posterUrl: t.posterUrl,
    officialRating: t.officialRating,
    dataStatus: "sample" as const,
  }));
}

export function sampleGetTitle(sourceId: string): MediaTitle | null {
  return SAMPLE_CATALOG.find((t) => t.sourceId === sourceId) ?? null;
}
