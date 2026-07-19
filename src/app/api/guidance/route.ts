// GET /api/guidance?source=tmdb&id=27205&mediaType=movie
//
// Returns generic (non-personalized) "Do I Want to Watch This?" guidance for
// one title. The AI call happens HERE, server-side — the API key never
// reaches the client, and viewer preferences never reach this route
// (personalization is computed on-device from the structured response).
//
// Caching: identical requests must not repeatedly cost AI money.
//   1. In-memory cache per server instance (24h TTL).
//   2. CDN caching via s-maxage on successful responses (guidance for a
//      title is stable), so Vercel's edge serves repeats without invoking us.

import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { createTvmazeAdapter } from "@/lib/media/tvmaze";
import type { MediaType } from "@/lib/media/types";
import { generateGuidance } from "@/lib/guidance/provider";
import type { GuidanceResponse } from "@/lib/guidance/types";
import { canUseDecisionCard } from "@/lib/entitlements";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { expires: number; body: GuidanceResponse }>();

function cacheGet(key: string): GuidanceResponse | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.body;
}

function cacheSet(key: string, body: GuidanceResponse) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, body });
}

const CDN_CACHE = "public, s-maxage=604800, stale-while-revalidate=86400";

function respond(body: GuidanceResponse): NextResponse {
  return NextResponse.json(body, {
    headers: { "Cache-Control": body.status === "ok" ? CDN_CACHE : "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") ?? "tmdb";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const mediaTypeParam = req.nextUrl.searchParams.get("mediaType");
  const mediaType: MediaType = mediaTypeParam === "series" ? "series" : "movie";

  if (!id || !/^[\w:-]{1,40}$/.test(id)) {
    return NextResponse.json({ status: "no_metadata" } satisfies GuidanceResponse, { status: 400 });
  }

  const entitlement = canUseDecisionCard();
  if (!entitlement.allowed) {
    return NextResponse.json({ status: "error" } satisfies GuidanceResponse, { status: 403 });
  }

  const key = `${source}:${id}:${mediaType}`;
  const cached = cacheGet(key);
  if (cached) return respond(cached);

  try {
    // Metadata comes from OUR adapters, keyed by id — the client can't feed
    // the model arbitrary text through this route.
    const adapter =
      source === "tvmaze" ? createTvmazeAdapter() : source === "tmdb" ? createTmdbAdapter() : null;
    const title = adapter ? await adapter.getTitle(id, mediaType) : null;
    if (!title) return respond({ status: "no_metadata" });

    const result = await generateGuidance({
      title: title.title,
      releaseYear: title.releaseYear,
      mediaType: title.mediaType === "series" ? "series" : "movie",
      genres: title.genres,
      officialRating: title.officialRating,
      synopsis: title.synopsis,
    });

    const body: GuidanceResponse =
      result.status === "ok" ? { status: "ok", guidance: result.guidance } : { status: result.status };
    if (body.status === "ok") cacheSet(key, body);
    return respond(body);
  } catch {
    // Never crash the title page.
    return respond({ status: "error" });
  }
}
