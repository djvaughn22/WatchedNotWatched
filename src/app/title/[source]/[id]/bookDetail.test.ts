// Regression guard for the confirmed first-click bug and the library-first
// action order. Source-text assertions, matching this repo's existing
// convention (see modeIntegration.test.ts) — there is no DOM renderer wired
// into the test setup, so runtime behavior for the fetch/state logic is
// covered directly in openlibrary.test.ts and api/title/route.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname);
const client = readFileSync(join(dir, "TitleDetailClient.tsx"), "utf8");
const bookActions = readFileSync(join(dir, "..", "..", "..", "components", "BookActions.tsx"), "utf8");

describe("first-click reliability contract", () => {
  it("seeds the initial title from the card shell cache, so a real click paints instantly", () => {
    expect(client).toContain("readTitleShell(`${source}:${id}`)");
    expect(client).toContain("useState<MediaTitle | null>(() =>");
  });

  it("distinguishes not_found from unavailable — a timeout is never shown as a 404", () => {
    expect(client).toContain('data.status === "not_found"');
    expect(client).toContain('data.status === "unavailable"');
    expect(client).not.toMatch(/notFound\(\)/);
  });

  it("an unavailable core fetch offers a visible Retry action, not a dead end", () => {
    expect(client).toMatch(/This is taking longer than it should[\s\S]*onClick=\{loadCore\}/);
  });

  it("a title already on screen survives an extended-data failure — the page never regresses to empty on secondary failure", () => {
    expect(client).toContain('setCoreStatus(title ? "done" : "unavailable")');
  });

  it("extended (author/edition/availability) enrichment fetch failures are swallowed, never surfaced as a page error", () => {
    expect(client).toMatch(/tier=extended[\s\S]*\.catch\(\(\) => \{/);
  });

  it("never touches the global product mode — ReadNotRead stays active through the whole detail flow", () => {
    expect(client).not.toMatch(/setMode\(/);
    expect(client).not.toContain("ModeProvider");
  });

  it("existing movie-only sections (Where to watch, Trailer) are untouched and still gated on !book", () => {
    expect(client).toMatch(/\{!book &&[\s\S]*Where to watch[\s\S]*Trailer/);
  });
});

describe("library-first action order and disclosure", () => {
  it("BookActions renders Read free/Borrow, then the library setup, before the commercial Buy/Listen card", () => {
    const readFreeIdx = bookActions.indexOf("<ReadFreeCard");
    const libraryIdx = bookActions.indexOf("<LibrarySetupCard");
    const commercialIdx = bookActions.indexOf("Buy or listen");
    expect(readFreeIdx).toBeGreaterThan(-1);
    expect(libraryIdx).toBeGreaterThan(readFreeIdx);
    expect(commercialIdx).toBeGreaterThan(libraryIdx);
  });

  it("Read free / Borrow only render when availability data says so — never an unconditional claim", () => {
    expect(bookActions).toContain("if (availability.readable)");
    expect(bookActions).toContain("if (availability.borrowable || availability.waitlisted)");
    expect(bookActions).toMatch(/return null;\s*\}/); // no availability signal → renders nothing
  });

  it("Amazon and Audible links carry the required safe rel attributes", () => {
    const amazonBlock = bookActions.slice(bookActions.indexOf("Buy or listen"));
    const relMatches = amazonBlock.match(/rel="sponsored nofollow noopener"/g) ?? [];
    expect(relMatches.length).toBeGreaterThanOrEqual(2); // Amazon + Audible at minimum
  });

  it("Audible is always framed as a search, never a claimed edition", () => {
    expect(bookActions).toContain("Listen on Audible (search)");
  });

  it("the required Amazon disclosure renders on the page", () => {
    expect(bookActions).toContain("AMAZON_DISCLOSURE");
  });

  it("primary actions meet the 44px mobile touch-target minimum", () => {
    expect(bookActions).toContain("min-h-11"); // Tailwind min-h-11 = 44px
  });

  it("library setup never asks for or stores a library card number, PIN, or password", () => {
    expect(bookActions).toMatch(/never ask for your library card number, PIN, password/i);
  });
});
