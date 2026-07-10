import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { createCinemetaAdapter } from "@/lib/media/cinemeta";
import { sampleSearch } from "@/data/catalog";
import type { SearchResult } from "@/lib/media/types";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json<SearchResult>({ query: q, items: [], dataStatus: "unavailable", attribution: [] });
  }

  const provider = process.env.CONTENT_METADATA_PROVIDER || "";
  const hasTmdb = Boolean(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY);

  // Preferred: TMDB when a key is configured (richer availability + ratings).
  if ((provider === "tmdb" || (!provider && hasTmdb)) && hasTmdb) {
    try {
      const result = await createTmdbAdapter().searchTitles(q, { signal: req.signal });
      if (result.items.length > 0 || result.dataStatus === "live") return NextResponse.json(result);
    } catch { /* fall through */ }
  }

  // Default: Cinemeta — free, keyless movie + series search.
  if (provider !== "sample") {
    try {
      const result = await createCinemetaAdapter().searchTitles(q, { signal: req.signal });
      if (result.items.length > 0 || result.dataStatus === "live") return NextResponse.json(result);
    } catch { /* fall through */ }
  }

  // Last resort: labeled sample catalog.
  return NextResponse.json<SearchResult>({
    query: q,
    items: sampleSearch(q),
    dataStatus: "sample",
    attribution: [{ source: "Sample", text: "Showing sample records — the metadata provider is unavailable." }],
  });
}
