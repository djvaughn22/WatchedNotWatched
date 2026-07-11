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
  // Titles with a verified filter track + media we may legally play.
  {
    id: "sample:steamboat-willie",
    source: "sample",
    sourceId: "steamboat-willie",
    mediaType: "movie",
    title: "Steamboat Willie",
    releaseYear: 1928,
    synopsis:
      "Mickey Mouse's screen debut: a mischievous deckhand crosses Captain Pete and turns the boat's animal cargo into a musical number. Public domain in the United States since January 1, 2024. Streams from the Internet Archive with a WatchedNotWatched filter track.",
    officialRating: "NR",
    genres: ["Animation", "Comedy", "Short"],
    guidance: notReviewedGuidance([...ALL_CATEGORIES]),
    availability: [],
    attribution: [
      { source: "Internet Archive", text: "Steamboat Willie (1928) — US public domain. Video hosted by the Internet Archive.", url: "https://archive.org/details/steamboat-willie-1928-by-walt-disney_202401" },
    ],
    dataStatus: "sample",
  },
  {
    id: "sample:demo-reel",
    source: "sample",
    sourceId: "demo-reel",
    mediaType: "movie",
    title: "Filter Demo Reel",
    releaseYear: 2008,
    synopsis:
      "A ten-second clip from Big Buck Bunny (Blender Foundation, CC-BY 3.0) with an owner-authored, verified filter track. Use it to watch WatchedNotWatched filtering work end to end.",
    officialRating: "NR",
    genres: [],
    guidance: notReviewedGuidance([...ALL_CATEGORIES]),
    availability: [],
    attribution: [{ source: "Blender Foundation", text: "Big Buck Bunny © Blender Foundation · CC-BY 3.0 · peach.blender.org", url: "https://peach.blender.org" }],
    dataStatus: "sample",
  },
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
