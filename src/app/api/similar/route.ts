import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { createOpenLibraryAdapter, relatedByAuthor, relatedBySubject } from "@/lib/media/openlibrary";
import type { MediaType, SearchResultItem } from "@/lib/media/types";

interface SimilarResponse {
  items: SearchResultItem[];
  supported: boolean; // false when no similar-title source is configured
}

export const maxDuration = 15;

async function relatedBooks(workKey: string, signal: AbortSignal): Promise<SearchResultItem[]> {
  const work = await createOpenLibraryAdapter().getTitle(workKey, "book");
  if (!work) return [];
  const exclude = new Set([work.id]);
  const author = work.creators?.[0];
  const subject = work.genres?.[0];
  const [byAuthor, bySubject] = await Promise.all([
    author ? relatedByAuthor(author, exclude, 8, signal).catch(() => []) : Promise.resolve([]),
    subject ? relatedBySubject(subject, exclude, 8, signal).catch(() => []) : Promise.resolve([]),
  ]);
  const seen = new Set<string>();
  return [...byAuthor, ...bySubject].filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
}

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") ?? "";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const mediaType = (req.nextUrl.searchParams.get("mediaType") as MediaType) || "movie";

  if (source === "openlibrary" && id) {
    try {
      const items = await relatedBooks(id, req.signal);
      return NextResponse.json<SimilarResponse>({ items, supported: true });
    } catch {
      return NextResponse.json<SimilarResponse>({ items: [], supported: true });
    }
  }

  // Similar titles come from TMDB only — no fabricated recommendations.
  if (source !== "tmdb" || !id || !(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY)) {
    return NextResponse.json<SimilarResponse>({ items: [], supported: false });
  }

  try {
    const items = (await createTmdbAdapter().getSimilar!(id, mediaType)) ?? [];
    return NextResponse.json<SimilarResponse>({ items, supported: true });
  } catch {
    return NextResponse.json<SimilarResponse>({ items: [], supported: true });
  }
}
