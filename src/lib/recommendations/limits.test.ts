import { beforeEach, describe, expect, it } from "vitest";
import { consumeAIGeneration, resetRateLimits } from "./rateLimit";
import { dedupe, getCached, recCacheKey, resetRecCache, setCached } from "./cache";

describe("rate limits", () => {
  beforeEach(() => resetRateLimits());

  it("caps a device at the daily limit", () => {
    const day = new Date("2026-07-24T10:00:00Z");
    expect(consumeAIGeneration("dev-1", "", 2, day)).toBe(true);
    expect(consumeAIGeneration("dev-1", "", 2, day)).toBe(true);
    expect(consumeAIGeneration("dev-1", "", 2, day)).toBe(false);
  });

  it("resets the next day", () => {
    expect(consumeAIGeneration("dev-1", "", 1, new Date("2026-07-24T10:00:00Z"))).toBe(true);
    expect(consumeAIGeneration("dev-1", "", 1, new Date("2026-07-24T23:00:00Z"))).toBe(false);
    expect(consumeAIGeneration("dev-1", "", 1, new Date("2026-07-25T01:00:00Z"))).toBe(true);
  });

  it("IP backstop stops device-id churn (guest testing)", () => {
    const day = new Date("2026-07-24T10:00:00Z");
    // 4x device limit per IP: with limit 1, five fresh device ids from one IP → fifth blocked.
    for (let i = 0; i < 4; i++) expect(consumeAIGeneration(`dev-${i}`, "1.2.3.4", 1, day)).toBe(true);
    expect(consumeAIGeneration("dev-fresh", "1.2.3.4", 1, day)).toBe(false);
  });

  it("counts devices independently", () => {
    const day = new Date("2026-07-24T10:00:00Z");
    expect(consumeAIGeneration("a", "", 1, day)).toBe(true);
    expect(consumeAIGeneration("b", "", 1, day)).toBe(true);
  });
});

describe("cache + dedupe", () => {
  beforeEach(() => resetRecCache());

  it("keys are stable for identical inputs and differ across modes", () => {
    const a = recCacheKey({ mode: "best_match", ids: ["1", "2"] });
    const b = recCacheKey({ mode: "best_match", ids: ["1", "2"] });
    const c = recCacheKey({ mode: "quick_watch", ids: ["1", "2"] });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("cached responses skip the second AI call", async () => {
    let calls = 0;
    const work = async () => {
      calls += 1;
      return { ok: true };
    };
    const key = recCacheKey({ x: 1 });
    const first = getCached(key) ?? (await dedupe(key, work));
    setCached(key, first);
    const second = getCached(key) ?? (await dedupe(key, work));
    expect(calls).toBe(1);
    expect(second).toEqual(first);
  });

  it("entries expire after the TTL", () => {
    const key = recCacheKey({ x: 2 });
    setCached(key, "v", 0);
    expect(getCached(key, 1000)).toBe("v");
    expect(getCached(key, 7 * 60 * 60 * 1000)).toBeUndefined();
  });

  it("concurrent identical requests share one in-flight call", async () => {
    let calls = 0;
    const work = () =>
      new Promise((resolve) => {
        calls += 1;
        setTimeout(() => resolve("done"), 5);
      });
    const key = recCacheKey({ x: 3 });
    const [a, b] = await Promise.all([dedupe(key, work), dedupe(key, work)]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
  });
});
