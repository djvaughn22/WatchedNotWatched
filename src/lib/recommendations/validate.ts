// Strict server-side validation of the AI response. The contract that makes
// hallucination impossible: the AI may only reference candidates by the ids
// WE sent it. Anything else — unknown ids, duplicates, missing fields, wrong
// types — is dropped; a malformed envelope rejects the whole response and the
// caller falls back to deterministic explanations.

import type { AIRecommendationResponse, MatchLevel, SpoilerFreeContentGuide } from "./types";

const MATCH_LEVELS = new Set<MatchLevel>(["strong", "good", "stretch"]);
const MAX_TEXT = 400;
const GUIDE_FIELDS = [
  "violence",
  "language",
  "sexualContent",
  "frighteningIntensity",
  "substanceUse",
  "matureThemes",
] as const;

// Spoiler guard: explanation text must not reveal endings/twists. We can't
// judge meaning server-side, but we can reject the obvious tells.
const SPOILER_WORDS = /\b(ending|final scene|turns out to be|plot twist(?: is)?|dies at the end|killer is)\b/i;

function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, MAX_TEXT);
  if (!t) return null;
  if (SPOILER_WORDS.test(t)) return null;
  return t;
}

function cleanGuide(v: unknown): SpoilerFreeContentGuide | null {
  if (!v || typeof v !== "object") return null;
  const g = v as Record<string, unknown>;
  const out = {} as Record<(typeof GUIDE_FIELDS)[number], string>;
  for (const f of GUIDE_FIELDS) {
    const t = cleanText(g[f]);
    if (t === null) return null;
    out[f] = t;
  }
  return out;
}

/**
 * Returns a cleaned response, or null when the envelope is unusable.
 * `allowedIds` is the candidate set the AI was given — the only ids it may
 * return. Individual bad recommendations are dropped, not fatal.
 */
export function validateAIResponse(raw: unknown, allowedIds: Set<string>): AIRecommendationResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const summary = cleanText(r.summary);
  if (summary === null) return null;

  const tpRaw = (r.tasteProfile && typeof r.tasteProfile === "object" ? r.tasteProfile : {}) as Record<string, unknown>;
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 6).map((s) => s.slice(0, 60)) : [];
  const mood = cleanText(tpRaw.currentMood);

  if (!Array.isArray(r.recommendations)) return null;

  const seen = new Set<string>();
  const recommendations: AIRecommendationResponse["recommendations"] = [];
  for (const item of r.recommendations as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const i = item as Record<string, unknown>;
    const externalId = typeof i.externalId === "string" ? i.externalId : "";
    if (!allowedIds.has(externalId) || seen.has(externalId)) continue; // invented or duplicate title → rejected
    const matchLevel = MATCH_LEVELS.has(i.matchLevel as MatchLevel) ? (i.matchLevel as MatchLevel) : null;
    const whyItFits = cleanText(i.whyItFits);
    const knowBeforeWatching = cleanText(i.knowBeforeWatching);
    const guide = cleanGuide(i.spoilerFreeContentGuide);
    if (!matchLevel || !whyItFits || !knowBeforeWatching || !guide) continue;
    seen.add(externalId);
    recommendations.push({ externalId, matchLevel, whyItFits, knowBeforeWatching, spoilerFreeContentGuide: guide });
  }

  if (recommendations.length === 0) return null;

  return {
    summary,
    tasteProfile: { enjoys: strList(tpRaw.enjoys), avoids: strList(tpRaw.avoids), currentMood: mood ?? undefined },
    recommendations,
  };
}
