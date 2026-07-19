// GET /api/guidance?source=tmdb&id=27205&mediaType=movie
//
// Returns generic (non-personalized) "Do I Want to Watch This?" guidance for
// one title. The AI call happens server-side behind the access policy in
// src/lib/guidance/service.ts (kill switch → entitlement → cache → cost
// gates → AI). The plan is resolved from server config only — no request
// field, header, or cookie can grant access — and the API key never reaches
// the client. Viewer preferences never reach this route either;
// personalization is computed on-device from the structured response.
//
// Caching: identical requests must not repeatedly cost AI money.
//   1. In-memory cache per server instance (24h TTL).
//   2. CDN caching via s-maxage on successful responses, so Vercel's edge
//      serves repeats without invoking us. Kept to one day so policy changes
//      (beta end, kill switch) propagate quickly.

import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { createTvmazeAdapter } from "@/lib/media/tvmaze";
import type { MediaType } from "@/lib/media/types";
import { generateGuidance } from "@/lib/guidance/provider";
import type { GuidanceResponse } from "@/lib/guidance/types";
import { EST_COST_PER_GENERATION_USD, readGuidanceConfig } from "@/lib/guidance/config";
import { createUsageTracker } from "@/lib/guidance/usage";
import { getGuidance } from "@/lib/guidance/service";
import { resolvePlan } from "@/lib/entitlements";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { expires: number; body: GuidanceResponse }>();

const responseCache = {
  get(key: string): GuidanceResponse | null {
    const hit = cache.get(key);
    if (!hit) return null;
    if (hit.expires < Date.now()) {
      cache.delete(key);
      return null;
    }
    return hit.body;
  },
  set(key: string, body: GuidanceResponse) {
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, body });
  },
};

// Env is fixed per deployment, so config + the usage tracker are per-instance.
const config = readGuidanceConfig();
const usage = createUsageTracker({
  dailyLimit: config.dailyLimit,
  monthlyBudgetUsd: config.monthlyBudgetUsd,
  costPerGenerationUsd: EST_COST_PER_GENERATION_USD,
});

const CDN_CACHE = "public, s-maxage=86400, stale-while-revalidate=86400";

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

  try {
    const adapter =
      source === "tvmaze" ? createTvmazeAdapter() : source === "tmdb" ? createTmdbAdapter() : null;

    const body = await getGuidance(`${source}:${id}:${mediaType}`, {
      config,
      plan: resolvePlan({ betaEnabled: config.betaEnabled }),
      usage,
      cache: responseCache,
      fetchTitle: () => (adapter ? adapter.getTitle(id, mediaType) : Promise.resolve(null)),
      generate: generateGuidance,
    });
    return respond(body);
  } catch {
    // Never crash the title page.
    return respond({ status: "error" });
  }
}
