// Guardrails: the AI provider stays server-side and no secret can leak into
// client code. These are static checks over the source tree so a future
// refactor that breaks the boundary fails CI, not production.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));
const clientFiles = files.filter((f) => f.text.trimStart().startsWith('"use client"'));

describe("AI route security", () => {
  it("no client component imports the AI provider or the SDK", () => {
    for (const f of clientFiles) {
      expect(f.text, f.path).not.toMatch(/guidance\/provider/);
      expect(f.text, f.path).not.toMatch(/@anthropic-ai\/sdk/);
    }
  });

  it("the API key is only read inside the server-side provider", () => {
    for (const f of files) {
      if (f.path.endsWith("provider.ts")) continue;
      expect(f.text, f.path).not.toMatch(/ANTHROPIC_API_KEY/);
    }
  });

  it("no secret material or public-prefixed AI vars anywhere in src", () => {
    for (const f of files) {
      expect(f.text, f.path).not.toMatch(/sk-ant-/);
      expect(f.text, f.path).not.toMatch(/NEXT_PUBLIC_[A-Z_]*(ANTHROPIC|AI_KEY)/);
    }
  });

  it("guidance requests are metadata-only (prefs types never reach the route)", () => {
    const route = files.find((f) => f.path.includes(join("api", "guidance")));
    expect(route).toBeDefined();
    expect(route!.text).not.toMatch(/ViewingPrefs|prefs/i);
  });

  it("the provider is only reachable through the server route and service", () => {
    for (const f of files) {
      if (/provider\.ts$|route\.ts$|service\.ts$/.test(f.path)) continue;
      expect(f.text, f.path).not.toMatch(/guidance\/provider/);
    }
  });
});

describe("entitlement centralization", () => {
  it("WNW_GUIDANCE_* env is read only by the config module", () => {
    for (const f of files) {
      if (f.path.endsWith("config.ts")) continue;
      // Reads (env.WNW_GUIDANCE_...) are banned outside config.ts; comments
      // that merely name the variable are fine.
      expect(f.text, f.path).not.toMatch(/env\.WNW_GUIDANCE_/);
    }
  });

  it("no beta or plan checks scattered into client components", () => {
    for (const f of clientFiles) {
      expect(f.text, f.path).not.toMatch(/guide_beta|guide_paid|cloud_paid|betaEnabled|killSwitch/);
    }
  });

  it("the route cannot take a plan or beta grant from request data", () => {
    const route = files.find((f) => f.path.includes(join("api", "guidance")))!;
    // Plan comes from resolvePlan(config) only; nothing read off the request
    // mentions entitlement concepts.
    expect(route.text).toMatch(/resolvePlan\(\{ betaEnabled: config\.betaEnabled \}\)/);
    for (const m of route.text.matchAll(/searchParams\.get\("([^"]+)"\)/g)) {
      expect(["source", "id", "mediaType"], `request param ${m[1]}`).toContain(m[1]);
    }
    expect(route.text).not.toMatch(/req\.headers|req\.cookies|cookies\(\)/);
  });

  it("free local features do not depend on guidance modules", () => {
    for (const f of files) {
      if (/\/(library|useLocal|export)\.ts$/.test(f.path)) {
        expect(f.text, f.path).not.toMatch(/guidance|entitlements/);
      }
    }
  });
});

describe("analytics privacy", () => {
  it("no track() call includes AI response text or sensitive preference details", () => {
    const banned = /quickTake|deepDive|bestFit|guidance\.|viewerAges|sensitivities|kidsWatching|occasion/;
    for (const f of files) {
      for (const call of f.text.matchAll(/track\(([^;]*?)\);/g)) {
        expect(call[1], `${f.path}: track(${call[1]})`).not.toMatch(banned);
      }
    }
  });
});
