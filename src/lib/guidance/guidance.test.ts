import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseGuidance, CATEGORY_IDS, UNKNOWN_NOTE, type TitleGuidance } from "./types";
import { buildUserPrompt, GUIDANCE_SYSTEM_PROMPT, SPOILER_RULES } from "./prompt";
import { generateGuidance } from "./provider";
import { personalize } from "./personalize";
import { emptyPrefs, sanitizePrefs, youngestBucket, hasAnyPrefs, PREFS_KEY } from "../prefs";

// A well-formed guidance object, close to the Memento acceptance example.
function mementoGuidance(): TitleGuidance {
  return {
    quickTake:
      "Watch Memento when you want a dark, intelligent mystery that demands attention. Skip it tonight if you want something light, relaxing, or easy to follow.",
    categories: [
      { id: "violence", level: "moderate", note: "Tense confrontations, injuries, and threatening situations." },
      { id: "language", level: "strong", note: "Frequent adult language." },
      { id: "sexual_content", level: "moderate", note: "Adult situations and some sexual material." },
      { id: "scary_intense", level: "high", note: "Psychological tension, uncertainty, danger, and an uneasy tone." },
      { id: "substances", level: "moderate", note: "Drug-related material, medication, alcohol, and criminal activity." },
      { id: "mature_themes", level: "high", note: "Memory loss, manipulation, grief, revenge, trust, and moral ambiguity." },
    ],
    bestFit: "Mature teens and adults who enjoy challenging psychological mysteries.",
    deepDive:
      "Memento is less about relaxing with a story and more about actively piecing one together. It is dark, tense, and intentionally disorienting, with adult language, mature subject matter, and moments of violence. It is a strong choice for viewers who enjoy mysteries that demand focus and lead to discussion afterward. It is probably not the right pick for younger viewers or anyone wanting a calm, uncomplicated movie night.",
    attention: "full",
    tone: "dark",
    pacing: "steady",
    occasions: ["focused_night"],
  };
}

