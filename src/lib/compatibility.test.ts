import { describe, expect, it } from "vitest";
import { evaluateCompatibility } from "./compatibility";
import type { ContentGuidance } from "./guidance";
import type { ViewingProfile } from "./profiles";

const family: ViewingProfile = {
  id: "family", name: "Family",
  thresholds: { language: "moderate", violence: "moderate" },
  enabledFilterCategories: [], createdAt: "", updatedAt: "",
};

const g = (cats: ContentGuidance["categories"]): ContentGuidance => ({ categories: cats });

describe("evaluateCompatibility", () => {
  it("good match when everything reviewed is within limits", () => {
    const r = evaluateCompatibility(g([
      { category: "language", level: "mild", source: "editorial" },
      { category: "violence", level: "moderate", source: "editorial" },
    ]), family);
    expect(r.verdict).toBe("good-match");
  });

  it("review-first when one reviewed category exceeds the limit", () => {
    const r = evaluateCompatibility(g([
      { category: "language", level: "strong", source: "editorial" },
      { category: "violence", level: "mild", source: "editorial" },
    ]), family);
    expect(r.verdict).toBe("review-first");
    expect(r.reasons[0]).toMatch(/exceeds/);
  });

  it("outside-profile when two or more categories exceed", () => {
    const r = evaluateCompatibility(g([
      { category: "language", level: "strong", source: "editorial" },
      { category: "violence", level: "severe", source: "editorial" },
    ]), family);
    expect(r.verdict).toBe("outside-profile");
  });

  it("not-enough-info when nothing gated is reviewed", () => {
    const r = evaluateCompatibility(g([
      { category: "language", level: "not-reviewed", source: "unknown" },
      { category: "violence", level: "not-reviewed", source: "unknown" },
    ]), family);
    expect(r.verdict).toBe("not-enough-info");
  });

  it("never treats not-reviewed as safe (unknown does not pass as good-match)", () => {
    const r = evaluateCompatibility(g([
      { category: "language", level: "none-noted", source: "editorial" },
      { category: "violence", level: "not-reviewed", source: "unknown" },
    ]), family);
    expect(r.verdict).not.toBe("good-match");
  });
});
