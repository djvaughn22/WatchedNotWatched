// Content guidance: what a title CONTAINS (distinct from playback filters).
import type { FilterCategory } from "./filter/types";

export type GuidanceLevel =
  | "none-noted"
  | "mild"
  | "moderate"
  | "strong"
  | "severe"
  | "not-reviewed";

export type GuidanceSource =
  | "editorial"
  | "official-rating"
  | "owner-authored"
  | "sample"
  | "unknown";

export interface GuidanceCategory {
  category: FilterCategory;
  level: GuidanceLevel;
  summary?: string;
  source: GuidanceSource;
  reviewedAt?: string;
}

export interface ContentGuidance {
  categories: GuidanceCategory[];
  overallNote?: string;
}

// Numeric ordering for the reviewed levels. not-reviewed is intentionally
// absent — unknown must never compare as "safe".
export const LEVEL_ORDER: Record<Exclude<GuidanceLevel, "not-reviewed">, number> = {
  "none-noted": 0,
  mild: 1,
  moderate: 2,
  strong: 3,
  severe: 4,
};

export const LEVEL_LABELS: Record<GuidanceLevel, string> = {
  "none-noted": "None noted",
  mild: "Mild",
  moderate: "Moderate",
  strong: "Strong",
  severe: "Severe",
  "not-reviewed": "Not yet reviewed",
};

export function isReviewed(level: GuidanceLevel): level is Exclude<GuidanceLevel, "not-reviewed"> {
  return level !== "not-reviewed";
}

// Build a "not yet reviewed" guidance block. Missing information must never be
// shown as "none noted".
export function notReviewedGuidance(categories: FilterCategory[]): ContentGuidance {
  return {
    categories: categories.map((category) => ({
      category,
      level: "not-reviewed",
      source: "unknown",
    })),
    overallNote: "This title has not been reviewed in detail yet.",
  };
}
