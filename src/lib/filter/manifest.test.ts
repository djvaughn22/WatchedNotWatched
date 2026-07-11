import { describe, expect, it } from "vitest";
import { canRunAutomaticActions, overlapWarnings, parseManifest, runtimeMatches, validateManifest } from "./manifest";
import type { FilterEvent, FilterManifest } from "./types";

const good: FilterManifest = {
  id: "m", version: 1, mediaId: "x", title: "T", durationSeconds: 100,
  source: "sample", createdAt: "", updatedAt: "",
  events: [{ id: "a", startSeconds: 1, endSeconds: 2, action: "mute", category: "language", severity: "mild", label: "L" }],
};

describe("validateManifest", () => {
  it("accepts a well-formed manifest", () => {
    expect(validateManifest(good).valid).toBe(true);
  });
  it("rejects a non-object", () => {
    expect(validateManifest(null).valid).toBe(false);
  });
  it("rejects bad action/category/severity", () => {
    const bad = { ...good, events: [{ ...good.events[0], action: "delete", category: "nope", severity: "huge" }] };
    const r = validateManifest(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
  it("rejects end <= start", () => {
    const bad = { ...good, events: [{ ...good.events[0], startSeconds: 5, endSeconds: 5 }] };
    expect(validateManifest(bad).valid).toBe(false);
  });
  it("warns when an event runs past the duration", () => {
    const m = { ...good, durationSeconds: 1, events: [{ ...good.events[0], startSeconds: 0.5, endSeconds: 5 }] };
    expect(validateManifest(m).warnings.some((w) => /after the media duration/.test(w))).toBe(true);
  });
  it("accepts optional edition/verification fields when well-formed", () => {
    const m: FilterManifest = {
      ...good,
      edition: "demo clip",
      provider: "watchednotwatched",
      runtimeSeconds: 100,
      runtimeToleranceSeconds: 2,
      verification: { state: "verified", verifiedAt: "2026-07-10", method: "manual playback check" },
    };
    expect(validateManifest(m).valid).toBe(true);
  });
  it("rejects malformed optional fields", () => {
    expect(validateManifest({ ...good, runtimeSeconds: -3 }).valid).toBe(false);
    expect(validateManifest({ ...good, edition: 7 }).valid).toBe(false);
    expect(validateManifest({ ...good, verification: { state: "maybe" } }).valid).toBe(false);
    expect(validateManifest({ ...good, verification: { state: "verified" } }).valid).toBe(false);
  });
});

describe("runtime verification gate", () => {
  const verified: FilterManifest = {
    ...good,
    runtimeSeconds: 100,
    verification: { state: "verified", verifiedAt: "2026-07-10" },
  };
  it("matches runtime within the default tolerance", () => {
    expect(runtimeMatches(verified, 100)).toBe(true);
    expect(runtimeMatches(verified, 101.5)).toBe(true);
    expect(runtimeMatches(verified, 104)).toBe(false);
    expect(runtimeMatches(verified, NaN)).toBe(false);
  });
  it("falls back to durationSeconds when runtimeSeconds is absent", () => {
    expect(runtimeMatches(good, 100)).toBe(true);
    expect(runtimeMatches(good, 90)).toBe(false);
  });
  it("blocks automatic actions unless verified AND runtime matches", () => {
    expect(canRunAutomaticActions(verified, 100)).toBe(true);
    expect(canRunAutomaticActions(verified, 90)).toBe(false); // wrong edition
    expect(canRunAutomaticActions(good, 100)).toBe(false); // unverified
  });
});

describe("overlapWarnings", () => {
  it("detects overlapping events", () => {
    const events: FilterEvent[] = [
      { id: "a", startSeconds: 0, endSeconds: 10, action: "mute", category: "language", severity: "mild", label: "A" },
      { id: "b", startSeconds: 5, endSeconds: 12, action: "skip", category: "violence", severity: "mild", label: "B" },
    ];
    expect(overlapWarnings(events).length).toBe(1);
  });
});

describe("parseManifest", () => {
  it("fails on invalid JSON", () => {
    expect(parseManifest("{not json").result.valid).toBe(false);
  });
  it("round-trips a valid manifest", () => {
    const { manifest } = parseManifest(JSON.stringify(good));
    expect(manifest?.events.length).toBe(1);
  });
});
