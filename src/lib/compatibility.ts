import { CATEGORY_LABELS } from "./filter/types";
import {
  isReviewed,
  LEVEL_LABELS,
  LEVEL_ORDER,
  type ContentGuidance,
} from "./guidance";
import type { ViewingProfile } from "./profiles";

export type CompatibilityVerdict =
  | "good-match"
  | "review-first"
  | "outside-profile"
  | "not-enough-info";

export interface CompatibilityResult {
  verdict: CompatibilityVerdict;
  headline: string;
  reasons: string[]; // human-readable, never a bare number
  exceeded: { category: string; titleLevel: string; profileLevel: string }[];
  unreviewedCategories: string[];
}

export const VERDICT_LABELS: Record<CompatibilityVerdict, string> = {
  "good-match": "Good match",
  "review-first": "Review first",
  "outside-profile": "Outside this profile’s settings",
  "not-enough-info": "Not enough information",
};

export function evaluateCompatibility(
  guidance: ContentGuidance,
  profile: ViewingProfile,
): CompatibilityResult {
  const exceeded: CompatibilityResult["exceeded"] = [];
  const unreviewed: string[] = [];
  let anyReviewed = false;

  for (const gc of guidance.categories) {
    const threshold = profile.thresholds[gc.category];
    if (threshold === undefined) continue; // profile doesn't gate this category
    if (!isReviewed(gc.level)) {
      unreviewed.push(CATEGORY_LABELS[gc.category]);
      continue;
    }
    anyReviewed = true;
    if (LEVEL_ORDER[gc.level] > LEVEL_ORDER[threshold]) {
      exceeded.push({
        category: CATEGORY_LABELS[gc.category],
        titleLevel: LEVEL_LABELS[gc.level],
        profileLevel: LEVEL_LABELS[threshold],
      });
    }
  }

  const reasons: string[] = [];

  if (exceeded.length > 0) {
    for (const e of exceeded) {
      reasons.push(`${e.titleLevel} ${e.category.toLowerCase()} exceeds the ${profile.name} profile’s ${e.profileLevel} setting.`);
    }
    if (unreviewed.length > 0) {
      reasons.push(`Some categories are not yet reviewed: ${unreviewed.join(", ")}.`);
    }
    const verdict: CompatibilityVerdict = exceeded.length >= 2 ? "outside-profile" : "review-first";
    return {
      verdict,
      headline: VERDICT_LABELS[verdict],
      reasons,
      exceeded,
      unreviewedCategories: unreviewed,
    };
  }

  if (!anyReviewed) {
    reasons.push("This title hasn’t been reviewed against your profile’s categories yet.");
    return {
      verdict: "not-enough-info",
      headline: VERDICT_LABELS["not-enough-info"],
      reasons,
      exceeded,
      unreviewedCategories: unreviewed,
    };
  }

  if (unreviewed.length > 0) {
    reasons.push(`Within your ${profile.name} settings so far, but not every category is reviewed: ${unreviewed.join(", ")}.`);
    return {
      verdict: "review-first",
      headline: VERDICT_LABELS["review-first"],
      reasons,
      exceeded,
      unreviewedCategories: unreviewed,
    };
  }

  reasons.push(`Everything reviewed is within the ${profile.name} profile’s settings.`);
  return {
    verdict: "good-match",
    headline: VERDICT_LABELS["good-match"],
    reasons,
    exceeded,
    unreviewedCategories: unreviewed,
  };
}
