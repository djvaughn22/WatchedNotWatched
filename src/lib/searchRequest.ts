/**
 * Keeps debounced searches from committing a response after the input or
 * media kind has changed. It is deliberately framework-free so the ordering
 * guarantee is easy to exercise without a browser.
 */
export function createSearchRequestGuard() {
  let current = 0;

  return {
    begin() {
      current += 1;
      return current;
    },
    invalidate() {
      current += 1;
    },
    isCurrent(request: number) {
      return request === current;
    },
  };
}

/** A provider outage is retryable; an empty live response is a genuine no-result. */
export function isSearchAvailable(result: Pick<SearchResult, "dataStatus">): boolean {
  return result.dataStatus !== "unavailable";
}
import type { SearchResult } from "./media/types";
