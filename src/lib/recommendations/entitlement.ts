// Whether THIS request may spend money on the AI layer. Same plan model as
// the rest of the app: there are no accounts, so every visitor resolves to
// the same plan chosen by server configuration. When accounts/billing ship,
// resolveRecPlan() becomes a per-user lookup and nothing else changes —
// callers only ever ask "may this plan use AI recommendations?".
//
// Order of gates (each fails closed, provider never called when blocked):
//   1. AI master switch + API key present
//   2. Entitlement (test mode = temporary testing plan; enforced = paid only)
// Rate limits and caching are separate layers on top (rateLimit.ts, cache.ts).

import type { RecConfig } from "./config";

export type RecPlan = "free" | "rec_testing" | "rec_paid";

export function resolveRecPlan(config: RecConfig): RecPlan {
  // TEMPORARY: test mode grants everyone the testing plan. There is no
  // billing yet, so nothing ever resolves to rec_paid — that arrives with
  // accounts, and only this function has to learn about it.
  if (config.testMode) return "rec_testing";
  return "free";
}

const AI_PLANS: ReadonlySet<RecPlan> = new Set(["rec_testing", "rec_paid"]);

export type AIAccess =
  | { allowed: true }
  | { allowed: false; reason: "disabled" | "entitlement_required" };

/** Server-side decision: may the AI layer run for this request? */
export function decideAIAccess(config: RecConfig): AIAccess {
  if (!config.aiEnabled || !config.hasApiKey) return { allowed: false, reason: "disabled" };
  const plan = resolveRecPlan(config);
  if (config.requireEntitlement && !AI_PLANS.has(plan)) {
    return { allowed: false, reason: "entitlement_required" };
  }
  // Entitlement not enforced (private testing): still require a real plan
  // grant — with test mode off and enforcement off, AI stays off rather
  // than silently free-for-all.
  if (!config.requireEntitlement && !AI_PLANS.has(plan)) {
    return { allowed: false, reason: "entitlement_required" };
  }
  return { allowed: true };
}
