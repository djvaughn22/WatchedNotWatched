import { describe, expect, it } from "vitest";
import { validateAIResponse } from "./validate";

const guide = {
  violence: "Mild",
  language: "Occasional",
  sexualContent: "Not a concern",
  frighteningIntensity: "Low",
  substanceUse: "Brief",
  matureThemes: "Grief",
};

const rec = (externalId: string, over: Record<string, unknown> = {}) => ({
  externalId,
  matchLevel: "strong",
  whyItFits: "Matches your taste for slow-burn drama.",
  knowBeforeWatching: "Long runtime.",
  spoilerFreeContentGuide: guide,
  ...over,
});

const allowed = new Set(["tmdb:1", "tmdb:2"]);

describe("validateAIResponse", () => {
  it("accepts a clean response", () => {
    const out = validateAIResponse(
      { summary: "Picks based on your drama lean.", tasteProfile: { enjoys: ["Drama"], avoids: [] }, recommendations: [rec("tmdb:1")] },
      allowed,
    );
    expect(out?.recommendations).toHaveLength(1);
  });

  it("rejects invented titles (ids we never sent)", () => {
    const out = validateAIResponse(
      { summary: "s", tasteProfile: {}, recommendations: [rec("tmdb:999"), rec("tmdb:2")] },
      allowed,
    );
    expect(out?.recommendations.map((r) => r.externalId)).toEqual(["tmdb:2"]);
  });

  it("removes duplicate titles", () => {
    const out = validateAIResponse(
      { summary: "s", tasteProfile: {}, recommendations: [rec("tmdb:1"), rec("tmdb:1")] },
      allowed,
    );
    expect(out?.recommendations).toHaveLength(1);
  });

  it("drops items with missing content-guide fields", () => {
    const bad = rec("tmdb:1", { spoilerFreeContentGuide: { violence: "Mild" } });
    const out = validateAIResponse({ summary: "s", tasteProfile: {}, recommendations: [bad, rec("tmdb:2")] }, allowed);
    expect(out?.recommendations.map((r) => r.externalId)).toEqual(["tmdb:2"]);
  });

  it("drops items whose text trips the spoiler guard", () => {
    const spoiler = rec("tmdb:1", { whyItFits: "You'll love that the killer is the narrator." });
    const out = validateAIResponse({ summary: "s", tasteProfile: {}, recommendations: [spoiler, rec("tmdb:2")] }, allowed);
    expect(out?.recommendations.map((r) => r.externalId)).toEqual(["tmdb:2"]);
  });

  it("fails safely on malformed envelopes", () => {
    expect(validateAIResponse(null, allowed)).toBeNull();
    expect(validateAIResponse("nope", allowed)).toBeNull();
    expect(validateAIResponse({ summary: 42, recommendations: [] }, allowed)).toBeNull();
    expect(validateAIResponse({ summary: "s", tasteProfile: {}, recommendations: "x" }, allowed)).toBeNull();
    expect(validateAIResponse({ summary: "s", tasteProfile: {}, recommendations: [rec("tmdb:999")] }, allowed)).toBeNull();
  });
});
