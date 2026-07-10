import { NextRequest, NextResponse } from "next/server";
import { createTvmazeAdapter } from "@/lib/media/tvmaze";
import { createWikidataAdapter } from "@/lib/media/wikidata";
import { sampleSearch } from "@/data/catalog";
import type { SearchResult, SearchResultItem, AttributionReference } from "@/lib/media/types";

interface DedupeKey {
  title: string;
  year?: number;
  mediaType: string;
}

function makeDedupeKey(item: SearchResultItem): DedupeKey {
  return {
    title: item.title.toLowerCase().trim(),
    year: item.releaseYear,
    mediaType: item.mediaType,
  };
}

function dedupeResults(items: SearchResultItem[]): SearchResultItem[] {
  const seen = new Map<string, SearchResultItem>();
  for (const item of items) {
    const key = makeDedupeKey(item);
    const keyStr = `${key.title}|${key.year}|${key.mediaType}`;
    // Prefer local/reviewed items, then keep first match
    if (!seen.has(keyStr) || item.dataStatus === "editorial") {
      seen.set(keyStr, item);
    }
  }
  return Array.from(seen.values());
}

function mergeAttributions(results: SearchResult[]): AttributionReference[] {
  const seen = new Set<string>();
  const merged: AttributionReference[] = [];
  for (const result of results) {
    for (const attr of result.attribution) {
      const key = `${attr.source}|${attr.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(attr);
      }
    }
  }
  return merged;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json<SearchResult>({ query: q, items: [], dataStatus: "unavailable", attribution: [] });
  }

  const results: SearchResult[] = [];
  const allItems: SearchResultItem[] = [];

  // 1. Local catalog first
  const localItems = sampleSearch(q);
  if (localItems.length > 0) {
    allItems.push(...localItems);
    results.push({
      query: q,
      items: localItems,
      dataStatus: "sample",
      attribution: [{ source: "Sample", text: "Showing sample records — reviewed locally." }],
    });
  }

  // 2. TVmaze for television
  const tvmaze = createTvmazeAdapter();
  try {
    const tvResult = await tvmaze.searchTitles(q, { signal: req.signal });
    if (tvResult.items.length > 0) {
      allItems.push(...tvResult.items);
      results.push(tvResult);
    }
  } catch {
    /* fall through */
  }

  // 3. Wikidata for movies and general titles
  const wikidata = createWikidataAdapter();
  try {
    const wkResult = await wikidata.searchTitles(q, { signal: req.signal });
    if (wkResult.items.length > 0) {
      allItems.push(...wkResult.items);
      results.push(wkResult);
    }
  } catch {
    /* fall through */
  }

  // Deduplicate, limit to 16, and merge attributions
  const deduped = dedupeResults(allItems).slice(0, 16);
  const attributions = mergeAttributions(results);

  return NextResponse.json<SearchResult>({
    query: q,
    items: deduped,
    dataStatus: deduped.length > 0 ? "live" : "unavailable",
    attribution: attributions.length > 0 ? attributions : [{ source: "Metadata", text: "No results found." }],
  });
}
