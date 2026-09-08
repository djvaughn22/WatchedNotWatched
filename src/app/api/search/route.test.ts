import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Regression guard for the core reported bug: a book search must call Open
// Library only, and a movie/TV search must never touch Open Library. Each
// route's own fallback chain (TMDB → TVmaze) stays intact either way.

function req(qs: string): NextRequest {
  return new NextRequest(new URL(`http://localhost/api/search?${qs}`));
}

describe("GET /api/search", () => {
  const originalTmdbToken = process.env.TMDB_ACCESS_TOKEN;
  const originalTmdbKey = process.env.TMDB_API_KEY;

  beforeEach(() => {
    delete process.env.TMDB_ACCESS_TOKEN;
    delete process.env.TMDB_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalTmdbToken) process.env.TMDB_ACCESS_TOKEN = originalTmdbToken;
    if (originalTmdbKey) process.env.TMDB_API_KEY = originalTmdbKey;
  });

  it("kind=book calls only openlibrary.org, never themoviedb or tvmaze", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        calls.push(url);
        return Promise.resolve({
          ok: true,
          json: async () => ({ docs: [{ key: "/works/OL1W", title: "Luther", author_name: ["Martin Luther"] }] }),
        });
      }),
    );

    const res = await GET(req("q=luther&kind=book"));
    const body = await res.json();

    expect(calls.every((u) => u.startsWith("https://openlibrary.org"))).toBe(true);
    expect(calls.some((u) => u.includes("themoviedb"))).toBe(false);
    expect(calls.some((u) => u.includes("tvmaze"))).toBe(false);
    expect(body.items[0].mediaType).toBe("book");
  });

  it("a plain (movie/TV) search never calls openlibrary.org", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        calls.push(url);
        return Promise.resolve({
          ok: true,
          json: async () => ({ _embedded: { show: [] } }),
        });
      }),
    );

    await GET(req("q=luther"));

    expect(calls.some((u) => u.includes("openlibrary.org"))).toBe(false);
  });

  it("a query under 2 characters returns an empty, unavailable result without any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req("q=a&kind=book"));
    const body = await res.json();
    expect(body).toEqual({ query: "a", items: [], dataStatus: "unavailable", attribution: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
