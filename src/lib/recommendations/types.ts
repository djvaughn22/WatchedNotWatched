// Shared shapes for the For You recommendation engine. The pipeline is
// hybrid: deterministic retrieval + ranking over TMDB data first, an optional
// AI layer (rerank + explanations + spoiler-free content guidance) on top.
// The AI never invents titles — it only annotates candidates we hand it.

import type { MediaType } from "@/lib/media/types";

export type RecMode = "best_match" | "something_different" | "watch_together" | "quick_watch";

export const REC_MODES: RecMode[] = ["best_match", "something_different", "watch_together", "quick_watch"];

export const REC_MODE_LABELS: Record<RecMode, string> = {
  best_match: "Best Match",
  something_different: "Something Different",
  watch_together: "Watch Together",
  quick_watch: "Quick Watch",
};

/** One liked/loved seed title from the on-device library. */
export interface RecSeed {
  sourceId: string;
  mediaType: string;
  title: string;
  weight: number; // loved = 3, liked = 2
}

/** Compact taste profile — the only user context that leaves the device. */
export interface TasteProfile {
  likedGenres: string[]; // strongest first
  dislikedGenres: string[];
  mediaTypePreference: "movie" | "series" | "either";
  tones: string[]; // cold-start chips: "light and funny", "serious", ...
  contentComfort: "family" | "standard" | "open";
  runtimeMaxMinutes?: number; // quick watch budget
}

/** What the client sends to POST /api/recommendations. */
export interface RecRequest {
  mode: RecMode;
  deviceId: string;
  seeds: RecSeed[];
  profile: TasteProfile;
  excludeIds: string[]; // library + dismissed + already-shown ids
}

/** A candidate inside the pipeline, before it becomes a card. */
export interface RecCandidate {
  id: string; // "tmdb:123"
  sourceId: string;
  mediaType: MediaType;
  title: string;
  releaseYear?: number;
  posterUrl?: string;
  genres?: string[];
  runtimeMinutes?: number;
  officialRating?: string;
  synopsis?: string;
  score: number;
  /** Retrieval-time score (seed agreement / discover baseline). Set by the
   *  first rank pass so re-ranking after enrichment never double-counts. */
  baseScore?: number;
  because?: string; // seed title that surfaced it
}

export type MatchLevel = "strong" | "good" | "stretch";

export const MATCH_LABELS: Record<MatchLevel, string> = {
  strong: "Strong Match",
  good: "Good Match",
  stretch: "Something Different",
};

export interface SpoilerFreeContentGuide {
  violence: string;
  language: string;
  sexualContent: string;
  frighteningIntensity: string;
  substanceUse: string;
  matureThemes: string;
}

/** One finished recommendation card. */
export interface RecommendationItem {
  id: string;
  source: string;
  sourceId: string;
  mediaType: MediaType;
  title: string;
  releaseYear?: number;
  posterUrl?: string;
  genres?: string[];
  runtimeMinutes?: number;
  officialRating?: string;
  providers?: string[]; // streaming names when TMDB/JustWatch has them
  matchLevel: MatchLevel;
  whyItFits: string;
  knowBeforeWatching: string;
  contentGuide?: SpoilerFreeContentGuide; // AI-written only; never invented server-side
  because?: string;
}

/** Strict shape the AI must return (validated server-side). */
export interface AIRecommendationResponse {
  summary: string;
  tasteProfile: {
    enjoys: string[];
    avoids: string[];
    currentMood?: string;
  };
  recommendations: Array<{
    externalId: string; // MUST be one of the candidate ids we sent
    matchLevel: MatchLevel;
    whyItFits: string;
    knowBeforeWatching: string;
    spoilerFreeContentGuide: SpoilerFreeContentGuide;
  }>;
}

export type RecStatus =
  | "ok"
  | "no_seeds"
  | "no_candidates"
  | "metadata_unavailable";

/** What the API returns to the client. */
export interface RecResponse {
  status: RecStatus;
  /** True when the AI layer wrote the explanations on these cards. */
  ai: boolean;
  /** Why the AI layer was skipped, when it was. */
  aiReason?: "disabled" | "entitlement_required" | "daily_limit" | "unavailable";
  summary?: string;
  tasteProfile?: { enjoys: string[]; avoids: string[]; currentMood?: string };
  items: RecommendationItem[];
}
