import { describe, expect, it } from "vitest";
import { buildHandoff, isSafeProviderUrl, PROVIDERS } from "./providers";

describe("provider capabilities are honest", () => {
  it("no provider claims account-auth, playback-control, or automatic-filtering", () => {
    for (const p of Object.values(PROVIDERS)) {
      expect(p.capabilities).not.toContain("account-authentication");
      expect(p.capabilities).not.toContain("playback-control");
      expect(p.capabilities).not.toContain("automatic-filtering");
    }
  });
});

describe("isSafeProviderUrl", () => {
  const netflix = PROVIDERS.netflix;
  it("accepts an https url on the provider domain", () => {
    expect(isSafeProviderUrl("https://www.netflix.com/title/123", netflix)).toBe(true);
  });
  it("rejects http", () => {
    expect(isSafeProviderUrl("http://www.netflix.com/title/123", netflix)).toBe(false);
  });
  it("rejects a spoofed lookalike host", () => {
    expect(isSafeProviderUrl("https://netflix.com.evil.example/x", netflix)).toBe(false);
  });
  it("rejects another provider's domain", () => {
    expect(isSafeProviderUrl("https://www.hulu.com/x", netflix)).toBe(false);
  });
});

describe("buildHandoff", () => {
  it("uses a verified title link when safe, with a matching label", () => {
    const h = buildHandoff({ providerId: "netflix", title: "X", verifiedTitleUrl: "https://www.netflix.com/title/1" });
    expect(h.type).toBe("verified-title");
    expect(h.label).toBe("Watch on Netflix");
  });
  it("falls back to provider search with a search label", () => {
    const h = buildHandoff({ providerId: "netflix", title: "The General" });
    expect(h.type).toBe("provider-search");
    expect(h.label).toBe("Search Netflix");
    expect(h.url).toContain("netflix.com/search");
  });
  it("ignores an unsafe verified url and does not label it 'Watch'", () => {
    const h = buildHandoff({ providerId: "netflix", title: "X", verifiedTitleUrl: "https://evil.example/x" });
    expect(h.type).not.toBe("verified-title");
  });
  it("encodes the query", () => {
    const h = buildHandoff({ providerId: "hulu", title: "a b&c" });
    expect(h.url).toContain("a%20b%26c");
  });
});
