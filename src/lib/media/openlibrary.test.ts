import { describe, expect, it } from "vitest";
import { normalizeOpenLibrarySearchDoc } from "./openlibrary";

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
      posterUrl: "https://covers.openlibrary.org/b/id/8739161-M.jpg",
      dataStatus: "live",
    });
  });

  it("drops edition rows and malformed works", () => {
    expect(normalizeOpenLibrarySearchDoc({ key: "/books/OL7353617M", title: "An edition" })).toBeNull();
    expect(normalizeOpenLibrarySearchDoc({ key: "/works/OL1W" })).toBeNull();
  });
});
