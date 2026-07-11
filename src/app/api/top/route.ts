import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { isValidDecade, isValidGenre } from "@/lib/media/genres";
import type { MediaType, SearchResultItem } from "@/lib/media/types";

interface TopResponse {
  items: SearchResultItem[]; // up to LIST_SIZE, rank = array position + 1
  supported: boolean; // false when no TMDB key is configured
}

// Two list sizes: the quick Top 22 every filter opens with, and the full
// Top 222 behind the "show all" button (n=222). One TMDB discover page is
// 20 titles, so 22 = 2 pages, 222 = 12 pages, deduped then sliced.
const QUICK = 22;
const FULL = 222;

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
  const limit = sp.get("n") === String(FULL) ? FULL : QUICK;

  if (!(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY)) {
    // Sample board in local dev so the UI can be built and tested keyless.
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json<TopResponse>({ items: sampleItems(mediaType, limit), supported: true });
    }
    return NextResponse.json<TopResponse>({ items: [], supported: false });
  }

  try {
    const adapter = createTmdbAdapter();
    const pageNumbers = Array.from({ length: Math.ceil(limit / 20) }, (_, i) => i + 1);
    const pages = await Promise.all(
      pageNumbers.map((page) => adapter.discoverTop({ mediaType, decade, genreId, page })),
    );
    const seen = new Set<string>();
    const items = pages
      .flat()
      .filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
      .slice(0, limit);
    return NextResponse.json<TopResponse>({ items, supported: true });
  } catch {
    return NextResponse.json<TopResponse>({ items: [], supported: true });
  }
}

function sampleItems(mediaType: MediaType, limit: number): SearchResultItem[] {
  return Array.from({ length: limit }, (_, i) => ({
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
