// The single place that talks to Anthropic (SERVER ONLY — the key never
// leaves this module, callers get validated data or null). One retry, hard
// timeout, bounded prompt, structured JSON output validated by validate.ts.

import Anthropic from "@anthropic-ai/sdk";
import type { AIRecommendationResponse, RecCandidate, RecMode, TasteProfile } from "./types";
import { validateAIResponse } from "./validate";

const MODE_BRIEF: Record<RecMode, string> = {
  best_match: "Pick the strongest overall matches for this viewer's taste.",
  something_different:
    "Pick a controlled stretch outside the viewer's usual habits — adjacent to their taste, not random. Label these picks 'stretch'.",
  watch_together:
    "Pick titles that work for mixed company (family, spouse, friends, mixed ages). Avoid anything awkward to watch together.",
  quick_watch: "Pick titles that fit a short time budget — tight movies or series with short episodes.",
};

// Stable system prompt (cache-friendly). Everything volatile goes in the user turn.
const SYSTEM = `You rank and explain movie/TV recommendations for the app WatchedNotWatched.

You will get a viewer taste profile and a numbered list of CANDIDATES (real titles from a movie database). Rules:
- Recommend ONLY from the candidate list, referencing each pick by its exact "id" as externalId. Never invent titles, years, actors, streaming services, ratings, or runtimes.
- Choose the requested number of picks, best fits first.
- "whyItFits": 1-2 plain sentences tying the pick to THIS viewer's taste. Direct language, no hype.
- "knowBeforeWatching": exactly one honest possible concern (pacing, tone, commitment, intensity...).
- "spoilerFreeContentGuide": short factual guidance for each field (violence, language, sexualContent, frighteningIntensity, substanceUse, matureThemes) based on what the title is known for; write "Not a concern" when it isn't one. If you don't know the title well, keep guidance general to its genre and rating.
- Everything must be spoiler-free: never reveal plot turns, endings, or character fates.
- "summary": one sentence on what you looked for. "tasteProfile": what this viewer enjoys/avoids based on the profile given.`;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "tasteProfile", "recommendations"],
  properties: {
    summary: { type: "string" },
    tasteProfile: {
      type: "object",
      additionalProperties: false,
      required: ["enjoys", "avoids"],
      properties: {
        enjoys: { type: "array", items: { type: "string" } },
        avoids: { type: "array", items: { type: "string" } },
        currentMood: { type: "string" },
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["externalId", "matchLevel", "whyItFits", "knowBeforeWatching", "spoilerFreeContentGuide"],
        properties: {
          externalId: { type: "string" },
          matchLevel: { type: "string", enum: ["strong", "good", "stretch"] },
          whyItFits: { type: "string" },
          knowBeforeWatching: { type: "string" },
          spoilerFreeContentGuide: {
            type: "object",
            additionalProperties: false,
            required: ["violence", "language", "sexualContent", "frighteningIntensity", "substanceUse", "matureThemes"],
            properties: {
              violence: { type: "string" },
              language: { type: "string" },
              sexualContent: { type: "string" },
              frighteningIntensity: { type: "string" },
              substanceUse: { type: "string" },
              matureThemes: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

export interface AICallOpts {
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  resultCount: number;
}

function buildUserPrompt(
  profile: TasteProfile,
  mode: RecMode,
  candidates: RecCandidate[],
  seedTitles: string[],
  resultCount: number,
): string {
  const lines = candidates.map((c) =>
    JSON.stringify({
      id: c.id,
      title: c.title,
      year: c.releaseYear,
      type: c.mediaType,
      genres: c.genres?.slice(0, 4),
      runtimeMin: c.runtimeMinutes,
      rating: c.officialRating,
      about: c.synopsis?.slice(0, 180),
    }),
  );
  return [
    `MODE: ${MODE_BRIEF[mode]}`,
    `PICK: ${resultCount} titles.`,
    `VIEWER: ${JSON.stringify({
      lovedOrLiked: seedTitles.slice(0, 8),
      likedGenres: profile.likedGenres,
      dislikedGenres: profile.dislikedGenres,
      prefers: profile.mediaTypePreference,
      moodTones: profile.tones,
      contentComfort: profile.contentComfort,
      runtimeBudgetMinutes: profile.runtimeMaxMinutes,
    })}`,
    `CANDIDATES:`,
    ...lines,
  ].join("\n");
}

/**
 * Rerank + explain. Returns a validated response or null (caller falls back
 * to deterministic output). Never throws.
 */
export async function aiRerank(
  profile: TasteProfile,
  mode: RecMode,
  candidates: RecCandidate[],
  seedTitles: string[],
  opts: AICallOpts,
): Promise<AIRecommendationResponse | null> {
  const prompt = buildUserPrompt(profile, mode, candidates, seedTitles, opts.resultCount);
  if (prompt.length > 20_000) return null; // hard prompt-size ceiling

  const client = new Anthropic({ timeout: opts.timeoutMs, maxRetries: 1 });
  const allowedIds = new Set(candidates.map((c) => c.id));

  try {
    const response = await client.messages.create({
      model: opts.model,
      max_tokens: opts.maxOutputTokens,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    return validateAIResponse(JSON.parse(text), allowedIds);
  } catch {
    return null;
  }
}
