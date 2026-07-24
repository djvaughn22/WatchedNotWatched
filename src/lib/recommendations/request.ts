// Sanitizes the untrusted POST body into a bounded RecRequest. Every list is
// capped so the request (and anything derived from it, including the AI
// prompt) has a hard size ceiling no client can exceed.

import { REC_MODES, type RecMode, type RecRequest, type RecSeed, type TasteProfile } from "./types";

const MAX_SEEDS = 8;
const MAX_EXCLUDES = 400;
const MAX_GENRES = 8;
const MAX_TONES = 4;
const MAX_TEXT = 80;

const str = (v: unknown): string => (typeof v === "string" ? v.slice(0, MAX_TEXT) : "");

function strList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, max).map((s) => s.slice(0, MAX_TEXT));
}

export function sanitizeRecRequest(raw: unknown): RecRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const mode = REC_MODES.includes(r.mode as RecMode) ? (r.mode as RecMode) : "best_match";
  const deviceId = str(r.deviceId);
  if (!deviceId) return null;

  const seeds: RecSeed[] = Array.isArray(r.seeds)
    ? (r.seeds as unknown[])
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
        .map((s) => ({
          sourceId: str(s.sourceId),
          mediaType: s.mediaType === "series" ? "series" : "movie",
          title: str(s.title),
          weight: s.weight === 3 ? 3 : 2,
        }))
        .filter((s) => /^\d+$/.test(s.sourceId) && s.title)
        .slice(0, MAX_SEEDS)
    : [];

  const p = (r.profile && typeof r.profile === "object" ? r.profile : {}) as Record<string, unknown>;
  const runtimeRaw = Number(p.runtimeMaxMinutes);
  const profile: TasteProfile = {
    likedGenres: strList(p.likedGenres, MAX_GENRES),
    dislikedGenres: strList(p.dislikedGenres, MAX_GENRES),
    mediaTypePreference:
      p.mediaTypePreference === "movie" || p.mediaTypePreference === "series" ? p.mediaTypePreference : "either",
    tones: strList(p.tones, MAX_TONES),
    contentComfort: p.contentComfort === "family" || p.contentComfort === "open" ? p.contentComfort : "standard",
    runtimeMaxMinutes:
      Number.isFinite(runtimeRaw) && runtimeRaw >= 15 && runtimeRaw <= 600 ? Math.round(runtimeRaw) : undefined,
  };

  return { mode, deviceId, seeds, profile, excludeIds: strList(r.excludeIds, MAX_EXCLUDES) };
}
