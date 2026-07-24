import { describe, expect, it } from "vitest";
import type { LibraryEntry } from "@/lib/library";
import { buildSeeds, buildTasteProfile } from "./profile";
import { defaultPrefs, sanitizePrefs } from "./prefs";
import { addDismissal, emptyFeedback, feedbackAdjustments, sanitizeFeedback } from "./feedback";
import { sanitizeRecRequest } from "./request";

const entry = (id: string, over: Partial<LibraryEntry> = {}): LibraryEntry => ({
  id: `tmdb:${id}`,
  source: "tmdb",
  sourceId: id,
  mediaType: "movie",
  title: `Title ${id}`,
  status: "watched",
  addedAt: "2026-07-01T00:00:00Z",
  ...over,
});

describe("buildSeeds", () => {
  it("uses loved and liked titles, loved first, capped at 8", () => {
    const entries = [
      entry("1", { myTake: "liked" }),
      entry("2", { myTake: "loved" }),
      ...Array.from({ length: 10 }, (_, i) => entry(`x${i}`, { myTake: "liked" })),
    ];
    const seeds = buildSeeds(entries);
    expect(seeds).toHaveLength(8);
    expect(seeds[0]).toMatchObject({ sourceId: "2", weight: 3 });
  });

  it("ignores unrated and non-tmdb titles", () => {
    const seeds = buildSeeds([entry("1"), entry("2", { myTake: "loved", source: "tvmaze" })]);
    expect(seeds).toHaveLength(0);
  });
});

describe("buildTasteProfile", () => {
  it("derives liked and disliked genres from verdicts", () => {
    const p = buildTasteProfile(
      [
        entry("1", { myTake: "loved", genres: ["Drama", "Crime"] }),
        entry("2", { myTake: "liked", genres: ["Drama"] }),
        entry("3", { myTake: "not_for_me", genres: ["Comedy"] }),
      ],
      defaultPrefs(),
    );
    expect(p.likedGenres[0]).toBe("Drama");
    expect(p.dislikedGenres).toContain("Comedy");
  });

  it("infers a media-type lean only when it's overwhelming", () => {
    const movies = Array.from({ length: 9 }, (_, i) => entry(`m${i}`));
    const mixed = [...movies.slice(0, 5), ...Array.from({ length: 5 }, (_, i) => entry(`s${i}`, { mediaType: "series" }))];
    expect(buildTasteProfile(movies, defaultPrefs()).mediaTypePreference).toBe("movie");
    expect(buildTasteProfile(mixed, defaultPrefs()).mediaTypePreference).toBe("either");
  });
});

describe("prefs + feedback stores", () => {
  it("sanitizes garbage to safe defaults", () => {
    expect(sanitizePrefs(null)).toEqual(defaultPrefs());
    expect(sanitizePrefs({ mediaType: "xx", runtimeMaxMinutes: -5, personalizationEnabled: "yes" }).mediaType).toBe("either");
    expect(sanitizeFeedback({ dismissed: [{ id: 1 }, { id: "tmdb:1", reason: "bogus" }] }).dismissed).toHaveLength(0);
  });

  it("dismissals dedupe by title and feed adjustments", () => {
    let fb = emptyFeedback();
    fb = addDismissal(fb, "tmdb:1", "too_intense");
    fb = addDismissal(fb, "tmdb:1", "too_intense");
    fb = addDismissal(fb, "tmdb:2", "too_intense");
    expect(fb.dismissed).toHaveLength(2);
    expect(feedbackAdjustments(fb).intenseComplaints).toBe(2);
  });
});

describe("sanitizeRecRequest — bounded input", () => {
  it("caps every list so the prompt has a hard ceiling", () => {
    const r = sanitizeRecRequest({
      mode: "best_match",
      deviceId: "d",
      seeds: Array.from({ length: 50 }, (_, i) => ({ sourceId: String(i), mediaType: "movie", title: `T${i}`, weight: 3 })),
      profile: { likedGenres: Array.from({ length: 50 }, (_, i) => `G${i}`) },
      excludeIds: Array.from({ length: 1000 }, (_, i) => `tmdb:${i}`),
    });
    expect(r?.seeds).toHaveLength(8);
    expect(r?.profile.likedGenres).toHaveLength(8);
    expect(r?.excludeIds).toHaveLength(400);
  });

  it("rejects bodies without a device id and coerces bad modes", () => {
    expect(sanitizeRecRequest({ mode: "best_match" })).toBeNull();
    expect(sanitizeRecRequest({ mode: "hack", deviceId: "d" })?.mode).toBe("best_match");
  });

  it("drops non-numeric seed ids (nothing user-typed reaches TMDB paths)", () => {
    const r = sanitizeRecRequest({ mode: "best_match", deviceId: "d", seeds: [{ sourceId: "../etc", mediaType: "movie", title: "x", weight: 2 }] });
    expect(r?.seeds).toHaveLength(0);
  });
});
