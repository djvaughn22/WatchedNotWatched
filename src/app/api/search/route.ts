import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { sampleSearch } from "@/data/catalog";
import type { SearchResult } from "@/lib/media/types";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json<SearchResult>({ query: q, items: [], dataStatus: "unavailable", attribution: [] });
  }

  const provider = process.env.CONTENT_METADATA_PROVIDER || "tmdb";
  const hasTmdb = Boolean(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY);

  if (provider === "tmdb" && hasTmdb) {
    const adapter = createTmdbAdapter();
    try {
      const result = await adapter.searchTitles(q, { signal: req.signal });
      if (result.items.length > 0 || result.dataStatus === "live") {
        return NextResponse.json(result);
      }
    } catch {
      /* fall through to sample */
    }
  }

  // No key or provider unavailable → sample catalog (clearly labeled).
  const items = sampleSearch(q);
  return NextResponse.json<SearchResult>({
    query: q,
    items,
    dataStatus: "sample",
    attribution: [{ source: "Sample", text: "Showing sample records — no metadata provider is configured." }],
  });
}
