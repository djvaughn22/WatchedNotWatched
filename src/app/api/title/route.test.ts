import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import type { TitleResponse, TitleExtendedResponse } from "./route";

function req(qs: string): NextRequest {
  return new NextRequest(new URL(`http://localhost/api/title?${qs}`));
}

function mockRes(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe("GET /api/title (openlibrary)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns {status: 'ok', title} for a valid work, never a bare null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRes(200, { key: "/works/OL1W", title: "Foundation" })));
    const res = await GET(req("source=openlibrary&id=OL1W&mediaType=book"));
    const body = (await res.json()) as TitleResponse;
    expect(body.status).toBe("ok");
    if (body.status === "ok") expect(body.title.title).toBe("Foundation");
  });

  it("returns {status: 'not_found'} for a confirmed 404 — never Next's notFound(), never a bare null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRes(404, {})));
    const res = await GET(req("source=openlibrary&id=OLGONE&mediaType=book"));
    expect(await res.json()).toEqual({ status: "not_found" });
  });

  it("returns {status: 'unavailable'} for a transient failure — this is the confirmed bug: it must be retryable, not a 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const res = await GET(req("source=openlibrary&id=OL1W&mediaType=book"));
    expect(await res.json()).toEqual({ status: "unavailable" });
  });

  it("tier=extended returns a patch and never fails the core request's shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        url.includes("/works/OL1W.json")
          ? Promise.resolve(mockRes(200, { key: "/works/OL1W", title: "Foundation" }))
          : Promise.reject(new Error("down")),
      ),
    );
    const res = await GET(req("source=openlibrary&id=OL1W&tier=extended"));
    const body = (await res.json()) as TitleExtendedResponse;
    expect(body.status).toBe("ok");
    if (body.status === "ok") {
      expect(body.patch.creators).toEqual([]);
      expect(body.patch.availability).toBeNull();
    }
  });
});

describe("GET /api/title (non-book sources keep the same envelope)", () => {
  it("400s cleanly with not_found (not a crash) when id is missing", async () => {
    const res = await GET(req("source=tmdb&mediaType=movie"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "not_found" });
  });
});
