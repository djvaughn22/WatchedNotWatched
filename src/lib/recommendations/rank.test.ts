import { describe, expect, it } from "vitest";
import { contentFilter, fallbackKnow, fallbackWhy, hardFilter, matchLevelFor, rankCandidates } from "./rank";
import type { RecCandidate, TasteProfile } from "./types";

const profile = (over: Partial<TasteProfile> = {}): TasteProfile => ({
  likedGenres: ["Drama"],
  dislikedGenres: [],
  mediaTypePreference: "either",
  tones: [],
  contentComfort: "standard",
  ...over,
});

const cand = (id: string, over: Partial<RecCandidate> = {}): RecCandidate => ({
  id: `tmdb:${id}`,
  sourceId: id,
  mediaType: "movie",
  title: `Title ${id}`,
  score: 2,
  ...over,
});

describe("hardFilter", () => {
  it("excludes watched and dismissed titles via excludeIds", () => {
    const out = hardFilter([cand("1"), cand("2")], {
      excludeIds: new Set(["tmdb:1"]),
      profile: profile(),
      mode: "best_match",
    });
    expect(out.map((c) => c.id)).toEqual(["tmdb:2"]);
  });

  it("removes duplicate ids", () => {
    const out = hardFilter([cand("1"), cand("1")], { excludeIds: new Set(), profile: profile(), mode: "best_match" });
    expect(out).toHaveLength(1);
  });

  it("honors media type preference", () => {
    const out = hardFilter([cand("1"), cand("2", { mediaType: "series" })], {
      excludeIds: new Set(),
      profile: profile({ mediaTypePreference: "series" }),
      mode: "best_match",
    });
    expect(out.map((c) => c.id)).toEqual(["tmdb:2"]);
  });
});

describe("contentFilter", () => {
  it("quick_watch keeps only titles within the runtime budget and drops unknown runtimes", () => {
    const out = contentFilter(
      [cand("1", { runtimeMinutes: 45 }), cand("2", { runtimeMinutes: 130 }), cand("3")],
      { excludeIds: new Set(), profile: profile({ runtimeMaxMinutes: 60 }), mode: "quick_watch" },
    );
    expect(out.map((c) => c.id)).toEqual(["tmdb:1"]);
  });

  it("watch_together drops adult-rated titles", () => {
    const out = contentFilter(
      [cand("1", { officialRating: "R" }), cand("2", { officialRating: "PG" }), cand("3", { officialRating: "TV-MA" })],
      { excludeIds: new Set(), profile: profile(), mode: "watch_together" },
    );
    expect(out.map((c) => c.id)).toEqual(["tmdb:2"]);
  });

  it("family content comfort drops adult ratings in every mode", () => {
    const out = contentFilter(
      [cand("1", { officialRating: "R" }), cand("2", { officialRating: "PG-13" })],
      { excludeIds: new Set(), profile: profile({ contentComfort: "family" }), mode: "best_match" },
    );
    expect(out.map((c) => c.id)).toEqual(["tmdb:2"]);
  });
});

describe("rankCandidates", () => {
  it("boosts liked genres and penalizes disliked ones (feedback shifts future ranking)", () => {
    const p = profile({ likedGenres: ["Drama"], dislikedGenres: ["Thriller"] });
    const out = rankCandidates(
      [cand("thriller", { genres: ["Thriller"] }), cand("drama", { genres: ["Drama"] })],
      p,
      "best_match",
    );
    expect(out[0].id).toBe("tmdb:drama");
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  it("something_different stops rewarding familiar genres", () => {
    const p = profile({ likedGenres: ["Drama"] });
    const out = rankCandidates(
      [cand("familiar", { genres: ["Drama"], score: 2 }), cand("fresh", { genres: ["Western"], score: 2 })],
      p,
      "something_different",
    );
    expect(out[0].id).toBe("tmdb:fresh");
  });

  it("is idempotent — re-ranking after enrichment never double-counts bonuses", () => {
    const p = profile({ likedGenres: ["Drama"] });
    const once = rankCandidates([cand("1", { genres: ["Drama"] })], p, "best_match");
    const twice = rankCandidates(once, p, "best_match");
    expect(twice[0].score).toBe(once[0].score);
  });

  it("is deterministic for equal scores (title tiebreak)", () => {
    const out = rankCandidates([cand("b", { title: "B" }), cand("a", { title: "A" })], profile(), "best_match");
    expect(out.map((c) => c.title)).toEqual(["A", "B"]);
  });
});

describe("labels and fallback copy", () => {
  it("maps scores to honest labels, all-stretch in something_different", () => {
    expect(matchLevelFor(7, "best_match")).toBe("strong");
    expect(matchLevelFor(2, "best_match")).toBe("good");
    expect(matchLevelFor(1, "best_match")).toBe("stretch");
    expect(matchLevelFor(10, "something_different")).toBe("stretch");
  });

  it("always produces a why and a know line without AI", () => {
    const c = cand("1", { genres: ["Drama"], because: "Inception" });
    expect(fallbackWhy(c, profile(), "best_match")).toContain("Inception");
    expect(fallbackKnow(cand("2", { genres: ["Thriller"] }))).toContain("Thriller");
    expect(fallbackKnow(cand("3", { mediaType: "series" }))).toContain("series");
  });
});
