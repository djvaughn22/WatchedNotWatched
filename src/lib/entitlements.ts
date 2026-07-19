// Entitlement seam for future plans (Free / Guide / Cloud). Everything is
// free today — no billing exists and none is faked. Decision-card limits, if
// they ever arrive, get enforced here and ONLY here.

export type Plan = "free" | "guide" | "cloud";

export function currentPlan(): Plan {
  return "free";
}

/** Gate for "Do I Want to Watch This?" generations. Always allowed for now. */
export function canUseDecisionCard(): { allowed: true } | { allowed: false; reason: string } {
  return { allowed: true };
}
