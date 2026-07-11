import { describe, expect, it } from "vitest";
import {
  applyDecision,
  clearDecision,
  getDecision,
  sanitizeEntries,
  type WatchStatusEntry,
} from "./watchStatus";

const entry = (id: string, decision: WatchStatusEntry["decision"]): Omit<WatchStatusEntry, "decidedAt"> => ({
  id,
  source: "tvmaze",
  sourceId: id.split(":")[1] ?? id,
  mediaType: "series",
  title: `Title ${id}`,
  decision,
});

describe("sanitizeEntries", () => {
  it("returns [] for non-arrays and junk", () => {
    expect(sanitizeEntries(null)).toEqual([]);
    expect(sanitizeEntries("nope")).toEqual([]);
    expect(sanitizeEntries({})).toEqual([]);
  });

  it("drops malformed entries and keeps valid ones", () => {
    const good = { ...entry("tvmaze:1", "watched"), decidedAt: "2026-07-10T00:00:00Z" };
    const bad = [
      null,
      { id: 5, title: "x", decision: "watched" },
      { id: "a", title: "x", decision: "maybe" },
      good,
    ];
    expect(sanitizeEntries(bad)).toEqual([good]);
  });
});

describe("applyDecision", () => {
  it("adds a new decision at the front", () => {
    const list = applyDecision([], entry("tvmaze:1", "watched"), "2026-07-10T00:00:00Z");
    expect(list).toHaveLength(1);
    expect(list[0].decision).toBe("watched");
    expect(list[0].decidedAt).toBe("2026-07-10T00:00:00Z");
  });

  it("replaces an existing decision for the same title", () => {
    let list = applyDecision([], entry("tvmaze:1", "watched"));
    list = applyDecision(list, entry("tvmaze:2", "watched"));
    list = applyDecision(list, entry("tvmaze:1", "not-watched"));
    expect(list).toHaveLength(2);
    expect(getDecision(list, "tvmaze:1")).toBe("not-watched");
    expect(getDecision(list, "tvmaze:2")).toBe("watched");
  });
});

describe("clearDecision / getDecision", () => {
  it("removes a decision and reports null afterwards", () => {
    let list = applyDecision([], entry("tvmaze:1", "watched"));
    expect(getDecision(list, "tvmaze:1")).toBe("watched");
    list = clearDecision(list, "tvmaze:1");
    expect(getDecision(list, "tvmaze:1")).toBeNull();
    expect(list).toEqual([]);
  });

  it("clearing an unknown id is a no-op", () => {
    const list = applyDecision([], entry("tvmaze:1", "watched"));
    expect(clearDecision(list, "nope")).toEqual(list);
  });
});
