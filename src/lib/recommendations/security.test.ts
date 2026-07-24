// Static guardrails for the AI recommendation feature — the tests that keep
// future edits from quietly reintroducing the classic mistakes: keys in the
// client bundle, plan checks in client code, client-controlled entitlement.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");

function readAll(dir: string): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...readAll(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push({ path: p, text: readFileSync(p, "utf8") });
  }
  return out;
}

const files = readAll(SRC);
const clientFiles = files.filter((f) => f.text.startsWith('"use client"'));

describe("AI recommendations — static guardrails", () => {
  it("the Anthropic key is referenced only in server config", () => {
    const offenders = files.filter(
      (f) => f.text.includes("ANTHROPIC_API_KEY") && !f.path.endsWith("recommendations/config.ts") && !f.path.includes(".test."),
    );
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("no NEXT_PUBLIC_ AI variables exist (nothing AI-related is inlined into the bundle)", () => {
    const offenders = files.filter((f) => /NEXT_PUBLIC_\w*(ANTHROPIC|AI_RECOMMEND)/.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("client components never import the server-side AI modules", () => {
    const banned = ["recommendations/ai", "recommendations/entitlement", "recommendations/config", "recommendations/rateLimit", "recommendations/cache", "recommendations/retrieve", "@anthropic-ai/sdk"];
    const offenders = clientFiles.filter((f) => banned.some((b) => f.text.includes(b)));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("no client code reads AI feature env flags (server config only)", () => {
    const offenders = clientFiles.filter((f) => f.text.includes("AI_RECOMMENDATIONS"));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("the request sanitizer accepts no entitlement/plan field from the client", () => {
    const text = readFileSync(join(SRC, "lib", "recommendations", "request.ts"), "utf8");
    expect(text).not.toMatch(/entitle|plan|paid|premium/i);
  });
});
