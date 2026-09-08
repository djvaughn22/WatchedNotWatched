// Regression guard for the ReadNotRead sprint: the whole application follows
// one global mode, not a widget-local toggle. These assertions read the real
// source (this repo has no DOM renderer in its test setup — see the other
// *.test.ts files for the same convention) so a future edit can't quietly
// reintroduce movie/TV leakage into ReadNotRead or vice versa.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = join(__dirname);
const homepage = readFileSync(join(app, "components/Homepage.tsx"), "utf8");
const searchExperience = readFileSync(join(app, "components/SearchExperience.tsx"), "utf8");
const titleCard = readFileSync(join(app, "components/TitleCard.tsx"), "utf8");
const titleDetail = readFileSync(join(app, "title/[source]/[id]/TitleDetailClient.tsx"), "utf8");
const bookCover = readFileSync(join(app, "components/BookCover.tsx"), "utf8");
const productNav = readFileSync(join(app, "components/ProductNav.tsx"), "utf8");
const modeSwitch = readFileSync(join(app, "components/ModeSwitch.tsx"), "utf8");
const layout = readFileSync(join(app, "layout.tsx"), "utf8");

describe("one global mode control", () => {
  it("layout wraps the whole app in ModeProvider, not just the homepage", () => {
    expect(layout).toContain("<ModeProvider>");
    expect(layout.indexOf("<ModeProvider>")).toBeLessThan(layout.indexOf("<OpenMirrorNav"));
    expect(layout.indexOf("{children}")).toBeGreaterThan(layout.indexOf("<ModeProvider>"));
  });

  it("ProductNav renders the mode switch on every page, in its own row so it can't overflow off-screen on a phone", () => {
    expect(productNav).toContain("<ModeSwitch");
    // Regression: the switch once shared a row with the scrollable link list
    // and fell off the right edge of a 375px viewport.
    expect(productNav).toMatch(/mt-2 flex justify-center[\s\S]*<ModeSwitch/);
  });

  it("the mode switch is a real two-state control, accessible by keyboard and screen reader", () => {
    expect(modeSwitch).toContain('role="group"');
    expect(modeSwitch).toContain("aria-pressed={mode === o.value}");
    expect(modeSwitch).toContain('"screen"');
    expect(modeSwitch).toContain('"book"');
  });
});

describe("Homepage never mixes movie/TV and book state", () => {
  it("hero copy comes from the mode dictionary, not a hardcoded combined sentence", () => {
    expect(homepage).not.toMatch(/watch or read/i);
    expect(homepage).toContain("copy.heroHeading");
    expect(homepage).toContain("copy.statusDone");
  });

  it("the TMDB Top 222 promo board is hidden entirely in book mode, not just relabeled", () => {
    expect(homepage).toMatch(/\{!book &&[\s\S]*How many have you seen\?/);
  });

  it("the picks deck and trending strip fetch by mode: kind=book for books, type= for screen", () => {
    expect(homepage).toContain('`/api/top?kind=book`');
    expect(homepage).toContain('/api/top?type=${type}');
  });

  it("recommendation seeds are filtered to the current mode's own library entries", () => {
    expect(homepage).toContain("isBook(e.mediaType) === book");
  });

  it("your-library counts are computed from modeEntries, not the whole mixed library", () => {
    expect(homepage).toMatch(/modeEntries\.filter\(\(e\) => inView\(e, v\)\)/);
  });
});

describe("Search never leaks results across modes", () => {
  it("kind=book is only appended when the global mode is book", () => {
    expect(searchExperience).toContain('mode === "book" ? "&kind=book" : ""');
  });

  it("a mode change invalidates any in-flight request and clears stale results before requerying", () => {
    expect(searchExperience).toMatch(/requestGuardRef\.current\.invalidate\(\);\s*abortRef\.current\?\.abort\(\);\s*setItems\(\[\]\);/);
  });

  it("placeholder and aria-label come from the mode dictionary, not a local string", () => {
    expect(searchExperience).toContain("placeholder={copy.searchPlaceholder}");
    expect(searchExperience).toContain("aria-label={copy.searchAriaLabel}");
  });
});

describe("Book cover fallback chain", () => {
  it("TitleCard renders books through BookCover, never the raw movie <img> path", () => {
    expect(titleCard).toMatch(/item\.mediaType === "book" \? \(\s*<BookCover/);
  });

  it("BookCover falls back from the given cover to an ISBN cover to a placeholder, and never leaves onError unhandled", () => {
    expect(bookCover).toContain("isbnCoverUrl(isbn)");
    expect(bookCover).toContain("onError={() => setStep((s) => s + 1)}");
    expect(bookCover).toContain("if (!src) return <Placeholder");
  });
});

describe("Title detail page keeps screen-only sections out of ReadNotRead", () => {
  it("Where to watch and Trailer are wrapped in the same !book guard", () => {
    expect(titleDetail).toMatch(/\{!book &&[\s\S]*Where to watch[\s\S]*Trailer/);
  });

  it("Related books / Similar titles renders for both, sourced by the item's own source", () => {
    expect(titleDetail).toMatch(/\{book \? "Related books" : "Similar titles"\}/);
  });

  it("book-only facts (publisher, pages, ISBN) render only when the title is a book", () => {
    expect(titleDetail).toMatch(/\{book && \(title\.book\?\.publisher/);
  });
});
