// On-device personalization: combine the (generic, cached) AI guidance with
// the viewer's local preferences to produce a direct conclusion. Runs in the
// browser — preferences never leave this device and no extra AI call is made.
// Deliberately hedged language ("Likely", "Probably") — never a safety
// guarantee.

import {
  CATEGORY_LABELS,
  LEVEL_RANK,
  OCCASION_LABELS,
  type CategoryGuidance,
  type TitleGuidance,
} from "./types";
import { SENSITIVITY_MAX_LEVEL, youngestBucket, hasAnyPrefs, type ViewingPrefs } from "../prefs";

export type VerdictKind = "yes" | "mixed" | "no" | "kids_no";

export interface PersonalVerdict {
  kind: VerdictKind;
  headline: string;
  points: string[]; // short supporting reasons, most important first
}

interface ContentCheck {
  overLimit: CategoryGuidance[]; // categories above the viewer's comfort level
  unknownWhileStrict: CategoryGuidance[]; // unknowns while the viewer has limits set
}

function checkContent(g: TitleGuidance, prefs: ViewingPrefs): ContentCheck {
  const bucket = youngestBucket(prefs);
  const overLimit: CategoryGuidance[] = [];
  const unknownWhileStrict: CategoryGuidance[] = [];

  for (const cat of g.categories) {
    // Effective limit = the stricter of the viewer's own sensitivity and the
    // youngest-viewer cap (kids: mild; teens: moderate, strong for language).
    const own = prefs.sensitivities[cat.id];
    let limit = own ? LEVEL_RANK[SENSITIVITY_MAX_LEVEL[own]] : LEVEL_RANK.high;
    if (bucket === "child") limit = Math.min(limit, LEVEL_RANK.mild);
    else if (bucket === "teen") {
      limit = Math.min(limit, cat.id === "language" ? LEVEL_RANK.strong : LEVEL_RANK.moderate);
    }
    const hasLimit = limit < LEVEL_RANK.high;

    if (cat.level === "unknown") {
      if (hasLimit) unknownWhileStrict.push(cat);
      continue;
    }
    if (LEVEL_RANK[cat.level] > limit) overLimit.push(cat);
  }
  return { overLimit, unknownWhileStrict };
}

const label = (c: CategoryGuidance) => CATEGORY_LABELS[c.id].toLowerCase();

/**
 * Produce a personal conclusion, or null when no preferences are set (the
 * card then shows only the generic guidance).
 */
export function personalize(
  g: TitleGuidance,
  prefs: ViewingPrefs,
  title: { genres?: string[] },
): PersonalVerdict | null {
  if (!hasAnyPrefs(prefs)) return null;

  const points: string[] = [];
  const bucket = youngestBucket(prefs);
  const { overLimit, unknownWhileStrict } = checkContent(g, prefs);

  // Genre taste
  const genres = (title.genres ?? []).map((x) => x.toLowerCase());
  const liked = prefs.preferredGenres.filter((x) => genres.includes(x.toLowerCase()));
  const avoided = prefs.avoidGenres.filter((x) => genres.includes(x.toLowerCase()));

  // Tone + challenge fit
  const toneClash = prefs.tone !== "either" && g.tone !== "mixed" && g.tone !== prefs.tone;
  const wantsEasy = prefs.challenge === "easy";
  const challengeClash = wantsEasy && g.attention === "full";

  // Occasion fit
  const occasionSet = prefs.occasion !== "any";
  const occasionMatch = occasionSet && g.occasions.includes(prefs.occasion as (typeof g.occasions)[number]);
  const occasionClash = occasionSet && g.occasions.length > 0 && !occasionMatch;

  // ---- Compose the verdict, worst news first -----------------------------

  if (bucket !== "adult" && overLimit.length > 0) {
    points.push(
      overLimit.length > 3
        ? `Most content categories run above the level you set for younger viewers.`
        : `${overLimit.map(label).join(", ")} run${overLimit.length === 1 ? "s" : ""} above the level you set for younger viewers.`,
    );
    if (liked.length) points.push(`It does match genres you enjoy (${liked.join(", ")}) — could work for an adults-only night.`);
    return {
      kind: "kids_no",
      headline: `Likely fine for the adults, but not a good match for the younger viewer settings you selected.`,
      points,
    };
  }

  if (overLimit.length > 0) {
    for (const c of overLimit) points.push(`${CATEGORY_LABELS[c.id]} is rated ${c.level} — above the limit you set.`);
    return { kind: "no", headline: "Probably not — this goes past the content limits you set.", points };
  }

  if (avoided.length > 0) {
    points.push(`It's ${avoided.join(" and ")} — genres you usually avoid.`);
    return { kind: "no", headline: "Probably not tonight.", points };
  }

  // Content fits; now check mood/effort clashes.
  const clashes: string[] = [];
  if (toneClash) clashes.push(`its ${g.tone} tone may not fit the ${prefs.tone} mood you prefer`);
  if (challengeClash) clashes.push("it wants your full attention, and you asked for easy viewing");
  if (occasionClash && prefs.occasion !== "any") {
    clashes.push(`its ${g.pacing} pace may not fit a ${OCCASION_LABELS[prefs.occasion].toLowerCase()}`);
  }

  if (unknownWhileStrict.length > 0) {
    points.push(`Heads up: not enough reliable information on ${unknownWhileStrict.map(label).join(", ")} to check it against your limits.`);
  }

  if (clashes.length > 0) {
    for (const c of clashes) points.push(c[0].toUpperCase() + c.slice(1) + ".");
    if (liked.length) points.push(`Genre-wise it's a match (${liked.join(", ")}).`);
    return {
      kind: "mixed",
      headline: "The content fits your limits, but it may not fit the mood you selected.",
      points,
    };
  }

  if (liked.length > 0) {
    points.push(`Matches genres you enjoy: ${liked.join(", ")}.`);
    if (occasionMatch && prefs.occasion !== "any") points.push(`Fits a ${OCCASION_LABELS[prefs.occasion].toLowerCase()}.`);
    return { kind: "yes", headline: "Yes, this fits what you usually enjoy.", points };
  }

  if (points.length === 0) points.push("Nothing here conflicts with the preferences you set.");
  return { kind: "yes", headline: "Likely a fine pick for you.", points };
}
