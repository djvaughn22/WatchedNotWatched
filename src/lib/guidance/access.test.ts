// Business-model tests: beta access is centralized, the server gates every
// AI call, cost controls fail safely, and nothing client-controlled can
// grant paid access.

import { describe, expect, it, vi } from "vitest";
import { planIncludesGuidance, resolvePlan, type Plan } from "../entitlements";
import { GUIDANCE_DEFAULTS, readGuidanceConfig } from "./config";
import { createUsageTracker } from "./usage";
import { getGuidance, type GuidanceServiceDeps } from "./service";
import type { MediaTitle } from "../media/types";
import {
  DEVICE_DAILY_LIMIT,
  incrementDeviceUsage,
  parseDeviceUsage,
  underDeviceLimit,
} from "../guidanceClient";

describe("guidance config (env safeguards)", () => {
  it("safe defaults when nothing is set", () => {
    const c = readGuidanceConfig({});
    expect(c).toEqual({
      betaEnabled: true,
      killSwitch: false,
      dailyLimit: GUIDANCE_DEFAULTS.dailyLimit,
      monthlyBudgetUsd: GUIDANCE_DEFAULTS.monthlyBudgetUsd,
    });
  });

  it("beta can be ended with the one centralized flag", () => {
    for (const v of ["0", "false", "off", "no", "FALSE"]) {
      expect(readGuidanceConfig({ WNW_GUIDANCE_BETA_ENABLED: v }).betaEnabled).toBe(false);
    }
    expect(readGuidanceConfig({ WNW_GUIDANCE_BETA_ENABLED: "1" }).betaEnabled).toBe(true);
  });

  it("kill switch trips on any affirmative value", () => {
    for (const v of ["1", "true", "on", "yes", "EMERGENCY"]) {
      expect(readGuidanceConfig({ WNW_GUIDANCE_KILL_SWITCH: v }).killSwitch).toBe(true);
    }
    expect(readGuidanceConfig({ WNW_GUIDANCE_KILL_SWITCH: "0" }).killSwitch).toBe(false);
    expect(readGuidanceConfig({}).killSwitch).toBe(false);
  });

  it("garbage limits fall back to defaults; zero/negative fail closed", () => {
    expect(readGuidanceConfig({ WNW_GUIDANCE_DAILY_LIMIT: "lots" }).dailyLimit).toBe(GUIDANCE_DEFAULTS.dailyLimit);
    expect(readGuidanceConfig({ WNW_GUIDANCE_DAILY_LIMIT: "0" }).dailyLimit).toBe(0);
    expect(readGuidanceConfig({ WNW_GUIDANCE_DAILY_LIMIT: "-5" }).dailyLimit).toBe(0);
    expect(readGuidanceConfig({ WNW_GUIDANCE_MONTHLY_BUDGET_USD: "??" }).monthlyBudgetUsd).toBe(
      GUIDANCE_DEFAULTS.monthlyBudgetUsd,
    );
    expect(readGuidanceConfig({ WNW_GUIDANCE_MONTHLY_BUDGET_USD: "0" }).monthlyBudgetUsd).toBe(0);
  });
});

describe("entitlement resolution (centralized)", () => {
  it("beta on → guide_beta; beta off → free", () => {
    expect(resolvePlan({ betaEnabled: true })).toBe("guide_beta");
    expect(resolvePlan({ betaEnabled: false })).toBe("free");
  });

  it("guidance is included in beta and paid plans, never in free", () => {
    expect(planIncludesGuidance("free")).toBe(false);
    expect(planIncludesGuidance("guide_beta")).toBe(true);
    expect(planIncludesGuidance("guide_paid")).toBe(true);
    expect(planIncludesGuidance("cloud_paid")).toBe(true);
  });
});

describe("usage tracker (server cost controls)", () => {
  const at = (iso: string) => () => new Date(iso);

  it("enforces the daily limit and rolls over at midnight UTC", () => {
    let now = "2026-07-18T10:00:00Z";
    const t = createUsageTracker({ dailyLimit: 2, monthlyBudgetUsd: 100, costPerGenerationUsd: 0.05 }, () =>
      new Date(now),
    );
    expect(t.canGenerate().ok).toBe(true);
    t.record();
    t.record();
    expect(t.canGenerate()).toEqual({ ok: false, reason: "daily_limit" });
    now = "2026-07-19T00:01:00Z"; // next day → resets
    expect(t.canGenerate().ok).toBe(true);
  });

  it("enforces the monthly budget from estimated spend", () => {
    const t = createUsageTracker(
      { dailyLimit: 1000, monthlyBudgetUsd: 0.1, costPerGenerationUsd: 0.05 },
      at("2026-07-18T10:00:00Z"),
    );
    t.record(); // est $0.05
    expect(t.canGenerate().ok).toBe(true);
    t.record(); // est $0.10 — next one would exceed
    expect(t.canGenerate()).toEqual({ ok: false, reason: "monthly_budget" });
  });

  it("fails closed on zero limits (misconfiguration can't mean unlimited)", () => {
    expect(
      createUsageTracker({ dailyLimit: 0, monthlyBudgetUsd: 10, costPerGenerationUsd: 0.05 }).canGenerate().ok,
    ).toBe(false);
    expect(
      createUsageTracker({ dailyLimit: 10, monthlyBudgetUsd: 0, costPerGenerationUsd: 0.05 }).canGenerate().ok,
    ).toBe(false);
  });
});

// ---- service: the gate in front of every Anthropic request ----------------

