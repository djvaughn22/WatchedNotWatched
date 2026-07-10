import { describe, expect, it } from "vitest";
import { FilterEngine } from "./engine";
import type { ControllablePlayer, FilterManifest } from "./types";

// A deterministic test double: we drive time manually via emit().
class MockPlayer implements ControllablePlayer {
  time = 0;
  muted = false;
  private cb: ((s: number) => void) | null = null;
  seeks: number[] = [];
  getCurrentTime() { return this.time; }
  getDuration() { return 100; }
  seekTo(s: number) { this.seeks.push(s); this.time = s; }
  getMuted() { return this.muted; }
  setMuted(m: boolean) { this.muted = m; }
  onTimeUpdate(cb: (s: number) => void) { this.cb = cb; return () => { this.cb = null; }; }
  emit(t: number) { this.time = t; this.cb?.(t); }
}

const manifest: FilterManifest = {
  id: "t", version: 1, mediaId: "m", title: "T", durationSeconds: 100,
  source: "sample", createdAt: "", updatedAt: "",
  events: [
    { id: "mute1", startSeconds: 10, endSeconds: 14, action: "mute", category: "language", severity: "moderate", label: "lang" },
    { id: "skip1", startSeconds: 20, endSeconds: 30, action: "skip", category: "violence", severity: "strong", label: "viol" },
  ],
};

describe("FilterEngine", () => {
  it("mutes inside a mute region and restores prior state on exit", () => {
    const p = new MockPlayer();
    const e = new FilterEngine(p, manifest);
    e.start();
    p.emit(5);
    expect(p.muted).toBe(false);
    p.emit(11);
    expect(p.muted).toBe(true);
    p.emit(15);
    expect(p.muted).toBe(false); // restored
    expect(e.getState().counts.muted).toBe(1);
  });

  it("restores the user's PRIOR mute state, not just unmute", () => {
    const p = new MockPlayer();
    p.muted = true; // user had it muted already
    const e = new FilterEngine(p, manifest);
    e.start();
    p.emit(11);
    expect(p.muted).toBe(true);
    p.emit(16);
    expect(p.muted).toBe(true); // stays muted (prior state)
  });

  it("skips to the end of a skip region exactly once", () => {
    const p = new MockPlayer();
    const e = new FilterEngine(p, manifest);
    e.start();
    p.emit(21);
    expect(p.seeks).toEqual([30]);
    // continuing forward doesn't re-trigger
    p.emit(31);
    expect(p.seeks).toEqual([30]);
    expect(e.getState().counts.skipped).toBe(1);
  });

  it("re-skips when the user scrubs backward into the region", () => {
    const p = new MockPlayer();
    const e = new FilterEngine(p, manifest);
    e.start();
    p.emit(21); // skip -> 30
    p.emit(35); // leaves region
    p.emit(22); // scrub back in -> skip again
    expect(p.seeks).toEqual([30, 30]);
  });

  it("does nothing when the category is disabled", () => {
    const p = new MockPlayer();
    const e = new FilterEngine(p, manifest, { enabledCategories: new Set(["violence"]), disabledEventIds: new Set(), warnLeadSeconds: 3 });
    e.start();
    p.emit(11); // language disabled
    expect(p.muted).toBe(false);
    p.emit(21); // violence still skips
    expect(p.seeks).toEqual([30]);
  });

  it("does nothing for an individually disabled event", () => {
    const p = new MockPlayer();
    const e = new FilterEngine(p, manifest, { enabledCategories: new Set(["language", "violence"]), disabledEventIds: new Set(["skip1"]), warnLeadSeconds: 3 });
    e.start();
    p.emit(21);
    expect(p.seeks).toEqual([]);
  });

  it("stop() restores mute and detaches", () => {
    const p = new MockPlayer();
    const e = new FilterEngine(p, manifest);
    e.start();
    p.emit(11);
    expect(p.muted).toBe(true);
    e.stop();
    expect(p.muted).toBe(false);
  });
});
