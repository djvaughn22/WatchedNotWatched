import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLibrarySearchIntent, isSafeLibraryUrl, saveReaderLibrary } from "./librarySetup";

describe("isSafeLibraryUrl", () => {
  it("accepts real OverDrive and Libby collection domains", () => {
    expect(isSafeLibraryUrl("https://chipublib.overdrive.com/")).toBe(true);
    expect(isSafeLibraryUrl("https://libbyapp.com/library/chipublib")).toBe(true);
  });

  it("rejects a non-OverDrive/Libby host, even a plausible-looking one", () => {
    expect(isSafeLibraryUrl("https://overdrive.com.evil.example/")).toBe(false);
    expect(isSafeLibraryUrl("https://my-fake-library.com/")).toBe(false);
  });

  it("rejects non-https and malformed URLs", () => {
    expect(isSafeLibraryUrl("http://chipublib.overdrive.com/")).toBe(false);
    expect(isSafeLibraryUrl("not a url")).toBe(false);
  });
});

describe("saveReaderLibrary", () => {
  it("refuses to save an unsafe URL — never persists an unvalidated destination", () => {
    expect(saveReaderLibrary({ label: "x", collectionUrl: "https://evil.example.com" })).toBe(false);
  });
});

describe("buildLibrarySearchIntent", () => {
  const lib = { label: "Chicago Public Library", collectionUrl: "https://chipublib.overdrive.com/" };

  it("prefers ISBN when available", () => {
    const intent = buildLibrarySearchIntent(lib, { isbn: "9780547928227", title: "The Hobbit" });
    expect(intent.copyText).toBe("9780547928227");
    expect(intent.url).toContain("query=9780547928227");
    expect(intent.isDeepLink).toBe(true);
  });

  it("falls back to exact title + author with no ISBN", () => {
    const intent = buildLibrarySearchIntent(lib, { title: "Dune", creators: ["Frank Herbert"] });
    expect(intent.copyText).toBe("Dune Frank Herbert");
  });

  it("always provides a copyable phrase alongside the deep link, so a mismatched collection template still leaves the reader with a usable fallback", () => {
    const intent = buildLibrarySearchIntent({ label: "x", collectionUrl: "https://libbyapp.com/odd/path" }, { title: "Dune" });
    expect(intent.copyText).toBe("Dune");
    expect(intent.url).toBeTruthy();
  });
});

describe("librarySetup never touches credentials", () => {
  it("there is exactly one localStorage write in the whole module, and it carries only label + collectionUrl", () => {
    const src = readFileSync(join(__dirname, "librarySetup.ts"), "utf8");
    const setItemCalls = src.match(/localStorage\.setItem/g) ?? [];
    expect(setItemCalls).toHaveLength(1);
    expect(src).toContain("JSON.stringify({ label:");
  });

  it("nothing card-number/PIN/password/history-shaped is ever assigned into the stored object", () => {
    const src = readFileSync(join(__dirname, "librarySetup.ts"), "utf8");
    // Scope the check to the object literal actually written to storage,
    // not the surrounding comments that document what we deliberately don't
    // collect — those legitimately name the very things being ruled out.
    const written = src.match(/JSON\.stringify\(\{[^}]*\}\)/)?.[0] ?? "";
    expect(written).not.toMatch(/card|pin|password|histor/i);
  });
});