const TITLE: MediaTitle = {
  id: "tmdb:77",
  source: "tmdb",
  sourceId: "77",
  mediaType: "movie",
  title: "Memento",
  releaseYear: 2000,
  genres: ["Mystery"],
  dataStatus: "live",
};

function makeDeps(over: Partial<GuidanceServiceDeps> = {}): GuidanceServiceDeps & {
  generate: ReturnType<typeof vi.fn>;
  fetchTitle: ReturnType<typeof vi.fn>;
} {
  const generate = vi.fn(async () => ({ status: "ok" as const, guidance: fakeGuidance() }));
  const fetchTitle = vi.fn(async () => TITLE);
  const store = new Map<string, never>();
  return {
    config: readGuidanceConfig({}),
    plan: "guide_beta" as Plan,
    usage: createUsageTracker({ dailyLimit: 100, monthlyBudgetUsd: 100, costPerGenerationUsd: 0.05 }),
    cache: {
      get: (k) => store.get(k) ?? null,
      set: (k, v) => store.set(k, v as never),
    },
    fetchTitle,
    generate,
    ...over,
  };
}

function fakeGuidance() {
  return {
    quickTake: "Watch it when you want a mystery.",
    categories: [],
    bestFit: "Adults.",
    deepDive: "A focused watch.",
    attention: "full" as const,
    tone: "dark" as const,
    pacing: "steady" as const,
    occasions: [],
  };
}

describe("getGuidance access policy", () => {
  it("kill switch: disabled for every plan, provider never called", async () => {
    for (const plan of ["free", "guide_beta", "guide_paid", "cloud_paid"] as Plan[]) {
      const deps = makeDeps({ plan, config: readGuidanceConfig({ WNW_GUIDANCE_KILL_SWITCH: "1" }) });
      expect(await getGuidance("k", deps)).toEqual({ status: "disabled" });
      expect(deps.generate).not.toHaveBeenCalled();
      expect(deps.fetchTitle).not.toHaveBeenCalled();
    }
  });

  it("free plan (beta ended): typed entitlement response, provider never called", async () => {
    const deps = makeDeps({ plan: "free" });
    expect(await getGuidance("k", deps)).toEqual({ status: "entitlement_required" });
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("entitlement is checked before the cache — ending the beta ends the feature", async () => {
    const deps = makeDeps({ plan: "free" });
    deps.cache.set("k", { status: "ok", guidance: fakeGuidance() });
    expect((await getGuidance("k", deps)).status).toBe("entitlement_required");
  });

  it("beta and paid plans reach the provider", async () => {
    for (const plan of ["guide_beta", "guide_paid", "cloud_paid"] as Plan[]) {
      const deps = makeDeps({ plan });
      expect((await getGuidance("k", deps)).status).toBe("ok");
      expect(deps.generate).toHaveBeenCalledOnce();
    }
  });

  it("resolvePlan wiring: beta flag off means no provider call end-to-end", async () => {
    const config = readGuidanceConfig({ WNW_GUIDANCE_BETA_ENABLED: "0" });
    const deps = makeDeps({ config, plan: resolvePlan({ betaEnabled: config.betaEnabled }) });
    expect((await getGuidance("k", deps)).status).toBe("entitlement_required");
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("cost gates block new generations but cached cards still serve", async () => {
    const usage = createUsageTracker({ dailyLimit: 0, monthlyBudgetUsd: 100, costPerGenerationUsd: 0.05 });
    const deps = makeDeps({ usage });
    expect(await getGuidance("k", deps)).toEqual({ status: "limit_reached" });
    expect(deps.generate).not.toHaveBeenCalled();

    deps.cache.set("k", { status: "ok", guidance: fakeGuidance() });
    expect((await getGuidance("k", deps)).status).toBe("ok"); // cache hit costs nothing
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("attempts count against the budget even when the provider errors", async () => {
    const usage = createUsageTracker({ dailyLimit: 1, monthlyBudgetUsd: 100, costPerGenerationUsd: 0.05 });
    const deps = makeDeps({ usage, generate: vi.fn(async () => ({ status: "error" as const })) });
    expect((await getGuidance("k", deps)).status).toBe("error");
    expect(await getGuidance("k", deps)).toEqual({ status: "limit_reached" });
  });

  it("cache hit never calls the provider or spends budget", async () => {
    const deps = makeDeps();
    await getGuidance("k", deps);
    await getGuidance("k", deps);
    expect(deps.generate).toHaveBeenCalledOnce();
  });
});

describe("per-device beta limit (browser-only, honest guardrail)", () => {
  it("parses junk storage safely and resets on a new day", () => {
    expect(parseDeviceUsage(null, "2026-07-18")).toEqual({ day: "2026-07-18", count: 0 });
    expect(parseDeviceUsage({ day: "2026-07-17", count: 9 }, "2026-07-18")).toEqual({ day: "2026-07-18", count: 0 });
    expect(parseDeviceUsage({ day: "2026-07-18", count: 3.9 }, "2026-07-18")).toEqual({ day: "2026-07-18", count: 3 });
    expect(parseDeviceUsage({ day: "2026-07-18", count: -2 }, "2026-07-18")).toEqual({ day: "2026-07-18", count: 0 });
  });

  it("blocks at the daily device limit", () => {
    let u = { day: "2026-07-18", count: 0 };
    for (let i = 0; i < DEVICE_DAILY_LIMIT; i++) {
      expect(underDeviceLimit(u)).toBe(true);
      u = incrementDeviceUsage(u);
    }
    expect(underDeviceLimit(u)).toBe(false);
  });
});
