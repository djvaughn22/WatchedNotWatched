// Entitlements — the business model, in one place.
//
//   free       — local-first tracking, no account required. Stays free.
//   guide_beta — TEMPORARY: "Do I Want to Watch This?" free while the
//                feature is being tested. Not a permanent free feature.
//   guide_paid — future: unlimited personalized decision cards (no billing
//                exists yet; nothing is faked).
//   cloud_paid — future: Guide plus accounts, cross-device sync, backup,
//                family profiles, shared lists, deeper personalization.
//
// There are no accounts and no database, so every visitor currently resolves
// to the SAME plan, chosen by server configuration (the one centralized
// temporary beta switch). When accounts ship, resolvePlan() becomes a
// per-user lookup and nothing else has to change — routes and services
// already ask "does this plan include guidance?" instead of scattering beta
// checks around.

export type Plan = "free" | "guide_beta" | "guide_paid" | "cloud_paid";

/**
 * TEMPORARY centralized beta resolution (server-side). `betaEnabled` comes
 * from server config (WNW_GUIDANCE_BETA_ENABLED) — never from anything the
 * client sends. When the beta ends, visitors resolve to "free" and guidance
 * requests get a typed entitlement response without any AI call.
 */
export function resolvePlan(opts: { betaEnabled: boolean }): Plan {
  return opts.betaEnabled ? "guide_beta" : "free";
}

const GUIDANCE_PLANS: ReadonlySet<Plan> = new Set(["guide_beta", "guide_paid", "cloud_paid"]);

/** Does this plan include "Do I Want to Watch This?" generation? */
export function planIncludesGuidance(plan: Plan): boolean {
  return GUIDANCE_PLANS.has(plan);
}
