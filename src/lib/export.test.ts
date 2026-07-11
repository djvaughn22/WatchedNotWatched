import { describe, expect, it } from "vitest";
import { entriesToCsv, entriesToJson, entriesToMarkdown, entriesToSummary } from "./export";
import type { LibraryEntry } from "./library";

const entries: LibraryEntry[] = [
  {
    id: "tmdb:27205",
    source: "tmdb",
    sourceId: "27205",
    mediaType: "movie",
    title: 'Inception, the "dream" one',
    releaseYear: 2010,
    genres: ["Action", "Science Fiction"],
    status: "watched",
    myTake: "loved",
    again: "yes",
    addedAt: "2026-07-01T10:00:00Z",
    watchedAt: "2026-07-02T10:00:00Z",
  },
  {
    id: "tvmaze:526",
    source: "tvmaze",
    sourceId: "526",
    mediaType: "series",
    title: "The Office",
    releaseYear: 2005,
    status: "want_to_watch",
    addedAt: "2026-07-03T10:00:00Z",
  },
];

describe("entriesToCsv", () => {
  it("produces a header plus one row per entry, escaping quotes and commas", () => {
    const csv = entriesToCsv(entries);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Title,Year,Type,Status,My Take,Again");
    expect(lines[1]).toContain('"Inception, the ""dream"" one"');
    expect(lines[1]).toContain("Loved it");
    expect(lines[1]).toContain("2026-07-02");
    expect(lines[2]).toContain("Want to Watch");
  });
});

describe("entriesToJson", () => {
  it("round-trips entries for a future import", () => {
    const parsed = JSON.parse(entriesToJson(entries));
    expect(parsed.format).toBe("wnw-library");
    expect(parsed.version).toBe(2);
    expect(parsed.entries).toEqual(entries);
  });
});

describe("entriesToMarkdown", () => {
  it("groups by status with counts", () => {
    const md = entriesToMarkdown(entries);
    expect(md).toContain("## Want to Watch (1)");
    expect(md).toContain("## Watched (1)");
    expect(md).toContain("My Take: Loved it");
  });
});

describe("entriesToSummary", () => {
  it("counts and lists loved + up-next titles", () => {
    const s = entriesToSummary(entries);
    expect(s).toContain("1 watched, 1 to watch");
    expect(s).toContain("Loved:");
    expect(s).toContain("The Office (2005)");
  });
});
