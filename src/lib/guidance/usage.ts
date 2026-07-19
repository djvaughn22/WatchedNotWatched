// Server-side generation counters for the beta cost controls (SERVER ONLY).
//
// HONEST LIMITATION: this app has no database (deliberately — one is not
// being added just to meter a beta), so counters live in the memory of each
// server instance and reset on cold starts and across instances. That makes
// them an approximate guardrail: they reliably stop runaway loops and hard
// overuse of a warm instance, but they are not billing-grade metering. The
// true hard stops are the Anthropic dashboard's own spend limits and the
// WNW_GUIDANCE_KILL_SWITCH.

export type UsageGate = { ok: true } | { ok: false; reason: "daily_limit" | "monthly_budget" };

export interface UsageTracker {
  /** May a new generation start right now? Fails closed on zero limits. */
  canGenerate(): UsageGate;
  /** Count an attempt — called BEFORE the AI request so failures still count. */
  record(): void;
  /** For logging/diagnostics only. Never sent to the browser. */
  snapshot(): { day: string; dayCount: number; month: string; monthCount: number; estSpendUsd: number };
}

export function createUsageTracker(
  cfg: { dailyLimit: number; monthlyBudgetUsd: number; costPerGenerationUsd: number },
  clock: () => Date = () => new Date(),
): UsageTracker {
  let day = "";
  let dayCount = 0;
  let month = "";
  let monthCount = 0;

  function roll() {
    const now = clock().toISOString();
    const today = now.slice(0, 10);
    const thisMonth = now.slice(0, 7);
    if (today !== day) {
      day = today;
      dayCount = 0;
    }
    if (thisMonth !== month) {
      month = thisMonth;
      monthCount = 0;
    }
  }

  return {
    canGenerate() {
      roll();
      if (cfg.dailyLimit <= 0 || dayCount >= cfg.dailyLimit) return { ok: false, reason: "daily_limit" };
      const estSpend = monthCount * cfg.costPerGenerationUsd;
      if (cfg.monthlyBudgetUsd <= 0 || estSpend + cfg.costPerGenerationUsd > cfg.monthlyBudgetUsd) {
        return { ok: false, reason: "monthly_budget" };
      }
      return { ok: true };
    },
    record() {
      roll();
      dayCount += 1;
      monthCount += 1;
    },
    snapshot() {
      roll();
      return { day, dayCount, month, monthCount, estSpendUsd: monthCount * cfg.costPerGenerationUsd };
    },
  };
}
