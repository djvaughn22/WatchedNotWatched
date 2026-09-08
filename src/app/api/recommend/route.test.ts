import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Regression guard: book seeds must produce book recommendations sourced
// entirely from Open Library, and must never reach TMDB (no numeric-id
// filtering could accidentally let a book id slip into the movie branch).

function postReq(body: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost/api/recommend"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/recommend", () => {
  beforeEach(() => {
    delete process.env.TMDB_ACCESS_TOKEN;
    delete process.env.TMDB_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("book seeds are resolved entirely through openlibrary.org and never themoviedb", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        calls.push(url);
        if (url.includes("/works/OL1W.json")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ title: "Seed Book", authors: [], subjects: ["Fantasy"] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            docs: [{ key: "/works/OL2W", title: "Related Book", author_name: ["Someone"] }],
          }),
        });
      }),
    );

    const res = await POST(
      postReq({
        seeds: [{ sourceId: "OL1W", mediaType: "book", weight: 3 }],
        seedTitles: { OL1W: "Seed Book" },
      }),
    );
    const body = await res.json();

    expect(calls.every((u) => u.startsWith("https://openlibrary.org"))).toBe(true);
    expect(calls.some((u) => u.includes("themoviedb"))).toBe(false);
    expect(body.items.every((it: { mediaType: string }) => it.mediaType === "book")).toBe(true);
    expect(body.items.some((it: { id: string }) => it.id === "openlibrary:OL2W")).toBe(true);
    // The seed itself is never handed back as its own recommendation.
    expect(body.items.some((it: { id: string }) => it.id === "openlibrary:OL1W")).toBe(false);
  });

  it("empty seeds short-circuit before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(postReq({ seeds: [] }));
    const body = await res.json();
    expect(body).toEqual({ items: [], supported: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
