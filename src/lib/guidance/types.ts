// "Do I Want to Watch This?" — shared types + validation for the decision
// card. The AI returns ONE generic, spoiler-free guidance object per title
// (server-generated, cached). Personalization happens on-device from this
// structured data plus local preferences — see personalize.ts.

export const CATEGORY_IDS = [
  "violence",
  "language",
  "sexual_content",
  "scary_intense",
  "substances",
  "mature_themes",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  violence: "Violence",
  language: "Language",
  sexual_content: "Sexual Content",
  scary_intense: "Scary or Intense",
  substances: "Drugs & Alcohol",
  mature_themes: "Mature Themes",
};

// "unknown" = the model wasn't confident. The UI shows
// "Not enough reliable information." — uncertainty is never hidden.
export const LEVELS = ["none", "mild", "moderate", "strong", "high", "unknown"] as const;
export type GuidanceLevel = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<GuidanceLevel, string> = {
  none: "None",
  mild: "Mild",
  moderate: "Moderate",
  strong: "Strong",
  high: "High",
  unknown: "Unknown",
};

/** Numeric rank for comparisons; unknown deliberately has no rank. */
export const LEVEL_RANK: Record<Exclude<GuidanceLevel, "unknown">, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  strong: 3,
  high: 4,
};

export const OCCASIONS = [
  "relaxed_night",
  "family_night",
  "date_night",
  "background",
  "focused_night",
] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OCCASION_LABELS: Record<Occasion, string> = {
  relaxed_night: "Relaxed night",
  family_night: "Family night",
  date_night: "Date night",
  background: "Background viewing",
  focused_night: "Focused movie night",
};

export const ATTENTIONS = ["background", "casual", "full"] as const;
export type Attention = (typeof ATTENTIONS)[number];

export const TONES = ["light", "mixed", "dark"] as const;
export type ToneValue = (typeof TONES)[number];

export const PACINGS = ["slow", "steady", "fast"] as const;
export type Pacing = (typeof PACINGS)[number];

export interface CategoryGuidance {
  id: CategoryId;
  level: GuidanceLevel;
  /** One brief spoiler-free description. Empty when level is "unknown". */
  note: string;
}

export interface TitleGuidance {
  quickTake: string; // 1–3 sentences: who it's for, when to skip it
  categories: CategoryGuidance[]; // always all 6, in CATEGORY_IDS order
  bestFit: string; // practical viewer/family recommendation
  deepDive: string; // one spoiler-free paragraph on the viewing experience
  attention: Attention;
  tone: ToneValue;
  pacing: Pacing;
  occasions: Occasion[]; // which nights this fits
}

/** What the server sends the model. Metadata only — never user data. */
export interface GuidanceRequest {
  title: string;
  releaseYear?: number;
  mediaType: "movie" | "series";
  genres?: string[];
  officialRating?: string;
  synopsis?: string;
}

const MAX = { quickTake: 600, note: 240, bestFit: 300, deepDive: 1500 };

function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  return s;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

export const UNKNOWN_NOTE = "Not enough reliable information.";

/**
 * Validate untrusted model output into a TitleGuidance, or null if it's
 * unusable. Missing/invalid categories degrade to "unknown" rather than
 * failing the whole card; missing required prose fails the card.
 */
export function parseGuidance(raw: unknown): TitleGuidance | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const quickTake = cleanString(o.quickTake, MAX.quickTake);
  const bestFit = cleanString(o.bestFit, MAX.bestFit);
  const deepDive = cleanString(o.deepDive, MAX.deepDive);
  const attention = oneOf(o.attention, ATTENTIONS);
  const tone = oneOf(o.tone, TONES);
  const pacing = oneOf(o.pacing, PACINGS);
  if (!quickTake || !bestFit || !deepDive || !attention || !tone || !pacing) return null;

  const rawCats = Array.isArray(o.categories) ? o.categories : [];
  const byId = new Map<string, { level: GuidanceLevel; note: string }>();
  for (const c of rawCats) {
    if (!c || typeof c !== "object") continue;
    const cc = c as Record<string, unknown>;
    const id = oneOf(cc.id, CATEGORY_IDS);
    const level = oneOf(cc.level, LEVELS);
    if (!id || !level) continue;
    const note = level === "unknown" ? "" : (cleanString(cc.note, MAX.note) ?? "");
    // A leveled category with no usable note is still shown — the level alone helps.
    byId.set(id, { level, note });
  }

  const categories: CategoryGuidance[] = CATEGORY_IDS.map((id) => {
    const found = byId.get(id);
    return found ? { id, ...found } : { id, level: "unknown", note: "" };
  });

  const occasions = (Array.isArray(o.occasions) ? o.occasions : [])
    .map((v) => oneOf(v, OCCASIONS))
    .filter((v): v is Occasion => v !== null);

  return {
    quickTake,
    categories,
    bestFit,
    deepDive,
    attention,
    tone,
    pacing,
    occasions: [...new Set(occasions)],
  };
}

/** API response envelope for /api/guidance. */
export type GuidanceStatus =
  | "ok"
  | "unconfigured" // no AI provider key on the server
  | "rate_limited"
  | "no_metadata" // couldn't load enough title metadata
  | "error" // provider/network/malformed-response failure
  | "disabled" // owner kill switch — AI generation stopped
  | "entitlement_required" // plan doesn't include guidance (beta ended)
  | "limit_reached"; // server-side beta cost controls tripped

export interface GuidanceResponse {
  status: GuidanceStatus;
  guidance?: TitleGuidance;
}
