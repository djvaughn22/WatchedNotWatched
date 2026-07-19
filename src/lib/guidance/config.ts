// Server configuration for the decision card (SERVER ONLY). This module is
// the only place that reads the WNW_GUIDANCE_* environment variables — every
// other file works from the parsed GuidanceConfig, so access policy stays
// centralized and none of this ever reaches the browser.
//
// Env (all optional, safe defaults):
//   WNW_GUIDANCE_BETA_ENABLED      — "0"/"false"/"off"/"no" ends the free
//                                    beta (visitors resolve to the free plan;
//                                    typed entitlement response, no AI call).
//                                    Unset = beta on (the current phase).
//   WNW_GUIDANCE_KILL_SWITCH       — owner emergency stop. ANY value except
//                                    "0"/"false"/"off"/"no"/"" disables all
//                                    AI generation immediately, regardless of
//                                    plan, with no UI code change.
//   WNW_GUIDANCE_DAILY_LIMIT       — max new generations per day (default
//                                    200; 0 or negative = none, fail closed).
//   WNW_GUIDANCE_MONTHLY_BUDGET_USD— estimated monthly AI spend ceiling
//                                    (default 25; 0 or negative = none).

export interface GuidanceConfig {
  betaEnabled: boolean;
  killSwitch: boolean;
  dailyLimit: number;
  monthlyBudgetUsd: number;
}

export const GUIDANCE_DEFAULTS = {
  dailyLimit: 200,
  monthlyBudgetUsd: 25,
} as const;

/** Conservative per-generation cost estimate used against the budget. */
export const EST_COST_PER_GENERATION_USD = 0.05;

const FALSEY = new Set(["0", "false", "off", "no"]);

function parseFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") return defaultValue;
  return !FALSEY.has(value.trim().toLowerCase());
}

function parseLimit(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === "") return defaultValue;
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultValue; // garbage → safe default
  return n <= 0 ? 0 : n; // explicit 0/negative = fail closed
}

export function readGuidanceConfig(env: Record<string, string | undefined> = process.env): GuidanceConfig {
  return {
    betaEnabled: parseFlag(env.WNW_GUIDANCE_BETA_ENABLED, true),
    killSwitch: parseFlag(env.WNW_GUIDANCE_KILL_SWITCH, false),
    dailyLimit: parseLimit(env.WNW_GUIDANCE_DAILY_LIMIT, GUIDANCE_DEFAULTS.dailyLimit),
    monthlyBudgetUsd: parseLimit(env.WNW_GUIDANCE_MONTHLY_BUDGET_USD, GUIDANCE_DEFAULTS.monthlyBudgetUsd),
  };
}
