import { describe, expect, it, vi, afterEach } from "vitest";
import {
  checkBookAvailability,
  createOpenLibraryAdapter,
  getTitleCore,
  getTitleExtended,
  isbnCoverUrl,
  normalizeOpenLibrarySearchDoc,
  OpenLibraryNotFoundError,
  relatedByAuthor,
  relatedBySubject,
  trendingBooks,
} from "./openlibrary";

function mockRes(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe("normalizeOpenLibrarySearchDoc", () => {
  it("turns a work into the shared book card shape", () => {
    expect(
      normalizeOpenLibrarySearchDoc({
        key: "/works/OL45804W",
        title: "Fantastic Mr Fox",
        author_name: ["Roald Dahl"],
        first_publish_year: 1970,
        cover_i: 8739161,
      }),
    ).toEqual({
      id: "openlibrary:OL45804W",
      source: "openlibrary",
      sourceId: "OL45804W",
      mediaType: "book",
      title: "Fantastic Mr Fox",
      creators: ["Roald Dahl"],
      releaseYear: 1970,
      // `?default=false` makes a missing cover 404 instead of Open Library's
      // silent generic icon, so the UI can detect it and show our placeholder.
      posterUrl: "https://covers.openlibrary.org/b/id/8739161-M.jpg?default=false",
      dataStatus: "live",
    });
  });

  it("drops edition rows and malformed works", () => {
    expect(normalizeOpenLibrarySearchDoc({ key: "/books/OL7353617M", title: "An edition" })).toBeNull();
    expect(normalizeOpenLibrarySearchDoc({ key: "/works/OL1W" })).toBeNull();
  });

  it("keeps a usable book result when optional cover, author, and publication data are absent", () => {
    expect(normalizeOpenLibrarySearchDoc({ key: "/works/OL1W", title: "A long, coverless title" })).toEqual({
      id: "openlibrary:OL1W",
      source: "openlibrary",
      sourceId: "OL1W",
      mediaType: "book",
      title: "A long, coverless title",
      creators: undefined,
      releaseYear: undefined,
      posterUrl: undefined,
      dataStatus: "live",
    });
  });
});

describe("isbnCoverUrl", () => {
  it("builds a default=false ISBN cover URL", () => {
    expect(isbnCoverUrl("9780547928227")).toBe(
      "https://covers.openlibrary.org/b/isbn/9780547928227-M.jpg?default=false",
    );
  });
});

const fetchDocs = (docs: unknown[]) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs }) } as Response);

describe("relatedByAuthor / relatedBySubject", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("excludes already-classified or seed works from author results", async () => {
    vi.stubGlobal(
      "fetch",
      fetchDocs([
        { key: "/works/OL1W", title: "Seed", author_name: ["A. Author"] },
        { key: "/works/OL2W", title: "Another book", author_name: ["A. Author"] },
      ]),
    );
    const items = await relatedByAuthor("A. Author", new Set(["openlibrary:OL1W"]), 12);
    expect(items.map((i) => i.id)).toEqual(["openlibrary:OL2W"]);
  });

  it("excludes already-classified works from subject results and dedupes", async () => {
    vi.stubGlobal(
      "fetch",
      fetchDocs([
        { key: "/works/OL1W", title: "Dupe", author_name: ["X"] },
        { key: "/works/OL1W", title: "Dupe", author_name: ["X"] },
        { key: "/works/OL3W", title: "Wanted", author_name: ["Y"] },
      ]),
    );
    const items = await relatedBySubject("fantasy", new Set(), 12);
    expect(items.map((i) => i.id)).toEqual(["openlibrary:OL1W", "openlibrary:OL3W"]);
  });
});

