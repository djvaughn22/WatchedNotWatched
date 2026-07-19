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
});
