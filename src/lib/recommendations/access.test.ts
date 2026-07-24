import { describe, expect, it } from "vitest";
import { loadRecConfig } from "./config";
import { decideAIAccess } from "./entitlement";

const env = (over: Record<string, string> = {}): NodeJS.ProcessEnv =>
  ({ ...over }) as unknown as NodeJS.ProcessEnv;

describe("loadRecConfig — fails closed", () => {
  it("defaults to AI off, entitlement required", () => {
    const c = loadRecConfig(env());
    expect(c.aiEnabled).toBe(false);
    expect(c.requireEntitlement).toBe(true);
    expect(c.testMode).toBe(false);
  });

  it("ignores garbage numbers and keeps safe limits", () => {
    const c = loadRecConfig(
      env({ AI_RECOMMENDATIONS_DAILY_LIMIT: "banana", AI_RECOMMENDATIONS_RESULT_COUNT: "-3", AI_RECOMMENDATIONS_MAX_TOKENS: "999999" }),
    );
    expect(c.dailyLimit).toBe(5);
    expect(c.resultCount).toBe(5);
    expect(c.maxOutputTokens).toBe(4000);
  });
});

describe("decideAIAccess", () => {
  const base = {
    AI_RECOMMENDATIONS_ENABLED: "true",
    ANTHROPIC_API_KEY: "sk-test",
  };

  it("private testing config allows AI", () => {
    const c = loadRecConfig(env({ ...base, AI_RECOMMENDATIONS_TEST_MODE: "true", AI_RECOMMENDATIONS_REQUIRE_ENTITLEMENT: "false" }));
    expect(decideAIAccess(c)).toEqual({ allowed: true });
  });

  it("production config (test off, entitlement enforced) blocks every visitor — no AI charge possible", () => {
    const c = loadRecConfig(env({ ...base, AI_RECOMMENDATIONS_TEST_MODE: "false", AI_RECOMMENDATIONS_REQUIRE_ENTITLEMENT: "true" }));
    expect(decideAIAccess(c)).toEqual({ allowed: false, reason: "entitlement_required" });
  });

  it("master switch off wins over test mode", () => {
    const c = loadRecConfig(env({ ANTHROPIC_API_KEY: "sk", AI_RECOMMENDATIONS_TEST_MODE: "true" }));
    expect(decideAIAccess(c)).toEqual({ allowed: false, reason: "disabled" });
  });

  it("missing API key disables AI even when everything else is on", () => {
    const c = loadRecConfig(env({ AI_RECOMMENDATIONS_ENABLED: "true", AI_RECOMMENDATIONS_TEST_MODE: "true" }));
    expect(decideAIAccess(c)).toEqual({ allowed: false, reason: "disabled" });
  });

  it("enforcement off without test mode still does not grant AI (no silent free-for-all)", () => {
    const c = loadRecConfig(env({ ...base, AI_RECOMMENDATIONS_REQUIRE_ENTITLEMENT: "false" }));
    expect(decideAIAccess(c)).toEqual({ allowed: false, reason: "entitlement_required" });
  });

  it("the override lives in server env only — access takes no request input", () => {
    // Type-level guarantee: decideAIAccess(config) has no parameter for
    // anything client-supplied. This assertion documents it at runtime.
    expect(decideAIAccess.length).toBe(1);
  });
});
