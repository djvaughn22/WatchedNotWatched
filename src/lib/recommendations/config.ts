// Server-side configuration for the For You AI layer. ALL env reads for the
// feature live here, and every parse fails closed: garbage or missing values
// resolve to the safest setting (AI off, entitlement required, small limits).
// Nothing the client sends can influence any of these values.

export interface RecConfig {
  /** Master switch for the AI layer. Off = deterministic-only, zero AI cost. */
  aiEnabled: boolean;
  /** TEMPORARY private-testing override: everyone may use AI (still rate limited). */
  testMode: boolean;
  /** When true, AI runs only for entitled (paid) users. No billing exists yet, so nobody is entitled. */
  requireEntitlement: boolean;
  /** Per-device AI generations per day. */
  dailyLimit: number;
  /** Cards returned per generation. */
  resultCount: number;
  /** Candidates sent to the AI (prompt-size cap). */
  maxCandidates: number;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  hasApiKey: boolean;
}

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

function int(v: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

export function loadRecConfig(env: NodeJS.ProcessEnv = process.env): RecConfig {
  return {
    aiEnabled: bool(env.AI_RECOMMENDATIONS_ENABLED, false),
    testMode: bool(env.AI_RECOMMENDATIONS_TEST_MODE, false),
    requireEntitlement: bool(env.AI_RECOMMENDATIONS_REQUIRE_ENTITLEMENT, true),
    dailyLimit: int(env.AI_RECOMMENDATIONS_DAILY_LIMIT, 5, 1, 200),
    resultCount: int(env.AI_RECOMMENDATIONS_RESULT_COUNT, 5, 1, 10),
    maxCandidates: int(env.AI_RECOMMENDATIONS_MAX_CANDIDATES, 12, 5, 20),
    model: env.OPENAI_RECOMMENDATIONS_MODEL || "gpt-5.4-nano",
    maxOutputTokens: int(env.AI_RECOMMENDATIONS_MAX_TOKENS, 4000, 500, 8000),
    timeoutMs: int(env.AI_RECOMMENDATIONS_TIMEOUT_MS, 25000, 1000, 60000),
    hasApiKey: !!env.OPENAI_API_KEY,
  };
}