describe("parseGuidance (schema validation)", () => {
  it("accepts a well-formed object and keeps category order", () => {
    const parsed = parseGuidance(mementoGuidance());
    expect(parsed).not.toBeNull();
    expect(parsed!.categories.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
  });

  it("rejects junk", () => {
    expect(parseGuidance(null)).toBeNull();
    expect(parseGuidance("hi")).toBeNull();
    expect(parseGuidance({})).toBeNull();
    expect(parseGuidance({ quickTake: "x" })).toBeNull();
  });

  it("rejects missing prose or invalid enums", () => {
    const g = mementoGuidance() as unknown as Record<string, unknown>;
    expect(parseGuidance({ ...g, deepDive: "" })).toBeNull();
    expect(parseGuidance({ ...g, tone: "spooky" })).toBeNull();
    expect(parseGuidance({ ...g, quickTake: "a".repeat(1000) })).toBeNull();
  });

  it("degrades missing or invalid categories to unknown instead of failing", () => {
    const g = mementoGuidance();
    const parsed = parseGuidance({ ...g, categories: [g.categories[0], { id: "violence", level: "nuclear" }] });
    expect(parsed).not.toBeNull();
    const language = parsed!.categories.find((c) => c.id === "language")!;
    expect(language.level).toBe("unknown");
    // Uncertainty is surfaced, not hidden.
    expect(UNKNOWN_NOTE).toBe("Not enough reliable information.");
  });

  it("drops unknown occasions and dedupes", () => {
    const parsed = parseGuidance({ ...mementoGuidance(), occasions: ["date_night", "date_night", "nope"] });
    expect(parsed!.occasions).toEqual(["date_night"]);
  });
});

describe("spoiler-safety prompt rules", () => {
  it("the system prompt forbids every spoiler class the product bans", () => {
    for (const banned of ["twists", "endings or outcomes", "identities", "deaths", "relationship"]) {
      expect(SPOILER_RULES.toLowerCase()).toContain(banned.toLowerCase());
    }
    expect(GUIDANCE_SYSTEM_PROMPT).toContain(SPOILER_RULES);
    expect(GUIDANCE_SYSTEM_PROMPT).toMatch(/not an official rating/i);
  });

  it("the user prompt carries metadata but never invents a rating", () => {
    const p = buildUserPrompt({ title: "Memento", releaseYear: 2000, mediaType: "movie", genres: ["Mystery"] });
    expect(p).toContain("Memento");
    expect(p).toContain("do not invent one");
    const p2 = buildUserPrompt({ title: "X", mediaType: "series", officialRating: "TV-MA" });
    expect(p2).toContain("TV-MA");
  });

  it("acceptance fixture contains no spoiler language", () => {
    const g = mementoGuidance();
    const text = [g.quickTake, g.bestFit, g.deepDive, ...g.categories.map((c) => c.note)].join(" ").toLowerCase();
    for (const spoilerWord of ["ending", "twist", "dies at", "killer is", "turns out", "revealed to be"]) {
      expect(text).not.toContain(spoilerWord);
    }
  });
});

describe("generateGuidance (provider fallbacks)", () => {
  const KEY = "ANTHROPIC_API_KEY";
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env[KEY];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  const req = { title: "Memento", mediaType: "movie" as const };

  it("reports unconfigured when no key is set (no call is made)", async () => {
    delete process.env[KEY];
    const result = await generateGuidance(req, async () => {
      throw new Error("should not be called");
    });
    expect(result.status).toBe("unconfigured");
  });

  it("maps 429/529 to rate_limited", async () => {
    process.env[KEY] = "test-key";
    for (const status of [429, 529]) {
      const result = await generateGuidance(req, async () => {
        throw Object.assign(new Error("limit"), { status });
      });
      expect(result.status).toBe("rate_limited");
    }
  });

  it("maps provider failures and malformed JSON to error, never throws", async () => {
    process.env[KEY] = "test-key";
    expect((await generateGuidance(req, async () => "not json{{")).status).toBe("error");
    expect((await generateGuidance(req, async () => JSON.stringify({ nope: 1 }))).status).toBe("error");
    expect(
      (
        await generateGuidance(req, async () => {
          throw Object.assign(new Error("boom"), { status: 500 });
        })
      ).status,
    ).toBe("error");
  });

  it("returns validated guidance on a good response", async () => {
    process.env[KEY] = "test-key";
    const result = await generateGuidance(req, async ({ system, user }) => {
      expect(system).toContain("spoiler");
      expect(user).toContain("Memento");
      return JSON.stringify(mementoGuidance());
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.guidance.tone).toBe("dark");
  });

  it("never sends preferences or personal data to the model", async () => {
    process.env[KEY] = "test-key";
    await generateGuidance(req, async ({ system, user }) => {
      for (const term of ["preference", "sensitivit", "kids", "ages", "email"]) {
        expect(user.toLowerCase()).not.toContain(term);
      }
      expect(system).toBe(GUIDANCE_SYSTEM_PROMPT);
      return JSON.stringify(mementoGuidance());
    });
  });
});

describe("preference storage model", () => {
  it("prefs key is versioned and local-first", () => {
    expect(PREFS_KEY).toBe("wnw.prefs.v1");
  });

  it("sanitize survives junk and round-trips clean data", () => {
    expect(hasAnyPrefs(sanitizePrefs(null))).toBe(false);
    expect(hasAnyPrefs(sanitizePrefs({ evil: true, tone: 42 }))).toBe(false);
    const clean = sanitizePrefs({
      preferredGenres: ["Mystery", "Mystery", 7],
      tone: "dark",
      sensitivities: { violence: "very", bogus: "very", language: "nope" },
      viewerAges: [8, -2, 300, 41.4],
      occasion: "date_night",
    });
    expect(clean.preferredGenres).toEqual(["Mystery"]);
    expect(clean.tone).toBe("dark");
    expect(clean.sensitivities).toEqual({ violence: "very" });
    expect(clean.viewerAges).toEqual([8, 41]);
    expect(clean.occasion).toBe("date_night");
    expect(hasAnyPrefs(clean)).toBe(true);
    // Round-trip through JSON (what localStorage does) is lossless.
    expect(sanitizePrefs(JSON.parse(JSON.stringify(clean)))).toEqual(clean);
  });

  it("youngest viewer bucket combines toggles and ages", () => {
    expect(youngestBucket(emptyPrefs())).toBe("adult");
    expect(youngestBucket({ ...emptyPrefs(), kidsWatching: true })).toBe("child");
    expect(youngestBucket({ ...emptyPrefs(), teensWatching: true })).toBe("teen");
    expect(youngestBucket({ ...emptyPrefs(), viewerAges: [9, 40] })).toBe("child");
    expect(youngestBucket({ ...emptyPrefs(), viewerAges: [15, 40] })).toBe("teen");
  });
});

describe("personalize (on-device verdict)", () => {
  const g = mementoGuidance();

  it("returns null with no preferences — card still works generically", () => {
    expect(personalize(g, emptyPrefs(), { genres: ["Mystery"] })).toBeNull();
  });

  it("says yes when tastes match and nothing is over limit", () => {
    const prefs = { ...emptyPrefs(), preferredGenres: ["Mystery"], tone: "dark" as const };
    const v = personalize(g, prefs, { genres: ["Mystery", "Thriller"] })!;
    expect(v.kind).toBe("yes");
    expect(v.headline).toBe("Yes, this fits what you usually enjoy.");
  });

  it("flags younger-viewer settings without banning the adults", () => {
    const prefs = { ...emptyPrefs(), kidsWatching: true };
    const v = personalize(g, prefs, { genres: ["Mystery"] })!;
    expect(v.kind).toBe("kids_no");
    expect(v.headline).toMatch(/not a good match for the younger viewer settings/);
    expect(v.headline).toMatch(/Likely/); // hedged — no absolute safety claims
  });

  it("respects the viewer's own content limits", () => {
    const prefs = { ...emptyPrefs(), sensitivities: { language: "very" as const } };
    const v = personalize(g, prefs, { genres: [] })!;
    expect(v.kind).toBe("no");
    expect(v.points.join(" ")).toMatch(/Language/);
  });

  it("avoided genres mean probably not tonight", () => {
    const prefs = { ...emptyPrefs(), avoidGenres: ["Mystery"] };
    const v = personalize(g, prefs, { genres: ["Mystery"] })!;
    expect(v.kind).toBe("no");
    expect(v.headline).toBe("Probably not tonight.");
  });

  it("content fits but mood clashes → mixed, with the reason", () => {
    const prefs = { ...emptyPrefs(), challenge: "easy" as const };
    const v = personalize(g, prefs, { genres: [] })!;
    expect(v.kind).toBe("mixed");
    expect(v.headline).toMatch(/content fits your limits/);
    expect(v.points.join(" ")).toMatch(/full attention/);
  });

  it("surfaces unknown categories instead of silently passing them", () => {
    const withUnknown: TitleGuidance = {
      ...g,
      categories: g.categories.map((c) => (c.id === "violence" ? { ...c, level: "unknown" as const, note: "" } : c)),
    };
    const prefs = { ...emptyPrefs(), sensitivities: { violence: "very" as const }, preferredGenres: ["Mystery"] };
    const v = personalize(withUnknown, prefs, { genres: ["Mystery"] })!;
    expect(v.points.join(" ")).toMatch(/not enough reliable information/i);
  });
});
