import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 2026-11-24 (owner): WatchedNotWatched speaks for itself. No plugs for
// other Open Mirror sites in its pages; the shared footer is the family tie.
const appDir = join(__dirname, "..", "app");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [full] : [];
  });
}

describe("messaging", () => {
  it("no page or component links or names PleaseBeReady", () => {
    const hits = walk(appDir).filter((f) => /pleasebeready\.com|PleaseBeReady|readiness shelf/i.test(readFileSync(f, "utf8")));
    expect(hits.map((f) => f.slice(appDir.length + 1))).toEqual([]);
  });
});
