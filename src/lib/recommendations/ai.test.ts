// Provider-boundary tests. The OpenAI SDK is mocked — the automated suite
// never makes a real API call. What we prove: a valid structured response is
// accepted, and every failure shape (malformed output, invented ids, thrown
// timeout / rate-limit / credit errors) resolves to null so the route falls
// back to deterministic cards.
//
// NOTE: no beforeEach mock reset here. In this vitest version, resetting or
// clearing the module-mocked fn between tests makes a later rejected call
// surface as an unhandled rejection instead of being caught by aiRerank's
// try/catch. Each test installs its own implementation and asserts on
// call-count deltas instead.

import { describe, expect, it, vi } from "vitest";
import type { RecCandidate, TasteProfile } from "./types";

const createMock = vi.fn();
vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { create: createMock };
  },
}));

import { aiRerank } from "./ai";

const profile: TasteProfile = {
  likedGenres: ["Drama"],
  dislikedGenres: [],
  mediaTypePreference: "either",
  tones: [],
  contentComfort: "standard",
};

const cand = (id: string): RecCandidate => ({
  id: `tmdb:${id}`,
  sourceId: id,
  mediaType: "movie",
  title: `Title ${id}`,
  score: 2,
});

const opts = { model: "gpt-5.4-nano", maxOutputTokens: 4000, timeoutMs: 25000, resultCount: 5 };

const guide = {
  violence: "Mild",
  language: "Occasional",
  sexualContent: "Not a concern",
  frighteningIntensity: "Low",
  substanceUse: "Brief",
  matureThemes: "Grief",
};

const goodPayload = {
  summary: "Drama-leaning picks.",
  tasteProfile: { enjoys: ["Drama"], avoids: [], currentMood: null },
  recommendations: [
    {
      externalId: "tmdb:1",
      matchLevel: "strong",
      whyItFits: "Close to what you rate highly.",
      knowBeforeWatching: "Slow first act.",
      spoilerFreeContentGuide: guide,
    },
  ],
};

const calls = () => createMock.mock.calls.length;

describe("aiRerank (OpenAI mocked at the SDK boundary)", () => {
  it("accepts a valid structured response", async () => {
    createMock.mockImplementation(async () => ({ output_text: JSON.stringify(goodPayload) }));
    const before = calls();
    const out = await aiRerank(profile, "best_match", [cand("1"), cand("2")], ["Seed"], opts);
    expect(out?.recommendations[0].externalId).toBe("tmdb:1");
    expect(calls() - before).toBe(1);
    const req = createMock.mock.calls.at(-1)![0];
    expect(req.model).toBe("gpt-5.4-nano");
    expect(req.max_output_tokens).toBe(4000);
    expect(req.text.format.strict).toBe(true);
  });

  it("rejects a response whose only pick is an invented id", async () => {
    const invented = { ...goodPayload, recommendations: [{ ...goodPayload.recommendations[0], externalId: "tmdb:999" }] };
    createMock.mockImplementation(async () => ({ output_text: JSON.stringify(invented) }));
    expect(await aiRerank(profile, "best_match", [cand("1")], [], opts)).toBeNull();
  });

  it("falls back on malformed JSON output", async () => {
    createMock.mockImplementation(async () => ({ output_text: "not json {" }));
    expect(await aiRerank(profile, "best_match", [cand("1")], [], opts)).toBeNull();
  });

  it("falls back on empty output (refusal / incomplete)", async () => {
    createMock.mockImplementation(async () => ({ output_text: "" }));
    expect(await aiRerank(profile, "best_match", [cand("1")], [], opts)).toBeNull();
  });

  it("falls back safely when the SDK throws (timeout)", async () => {
    createMock.mockImplementation(async () => {
      throw Object.assign(new Error("Request timed out"), { name: "APIConnectionTimeoutError" });
    });
    expect(await aiRerank(profile, "best_match", [cand("1")], [], opts)).toBeNull();
  });

  it("falls back safely on rate-limit / exhausted-credit errors", async () => {
    createMock.mockImplementation(async () => {
      throw Object.assign(new Error("429 insufficient_quota"), { status: 429 });
    });
    expect(await aiRerank(profile, "best_match", [cand("1")], [], opts)).toBeNull();
  });

  it("refuses to send an oversized prompt at all", async () => {
    createMock.mockImplementation(async () => ({ output_text: JSON.stringify(goodPayload) }));
    const before = calls();
    const many = Array.from({ length: 200 }, (_, i) => ({
      ...cand(String(i)),
      synopsis: "x".repeat(180),
      title: "A long movie title here",
    }));
    expect(await aiRerank(profile, "best_match", many, [], opts)).toBeNull();
    expect(calls()).toBe(before);
  });
});
