import { describe, expect, it } from "vitest";
import { copyFor, DEFAULT_MODE, MODE_COPY, modeFromSearch, parseMode } from "./mode";

describe("parseMode", () => {
  it("accepts only the two known modes", () => {
    expect(parseMode("screen")).toBe("screen");
    expect(parseMode("book")).toBe("book");
  });

  it("rejects anything else, including movie-mode leftovers and garbage", () => {
    expect(parseMode("watch")).toBeNull();
    expect(parseMode("")).toBeNull();
    expect(parseMode(null)).toBeNull();
    expect(parseMode(undefined)).toBeNull();
    expect(parseMode(42)).toBeNull();
  });
});

describe("modeFromSearch", () => {
  const at = (search: string) => modeFromSearch(new URLSearchParams(search));

  it("keeps a book detail link in book mode, so a cross-site or shared link doesn't land in WatchedNotWatched chrome", () => {
    expect(at("?mediaType=book")).toBe("book");
    expect(at("?mediaType=book&mode=book")).toBe("book");
  });

  it("leaves movie and TV detail links alone — they carry no mode of their own", () => {
    expect(at("?mediaType=movie")).toBeNull();
    expect(at("?mediaType=series")).toBeNull();
    expect(at("")).toBeNull();
  });

  it("lets an explicit ?mode= win over the media type", () => {
    expect(at("?mediaType=book&mode=screen")).toBe("screen");
  });

  it("ignores a garbage mode value rather than guessing", () => {
    expect(at("?mode=watch")).toBeNull();
  });
});

describe("DEFAULT_MODE", () => {
  it("is screen, so existing users see the unchanged product until they switch", () => {
    expect(DEFAULT_MODE).toBe("screen");
  });
});

describe("MODE_COPY", () => {
  it("keeps screen-mode copy free of book/reading language", () => {
    const c = MODE_COPY.screen;
    for (const value of Object.values(c)) {
      expect(value.toLowerCase()).not.toMatch(/\bbook\b|\bread\b|\breading\b|\bauthor/);
    }
  });

  it("keeps book-mode copy free of screen/watching language", () => {
    const c = MODE_COPY.book;
    for (const [key, value] of Object.entries(c)) {
      if (key === "moreHref") continue; // shared route, not copy
      expect(value.toLowerCase()).not.toMatch(/\bmovie\b|\btv\b|\bwatch\b|\bwatched\b|\bwatching\b/);
    }
  });

  it("gives each mode its own brand and status language", () => {
    expect(MODE_COPY.screen.brand).toBe("WatchedNotWatched");
    expect(MODE_COPY.book.brand).toBe("ReadNotRead");
    expect(MODE_COPY.screen.statusDone).toBe("Watched");
    expect(MODE_COPY.book.statusDone).toBe("Read");
  });

  it("book cold-start copy is honest about not being personalized yet", () => {
    expect(MODE_COPY.book.picksColdStartCopy.toLowerCase()).toMatch(/not personalized/);
  });
});

describe("copyFor", () => {
  it("returns the matching entry from MODE_COPY", () => {
    expect(copyFor("screen")).toBe(MODE_COPY.screen);
    expect(copyFor("book")).toBe(MODE_COPY.book);
  });
});
