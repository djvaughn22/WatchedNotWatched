import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { createTvmazeAdapter } from "@/lib/media/tvmaze";
import type { SearchResult } from "@/lib/media/types";

const tmdbConfigured = () => !!(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json<SearchResult>({ query: q, items: [], dataStatus: "unavailable", attribution: [] });
  }

  // TMDB: movies + TV, posters, one source. Preferred whenever configured.
  if (tmdbConfigured()) {
    try {
      const result = await createTmdbAdapter().searchTitles(q, { signal: req.signal });
      if (result.dataStatus === "live") return NextResponse.json(result);
    } catch {
      /* fall through to TVmaze */
    }
  }

  // Fallback: TVmaze covers television only (keyless).
  try {
    const result = await createTvmazeAdapter().searchTitles(q, { signal: req.signal });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json<SearchResult>({ query: q, items: [], dataStatus: "unavailable", attribution: [] });
  }
}
