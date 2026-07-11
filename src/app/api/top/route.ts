import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { isValidDecade, isValidGenre } from "@/lib/media/genres";
import type { MediaType, SearchResultItem } from "@/lib/media/types";

interface TopResponse {
  items: SearchResultItem[]; // up to LIST_SIZE, rank = array position + 1
  supported: boolean; // false when no TMDB key is configured
}

// Top 222 = twelve TMDB discover pages (20 each), deduped, sliced to 222.
const LIST_SIZE = 222;
const PAGES = Array.from({ length: Math.ceil(LIST_SIZE / 20) }, (_, i) => i + 1);

// No route-level revalidate: it once cached a "supported: false" body for a
// day after the TMDB key was added, breaking the page while search worked.
// Caching happens per TMDB fetch instead (1h, inside tmdbFetch), and failure
// envelopes are never cached.

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mediaType = sp.get("type") === "series" ? "series" : "movie";
  const decadeParam = sp.get("decade") ?? "";
  const decade = isValidDecade(decadeParam) ? decadeParam : undefined; // none = all time
  const genreParam = Number(sp.get("genre") ?? 0);
  const genreId = genreParam && isValidGenre(mediaType, genreParam) ? genreParam : undefined;

  if (!(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY)) {
    // Sample board in local dev so the UI can be built and tested keyless.
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json<TopResponse>({ items: sampleItems(mediaType), supported: true });
    }
    return NextResponse.json<TopResponse>({ items: [], supported: false });
  }

  try {
    const adapter = createTmdbAdapter();
    const pages = await Promise.all(
      PAGES.map((page) => adapter.discoverTop({ mediaType, decade, genreId, page })),
    );
    const seen = new Set<string>();
    const items = pages
      .flat()
      .filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
      .slice(0, LIST_SIZE);
    return NextResponse.json<TopResponse>({ items, supported: true });
  } catch {
    return NextResponse.json<TopResponse>({ items: [], supported: true });
  }
}

function sampleItems(mediaType: MediaType): SearchResultItem[] {
  return Array.from({ length: LIST_SIZE }, (_, i) => ({
    id: `sample:${mediaType}-${i + 1}`,
    source: "sample",
    sourceId: `${mediaType}-${i + 1}`,
    mediaType,
    title: `Sample ${mediaType === "series" ? "Show" : "Movie"} ${i + 1}`,
    releaseYear: 1980 + (i % 46),
    voteAverage: Math.round((95 - i * 0.1)) / 10,
    dataStatus: "sample" as const,
  }));
}
