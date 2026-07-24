// Deterministic candidate filtering + ranking. This is the part of the
// engine that always runs and never costs anything: hard filters first, then
// a documented score. The AI layer only ever reorders and explains what this
// module has already approved — match labels come from these scores, not
// from invented percentages.
//
// Score =   seed agreement (each seed that surfaced the title adds its
//           weight: loved 3, liked 2)
//         + genre affinity (+1.5 per liked genre, capped at 3)
//         - disliked genres (-2 each)
//         + mode adjustments (Something Different inverts genre familiarity;
//           Watch Together boosts family-friendly genres)
//
// Labels: strong >= 6 (multiple seeds agree, or a loved seed plus genre
// alignment), good >= 2 (at least one real seed connection or solid genre
// alignment), else stretch. In Something Different mode everything is
// labeled "stretch" — that's the point of the mode.

import type { MatchLevel, RecCandidate, RecMode, TasteProfile } from "./types";

const FAMILY_GENRES = new Set(["Family", "Animation", "Comedy", "Adventure", "Kids", "Fantasy", "Music"]);
const INTENSE_GENRES = new Set(["Thriller", "Crime", "War", "War & Politics", "Mystery", "Horror"]);
/** US certifications acceptable for family / watch-together viewing. */
const FAMILY_RATINGS = new Set(["G", "PG", "PG-13", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14"]);
const ADULT_RATINGS = new Set(["R", "NC-17", "TV-MA", "18", "X"]);

export interface HardFilterOpts {
  excludeIds: Set<string>;
  profile: TasteProfile;
  mode: RecMode;
}

/** Hard filters: already seen/dismissed, wrong media type, duplicates. */
export function hardFilter(candidates: RecCandidate[], opts: HardFilterOpts): RecCandidate[] {
  const seen = new Set<string>();
  const pref = opts.profile.mediaTypePreference;
  return candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    if (opts.excludeIds.has(c.id)) return false;
    if (pref === "movie" && c.mediaType !== "movie") return false;
    if (pref === "series" && c.mediaType !== "series") return false;
    return true;
  });
}

/**
 * Post-enrichment filters that need runtime / certification data.
 * Titles with unknown data are kept unless the mode demands certainty:
 * Quick Watch drops unknown runtimes (the mode is about a time budget),
 * Watch Together and "family" comfort drop adult-rated titles.
 */
export function contentFilter(candidates: RecCandidate[], opts: HardFilterOpts): RecCandidate[] {
  const { mode, profile } = opts;
  const familyStrict = mode === "watch_together" || profile.contentComfort === "family";
  return candidates.filter((c) => {
    if (familyStrict) {
      if (c.officialRating && ADULT_RATINGS.has(c.officialRating)) return false;
      if (mode === "watch_together" && c.officialRating && !FAMILY_RATINGS.has(c.officialRating)) return false;
    }
    if (mode === "quick_watch") {
      const budget = profile.runtimeMaxMinutes ?? 60;
      if (!c.runtimeMinutes || c.runtimeMinutes > budget) return false;
    } else if (profile.runtimeMaxMinutes && c.runtimeMinutes && c.runtimeMinutes > profile.runtimeMaxMinutes * 2) {
      return false;
    }
    return true;
  });
}

export function scoreCandidate(c: RecCandidate, profile: TasteProfile, mode: RecMode): number {
  let score = c.baseScore ?? c.score; // seed agreement accumulated during retrieval

  const genres = c.genres ?? [];
  const liked = genres.filter((g) => profile.likedGenres.includes(g)).length;
  const disliked = genres.filter((g) => profile.dislikedGenres.includes(g)).length;
  score += Math.min(liked * 1.5, 3);
  score -= disliked * 2;

  if (mode === "something_different") {
    // Controlled stretch: familiar genres stop helping, adjacent ones win.
    score -= Math.min(liked * 1.5, 3) * 1.5;
    if (liked === 0 && disliked === 0 && genres.length > 0) score += 2;
  }
  if (mode === "watch_together") {
    if (genres.some((g) => FAMILY_GENRES.has(g))) score += 2;
    if (genres.some((g) => INTENSE_GENRES.has(g))) score -= 2;
  }
  if (mode === "quick_watch" && c.mediaType === "series") {
    score += 2; // episodes usually fit a short time budget
  }
  return score;
}

export function rankCandidates(
  candidates: RecCandidate[],
  profile: TasteProfile,
  mode: RecMode,
): RecCandidate[] {
  return candidates
    .map((c) => ({ ...c, baseScore: c.baseScore ?? c.score, score: scoreCandidate(c, profile, mode) }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function matchLevelFor(score: number, mode: RecMode): MatchLevel {
  if (mode === "something_different") return "stretch";
  if (score >= 6) return "strong";
  if (score >= 2) return "good";
  return "stretch";
}

/** Template explanation used whenever the AI layer doesn't run. */
export function fallbackWhy(c: RecCandidate, profile: TasteProfile, mode: RecMode): string {
  const likedGenre = (c.genres ?? []).find((g) => profile.likedGenres.includes(g));
  if (mode === "something_different") {
    return c.because
      ? `A step outside your usual lane, reached from ${c.because}.`
      : "A step outside your usual lane, still well rated by people who share some of your taste.";
  }
  if (c.because && likedGenre) return `Close to ${c.because}, and it's ${likedGenre} — a genre you rate highly.`;
  if (c.because) return `Viewers who liked ${c.because} tend to rate this one highly too.`;
  if (likedGenre) return `${likedGenre} is one of your strongest genres, and this is a standout in it.`;
  return "A close neighbor of the titles you thumbed up.";
}

/** Template caution used whenever the AI layer doesn't run. Genre-derived, never invented specifics. */
export function fallbackKnow(c: RecCandidate): string {
  const genres = c.genres ?? [];
  if (genres.some((g) => INTENSE_GENRES.has(g))) {
    return `${genres.find((g) => INTENSE_GENRES.has(g))} titles can run intense — check the rating${c.officialRating ? ` (${c.officialRating})` : ""} if that matters tonight.`;
  }
  if (c.mediaType === "series") return "It's a series — a bigger time commitment than one movie night.";
  if (c.runtimeMinutes && c.runtimeMinutes > 150) return `Long one — about ${Math.round(c.runtimeMinutes / 60 * 10) / 10} hours.`;
  return c.officialRating ? `Rated ${c.officialRating}.` : "Not much data on this one yet — trailer first if you're unsure.";
}