describe("searchTitles retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries once after a failed/timed-out first attempt and returns real results", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [{ key: "/works/OL1W", title: "Luther", author_name: ["Martin Luther"] }] }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOpenLibraryAdapter().searchTitles("luther");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.dataStatus).toBe("live");
    expect(result.items).toEqual([
      {
        id: "openlibrary:OL1W",
        source: "openlibrary",
        sourceId: "OL1W",
        mediaType: "book",
        title: "Luther",
        creators: ["Martin Luther"],
        releaseYear: undefined,
        posterUrl: undefined,
        dataStatus: "live",
      },
    ]);
  });

  it("surfaces failure (for the route to report as unavailable) when both attempts fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("still down")));
    await expect(createOpenLibraryAdapter().searchTitles("luther")).rejects.toThrow();
  });

  it("does not retry once the caller has already aborted", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("aborted"));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(createOpenLibraryAdapter().searchTitles("luther", { signal: controller.signal })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("trendingBooks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes Open Library's trending shape into book cards, deduped", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          works: [
            { key: "/works/OL1W", title: "Atomic Habits", author_name: ["James Clear"], first_publish_year: 2016 },
            { key: "/works/OL1W", title: "Atomic Habits", author_name: ["James Clear"], first_publish_year: 2016 },
          ],
        }),
      } as unknown as Response),
    );
    const items = await trendingBooks(24);
    expect(items).toEqual([
      {
        id: "openlibrary:OL1W",
        source: "openlibrary",
        sourceId: "OL1W",
        mediaType: "book",
        title: "Atomic Habits",
        creators: ["James Clear"],
        releaseYear: 2016,
        posterUrl: undefined,
        dataStatus: "live",
      },
    ]);
  });
});

// Regression coverage for the confirmed first-click bug: a transient Open
// Library failure must never be indistinguishable from "this book does not
// exist", and a valid work must resolve even through a merge redirect.
describe("getTitleCore reliability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries once on a transient failure and still returns the core shell", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(mockRes(200, { key: "/works/OL1W", title: "Foundation", covers: [123] }));
    vi.stubGlobal("fetch", fetchMock);

    const title = await getTitleCore("OL1W");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(title.title).toBe("Foundation");
    expect(title.id).toBe("openlibrary:OL1W");
  });

  it("throws OpenLibraryNotFoundError on a genuine 404 and does not retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockRes(404, {}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTitleCore("OL404W")).rejects.toBeInstanceOf(OpenLibraryNotFoundError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a generic error (not not-found) when both attempts fail transiently", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("still down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTitleCore("OL1W")).rejects.not.toBeInstanceOf(OpenLibraryNotFoundError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("follows a merge redirect stub and resolves the CANONICAL work id, not the stale one", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockRes(200, { key: "/works/OLSTALEW", type: { key: "/type/redirect" }, location: "/works/OLCANONW" }))
      .mockResolvedValueOnce(mockRes(200, { key: "/works/OLCANONW", title: "Dune", covers: [999] }));
    vi.stubGlobal("fetch", fetchMock);

    const title = await getTitleCore("OLSTALEW");
    expect(title.title).toBe("Dune");
    expect(title.id).toBe("openlibrary:OLCANONW");
    expect(title.sourceId).toBe("OLCANONW");
    expect(title.book?.workKey).toBe("OLCANONW");
  });
});

describe("getTitleExtended fault isolation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never throws even when every enrichment sub-call fails, and returns empty/null patches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/works/OL1W.json")) {
          return Promise.resolve(
            mockRes(200, { key: "/works/OL1W", title: "Foundation", authors: [{ author: { key: "/authors/OL1A" } }] }),
          );
        }
        return Promise.reject(new Error("down"));
      }),
    );

    const patch = await getTitleExtended("OL1W");
    expect(patch.creators).toEqual([]);
    expect(patch.book).toEqual({});
    expect(patch.availability).toBeNull();
  });
});

describe("checkBookAvailability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a currently-borrowable book correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockRes(200, { OL1W: { status: "open", is_readable: false, is_lendable: true, available_to_borrow: true } }),
      ),
    );
    const availability = await checkBookAvailability("OL1W");
    expect(availability).toEqual({ readable: false, borrowable: true, waitlisted: false, url: "https://openlibrary.org/works/OL1W" });
  });

  it("never claims availability when Open Library returns an error entry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRes(200, { OL1W: { status: "error", error_message: "not found" } })));
    expect(await checkBookAvailability("OL1W")).toBeNull();
  });

  it("returns null (never a false positive) on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await checkBookAvailability("OL1W")).toBeNull();
  });
});
