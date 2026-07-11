import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import type { MediaType, SearchResultItem } from "@/lib/media/types";

interface SimilarResponse {
  items: SearchResultItem[];
  supported: boolean; // false when no similar-title source is configured
}

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") ?? "";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const mediaType = (req.nextUrl.searchParams.get("mediaType") as MediaType) || "movie";

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
