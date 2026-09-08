import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createOpenLibraryAdapter,
  isbnCoverUrl,
  normalizeOpenLibrarySearchDoc,
  relatedByAuthor,
  relatedBySubject,
  trendingBooks,
} from "./openlibrary";

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
