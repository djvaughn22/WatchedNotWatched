// Candidate retrieval (SERVER ONLY). Candidates come from TMDB's
// recommendation graph around the user's seeds, topped up with well-rated
// discover results in the user's strongest genres (or adjacent ones for
// Something Different). Every candidate is a real catalog entry by
// construction — the AI never sees a title that didn't come from here.

import type { TmdbAdapter } from "@/lib/media/tmdb";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/media/genres";
import type { MediaType } from "@/lib/media/types";
import type { RecCandidate, RecMode, RecSeed, TasteProfile } from "./types";

const PER_SEED_CAP = 12;
const POOL_TARGET = 30;

function genreIdsFor(names: string[], mediaType: "movie" | "series"): number[] {
  const list = mediaType === "series" ? TV_GENRES : MOVIE_GENRES;
  return list.filter((g) => names.some((n) => g.label.toLowerCase() === n.toLowerCase())).map((g) => g.id);
}

export async function retrieveCandidates(
  adapter: TmdbAdapter,
  seeds: RecSeed[],
  profile: TasteProfile,
  mode: RecMode,
): Promise<RecCandidate[]> {
  const byId = new Map<string, RecCandidate>();
  const seedIds = new Set(seeds.map((s) => `tmdb:${s.sourceId}`));

  // 1. Seed neighborhoods, weighted by how much the user liked each seed.
  const perSeed = await Promise.all(
    seeds.map((s) =>
      adapter
        .getSimilar!(s.sourceId, s.mediaType === "series" ? "series" : "movie")
        .then((items) => ({ seed: s, items: (items ?? []).slice(0, PER_SEED_CAP) }))
        .catch(() => ({ seed: s, items: [] })),
    ),
  );
  for (const { seed, items } of perSeed) {
    for (const item of items) {
      if (seedIds.has(item.id)) continue;
      const prev = byId.get(item.id);
      if (prev) {
        prev.score += seed.weight;
      } else {
        byId.set(item.id, {
          id: item.id,
          sourceId: item.sourceId,
          mediaType: item.mediaType,
          title: item.title,
          releaseYear: item.releaseYear,
          posterUrl: item.posterUrl,
          score: seed.weight,
          because: seed.title,
        });
      }
    }
  }

  // 2. Top-up from discover when the graph is thin (cold start, heavy
  //    filtering) or when the mode wants fresh territory.
  const needTopUp =
    byId.size < POOL_TARGET || mode === "something_different" || mode === "watch_together" || mode === "quick_watch";
  if (needTopUp) {
    const mediaTypes: Array<"movie" | "series"> =
      profile.mediaTypePreference === "either" ? ["movie", "series"] : [profile.mediaTypePreference];

    for (const mt of mediaTypes) {
      let genreIds: (number | undefined)[];
      if (mode === "watch_together") {
        genreIds = genreIdsFor(["Family", "Animation", "Comedy", "Adventure"], mt).slice(0, 2);
      } else if (mode === "something_different") {
        // Adjacent territory: well-rated genres the user has no verdict on.
        const known = new Set([...profile.likedGenres, ...profile.dislikedGenres].map((g) => g.toLowerCase()));
        const list = mt === "series" ? TV_GENRES : MOVIE_GENRES;
        genreIds = list.filter((g) => !known.has(g.label.toLowerCase())).slice(0, 2).map((g) => g.id);
      } else {
        const ids = genreIdsFor(profile.likedGenres, mt);
        genreIds = ids.length > 0 ? ids.slice(0, 2) : [undefined]; // no history → all-time board
      }

      const genreList = mt === "series" ? TV_GENRES : MOVIE_GENRES;
      const pages = await Promise.all(
        genreIds.map((gid) =>
          adapter
            .discoverTop({ mediaType: mt, genreId: gid, page: 1 })
            .then((items) => ({ gid, items }))
            .catch(() => ({ gid, items: [] })),
        ),
      );
      for (const { gid, items } of pages) {
        // The discover query genuinely filtered by this genre, so tagging it
        // is factual — it lets pre-enrichment ranking see mode-aligned
        // candidates before the full genre list arrives.
        const label = gid ? genreList.find((g) => g.id === gid)?.label : undefined;
        for (const item of items) {
          if (seedIds.has(item.id) || byId.has(item.id)) continue;
          byId.set(item.id, {
            id: item.id,
            sourceId: item.sourceId,
            mediaType: item.mediaType,
            title: item.title,
            releaseYear: item.releaseYear,
            posterUrl: item.posterUrl,
            genres: label ? [label] : undefined,
            score: 1, // discover baseline: real but not seed-endorsed
          });
        }
      }
    }
  }

  return [...byId.values()];
}

/**
 * Fetch full details (genres, runtime, rating, synopsis, providers) for the
 * strongest candidates. TMDB responses are edge-cached for an hour, so this
 * stays cheap on repeat traffic.
 */
export async function enrichCandidates(
  adapter: TmdbAdapter,
  candidates: RecCandidate[],
  limit: number,
): Promise<Array<RecCandidate & { providers?: string[] }>> {
  const top = candidates.slice(0, limit);
  return Promise.all(
    top.map(async (c) => {
      try {
        const t = await adapter.getTitle(c.sourceId, c.mediaType as MediaType);
        if (!t) return c;
        return {
          ...c,
          genres: t.genres,
          runtimeMinutes: t.runtimeMinutes,
          officialRating: t.officialRating,
          synopsis: t.synopsis,
          posterUrl: c.posterUrl ?? t.posterUrl,
          providers: (t.availability ?? [])
            .filter((a) => a.monetization === "sub" || a.monetization === "free" || a.monetization === "ads")
            .map((a) => a.providerName)
            .slice(0, 3),
        };
      } catch {
        return c;
      }
    }),
  );
}
