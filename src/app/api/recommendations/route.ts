import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import type { MediaType } from "@/lib/media/types";
import { loadRecConfig } from "@/lib/recommendations/config";
import { decideAIAccess } from "@/lib/recommendations/entitlement";
import { consumeAIGeneration } from "@/lib/recommendations/rateLimit";
import { dedupe, getCached, recCacheKey, setCached } from "@/lib/recommendations/cache";
import { sanitizeRecRequest } from "@/lib/recommendations/request";
import { retrieveCandidates, enrichCandidates } from "@/lib/recommendations/retrieve";
import { contentFilter, fallbackKnow, fallbackWhy, hardFilter, matchLevelFor, rankCandidates } from "@/lib/recommendations/rank";
import { aiRerank } from "@/lib/recommendations/ai";
import type { AIRecommendationResponse, RecCandidate, RecommendationItem, RecResponse } from "@/lib/recommendations/types";

// For You: hybrid recommendations. Deterministic retrieval + ranking over
// TMDB always runs (free, no AI cost). The AI layer — rerank, "Why this fits
// you", "Know before watching", spoiler-free content guide — runs only when
// every server-side gate passes: master switch → entitlement → rate limit →
// cache. Failures at any point fall back to the deterministic cards, so the
// page always works.

const ENRICH_LIMIT = 16;

export async function POST(req: NextRequest) {
  const request = sanitizeRecRequest(await req.json().catch(() => null));
  if (!request) {
    return NextResponse.json<RecResponse>({ status: "no_seeds", ai: false, items: [] }, { status: 400 });
  }

  const config = loadRecConfig();

  if (!(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY)) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json<RecResponse>({ status: "ok", ai: false, aiReason: "disabled", items: sampleItems(config.resultCount) });
    }
    return NextResponse.json<RecResponse>({ status: "metadata_unavailable", ai: false, items: [] });
  }

  const { mode, profile, seeds, excludeIds } = request;
  const hasSignal = seeds.length > 0 || profile.likedGenres.length > 0 || profile.tones.length > 0;
  if (!hasSignal) {
    return NextResponse.json<RecResponse>({ status: "no_seeds", ai: false, items: [] });
  }

  // ---- Deterministic pipeline (always free) -------------------------------
  const adapter = createTmdbAdapter();
  const filterOpts = { excludeIds: new Set(excludeIds), profile, mode };

  let pool: RecCandidate[] = [];
  try {
    pool = await retrieveCandidates(adapter, seeds, profile, mode);
  } catch {
    pool = [];
  }
  pool = hardFilter(pool, filterOpts);
  pool = rankCandidates(pool, profile, mode);
  const enriched = await enrichCandidates(adapter, pool, ENRICH_LIMIT);
  const finalists = contentFilter(rankCandidates(enriched, profile, mode), filterOpts);

  if (finalists.length === 0) {
    return NextResponse.json<RecResponse>({ status: "no_candidates", ai: false, items: [] });
  }

  const deliver = Math.min(finalists.length, config.resultCount + 5); // spares power "Show me another"
  const board = finalists.slice(0, deliver) as Array<RecCandidate & { providers?: string[] }>;

  const toItem = (c: RecCandidate & { providers?: string[] }): RecommendationItem => ({
    id: c.id,
    source: "tmdb",
    sourceId: c.sourceId,
    mediaType: c.mediaType as MediaType,
    title: c.title,
    releaseYear: c.releaseYear,
    posterUrl: c.posterUrl,
    genres: c.genres,
    runtimeMinutes: c.runtimeMinutes,
    officialRating: c.officialRating,
    providers: c.providers,
    matchLevel: matchLevelFor(c.score, mode),
    whyItFits: fallbackWhy(c, profile, mode),
    knowBeforeWatching: fallbackKnow(c),
    because: c.because,
  });

  // ---- AI layer (gated) ---------------------------------------------------
  const access = decideAIAccess(config);
  let aiResult: AIRecommendationResponse | null = null;
  let aiReason: RecResponse["aiReason"] = access.allowed ? undefined : access.reason;

  if (access.allowed) {
    const aiCandidates = board.slice(0, config.maxCandidates);
    const cacheKey = recCacheKey({
      v: 1,
      mode,
      profile,
      seeds: seeds.map((s) => s.sourceId + s.weight).sort(),
      ids: aiCandidates.map((c) => c.id).sort(),
      n: config.resultCount,
    });

    aiResult = getCached<AIRecommendationResponse>(cacheKey) ?? null;
    if (!aiResult) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
      if (!consumeAIGeneration(request.deviceId, ip, config.dailyLimit)) {
        aiReason = "daily_limit";
      } else {
        aiResult = await dedupe(cacheKey, () =>
          aiRerank(profile, mode, aiCandidates, seeds.map((s) => s.title), {
            model: config.model,
            maxOutputTokens: config.maxOutputTokens,
            timeoutMs: config.timeoutMs,
            resultCount: config.resultCount,
          }),
        );
        if (aiResult) setCached(cacheKey, aiResult);
        else aiReason = "unavailable";
      }
    }
  }

  // ---- Assemble -----------------------------------------------------------
  let items: RecommendationItem[];
  if (aiResult) {
    const byId = new Map(board.map((c) => [c.id, c]));
    const aiItems: RecommendationItem[] = [];
    for (const r of aiResult.recommendations) {
      const c = byId.get(r.externalId);
      if (!c) continue; // validator guarantees this, belt and suspenders
      aiItems.push({
        ...toItem(c),
        matchLevel: r.matchLevel,
        whyItFits: r.whyItFits,
        knowBeforeWatching: r.knowBeforeWatching,
        contentGuide: r.spoilerFreeContentGuide,
      });
    }
    const aiIds = new Set(aiItems.map((i) => i.id));
    const spares = board.filter((c) => !aiIds.has(c.id)).map(toItem);
    items = [...aiItems, ...spares].slice(0, deliver);
  } else {
    items = board.map(toItem);
  }

  return NextResponse.json<RecResponse>({
    status: "ok",
    ai: !!aiResult,
    aiReason: aiResult ? undefined : aiReason,
    summary: aiResult?.summary,
    tasteProfile: aiResult?.tasteProfile,
    items,
  });
}

/** Keyless local dev: sample cards so the UI can be built and tested. */
function sampleItems(count: number): RecommendationItem[] {
  return Array.from({ length: count + 3 }, (_, i) => ({
    id: `sample:rec-${i + 1}`,
    source: "sample",
    sourceId: `rec-${i + 1}`,
    mediaType: (i % 3 === 0 ? "series" : "movie") as MediaType,
    title: `Sample Pick ${i + 1}`,
    releaseYear: 1995 + i * 3,
    genres: ["Drama", "Adventure"],
    runtimeMinutes: 95 + i * 10,
    officialRating: "PG-13",
    matchLevel: (i < 2 ? "strong" : i < 4 ? "good" : "stretch") as RecommendationItem["matchLevel"],
    whyItFits: "Sample: close to the titles you thumbed up, in a genre you rate highly.",
    knowBeforeWatching: "Sample: slower first act than most in its genre.",
    because: "Sample Movie 1",
  }));
}
