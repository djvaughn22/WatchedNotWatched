// Viewing preferences — local-first, this device only. Pure functions over a
// plain object (same pattern as library.ts); localStorage wiring lives in
// usePrefs.ts. Designed so the storage layer can later be replaced or
// supplemented by account-based cloud sync without touching this model:
// everything round-trips through sanitizePrefs(), so any backend that can
// store JSON can hold a ViewingPrefs.

import { CATEGORY_IDS, OCCASIONS, type CategoryId, type GuidanceLevel, type Occasion } from "./guidance/types";

export const PREFS_KEY = "wnw.prefs.v1";

// How much a category bothers this household. Maps to the highest guidance
// level that's still comfortable.
export const SENSITIVITIES = ["not_sensitive", "somewhat", "very"] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

export const SENSITIVITY_LABELS: Record<Sensitivity, string> = {
  not_sensitive: "Fine with it",
  somewhat: "Keep it moderate",
  very: "Keep it mild",
};

/** Highest acceptable guidance level for a sensitivity setting. */
export const SENSITIVITY_MAX_LEVEL: Record<Sensitivity, Exclude<GuidanceLevel, "unknown">> = {
  not_sensitive: "high",
  somewhat: "moderate",
  very: "mild",
};

export const TONE_PREFS = ["either", "light", "dark"] as const;
export type TonePref = (typeof TONE_PREFS)[number];

export const CHALLENGE_PREFS = ["either", "easy", "challenging"] as const;
export type ChallengePref = (typeof CHALLENGE_PREFS)[number];

export interface ViewingPrefs {
  version: 1;
  preferredGenres: string[]; // genre labels as shown on titles, e.g. "Mystery"
  avoidGenres: string[];
  tone: TonePref;
  challenge: ChallengePref;
  sensitivities: Partial<Record<CategoryId, Sensitivity>>; // unset = not sensitive
  kidsWatching: boolean; // children under ~13
  teensWatching: boolean;
  viewerAges: number[]; // optional ages of viewers
  occasion: Occasion | "any"; // typical viewing mood/occasion
}

export function emptyPrefs(): ViewingPrefs {
  return {
    version: 1,
    preferredGenres: [],
    avoidGenres: [],
    tone: "either",
    challenge: "either",
    sensitivities: {},
    kidsWatching: false,
    teensWatching: false,
    viewerAges: [],
    occasion: "any",
  };
}

/** True when the viewer has set anything at all — the card works without. */
export function hasAnyPrefs(p: ViewingPrefs): boolean {
  return (
    p.preferredGenres.length > 0 ||
    p.avoidGenres.length > 0 ||
    p.tone !== "either" ||
    p.challenge !== "either" ||
    Object.keys(p.sensitivities).length > 0 ||
    p.kidsWatching ||
    p.teensWatching ||
    p.viewerAges.length > 0 ||
    p.occasion !== "any"
  );
}

function stringArray(v: unknown, max = 30): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 40))].slice(0, max);
}

/** Keep only well-formed values from untrusted storage data. */
export function sanitizePrefs(raw: unknown): ViewingPrefs {
  const base = emptyPrefs();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  base.preferredGenres = stringArray(o.preferredGenres);
  base.avoidGenres = stringArray(o.avoidGenres);
  if (typeof o.tone === "string" && (TONE_PREFS as readonly string[]).includes(o.tone)) base.tone = o.tone as TonePref;
  if (typeof o.challenge === "string" && (CHALLENGE_PREFS as readonly string[]).includes(o.challenge)) {
    base.challenge = o.challenge as ChallengePref;
  }
  if (o.sensitivities && typeof o.sensitivities === "object") {
    for (const id of CATEGORY_IDS) {
      const v = (o.sensitivities as Record<string, unknown>)[id];
      if (typeof v === "string" && (SENSITIVITIES as readonly string[]).includes(v)) {
        base.sensitivities[id] = v as Sensitivity;
      }
    }
  }
  base.kidsWatching = o.kidsWatching === true;
  base.teensWatching = o.teensWatching === true;
  if (Array.isArray(o.viewerAges)) {
    base.viewerAges = o.viewerAges
      .filter((a): a is number => typeof a === "number" && Number.isFinite(a) && a >= 0 && a <= 120)
      .map((a) => Math.round(a))
      .slice(0, 12);
  }
  if (typeof o.occasion === "string" && (o.occasion === "any" || (OCCASIONS as readonly string[]).includes(o.occasion))) {
    base.occasion = o.occasion as ViewingPrefs["occasion"];
  }
  return base;
}

/** Youngest viewer bucket, combining explicit ages with the simple toggles. */
export function youngestBucket(p: ViewingPrefs): "child" | "teen" | "adult" {
  const youngest = p.viewerAges.length ? Math.min(...p.viewerAges) : undefined;
  if ((youngest !== undefined && youngest < 13) || p.kidsWatching) return "child";
  if ((youngest !== undefined && youngest < 18) || p.teensWatching) return "teen";
  return "adult";
}
