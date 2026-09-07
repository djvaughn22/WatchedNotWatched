import { describe, expect, it } from "vitest";
import { createSearchRequestGuard, isSearchAvailable } from "./searchRequest";

describe("createSearchRequestGuard", () => {
  it("rejects a response after a new query or media kind invalidates it", () => {
    const guard = createSearchRequestGuard();
    const booksRequest = guard.begin();

    guard.invalidate(); // The reader typed again or switched back to Movies + TV.
    const screenRequest = guard.begin();

    expect(guard.isCurrent(booksRequest)).toBe(false);
    expect(guard.isCurrent(screenRequest)).toBe(true);
  });
});

describe("isSearchAvailable", () => {
  it("keeps a live empty response distinct from a provider outage", () => {
    expect(isSearchAvailable({ dataStatus: "live" })).toBe(true);
    expect(isSearchAvailable({ dataStatus: "unavailable" })).toBe(false);
  });
});
