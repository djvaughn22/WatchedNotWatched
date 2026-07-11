import { describe, expect, it } from "vitest";
import { defaultProfiles } from "../profiles";
import { settingsFromProfile } from "./profileSettings";
import type { FilterManifest } from "./types";

const manifest: FilterManifest = {
  id: "m", version: 1, mediaId: "sample:x", title: "T", durationSeconds: 60,
  source: "sample", createdAt: "", updatedAt: "",
  events: [
    { id: "lang-mild", startSeconds: 1, endSeconds: 2, action: "mute", category: "language", severity: "mild", label: "A" },
    { id: "lang-strong", startSeconds: 3, endSeconds: 4, action: "mute", category: "language", severity: "strong", label: "B" },
    { id: "viol-moderate", startSeconds: 5, endSeconds: 6, action: "skip", category: "violence", severity: "moderate", label: "C" },
    { id: "relig-mild", startSeconds: 7, endSeconds: 8, action: "warn", category: "religious-concern", severity: "mild", label: "D" },
  ],
};

const profile = (id: string) => {
  const p = defaultProfiles().find((x) => x.id === id);
  if (!p) throw new Error(`no profile ${id}`);
  return p;
};

describe("settingsFromProfile", () => {
  it("Little Kids filters everything (strictest thresholds)", () => {
    const s = settingsFromProfile(profile("little-kids"), manifest);
    expect(s.enabledCategories.has("language")).toBe(true);
    expect(s.disabledEventIds.size).toBe(0); // nothing tolerated
  });

  it("Family tolerates events at or below its thresholds", () => {
    // Family: language moderate, violence moderate.
    const s = settingsFromProfile(profile("family"), manifest);
    expect(s.disabledEventIds.has("lang-mild")).toBe(true); // tolerated
    expect(s.disabledEventIds.has("lang-strong")).toBe(false); // filtered
    expect(s.disabledEventIds.has("viol-moderate")).toBe(true); // tolerated
  });

  it("treats a category without a stated threshold as strictest", () => {
    // No preset defines a religious-concern threshold.
    const s = settingsFromProfile(profile("adults"), manifest);
    expect(s.disabledEventIds.has("relig-mild")).toBe(false); // still filtered
    expect(s.disabledEventIds.has("lang-strong")).toBe(true); // severe tolerance
  });

  it("only includes categories the manifest actually uses", () => {
    const s = settingsFromProfile(profile("family"), manifest);
    expect(s.enabledCategories.has("nudity")).toBe(false);
  });
});
