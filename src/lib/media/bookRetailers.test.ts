import { afterEach, describe, expect, it, vi } from "vitest";
import { AMAZON_DISCLOSURE, buildAmazonBookLink, buildAudibleLink } from "./bookRetailers";

describe("buildAmazonBookLink", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("converts a real ISBN-13 to its ISBN-10/ASIN and links directly to the product", () => {
    // 9780547928227 is The Hobbit's real ISBN-13 (verified against Open Library).
    const link = buildAmazonBookLink({ title: "The Hobbit", isbn: "9780547928227" });
    expect(link.kind).toBe("product");
    // 054792822X is a verified-real ISBN-10 for this ISBN-13 (confirmed
    // against openlibrary.org/isbn/054792822X.json, which 302s to the record).
    expect(link.url).toBe("https://www.amazon.com/dp/054792822X");
  });

  it("uses a 10-digit ISBN directly as the ASIN", () => {
    const link = buildAmazonBookLink({ title: "Foundation", isbn: "0553293354" });
    expect(link.url).toBe("https://www.amazon.com/dp/0553293354");
  });

  it("falls back to an ISBN-scoped search when the ISBN can't be converted to an ASIN, never a broken /dp/ guess", () => {
    const link = buildAmazonBookLink({ title: "Some Book", isbn: "not-a-real-isbn" });
    expect(link.kind).toBe("search");
    expect(link.url).toContain("amazon.com/s?k=");
  });

  it("only says 'Buy' for a real product page — every search is labeled as a search", () => {
    expect(buildAmazonBookLink({ title: "The Hobbit", isbn: "9780547928227" }).label).toBe("Buy on Amazon");
    expect(buildAmazonBookLink({ title: "Some Book", isbn: "not-a-real-isbn" }).label).toBe("Search Amazon");
    expect(buildAmazonBookLink({ title: "Dune", creators: ["Frank Herbert"] }).label).toBe("Search Amazon");
  });

  it("falls back to a title+author search with no ISBN", () => {
    const link = buildAmazonBookLink({ title: "Dune", creators: ["Frank Herbert"] });
    expect(link.kind).toBe("search");
    expect(link.url).toContain(encodeURIComponent("Dune Frank Herbert"));
    expect(link.url).toContain("i=stripbooks");
  });

  // The tag is read from process.env at module load, so a live env-dependent
  // test needs a fresh module instance per value — not a stub after the fact.
  it("appends the configured Associates tag only when one is actually set", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG", "");
    const unconfigured = await import("./bookRetailers");
    expect(unconfigured.buildAmazonBookLink({ title: "Dune" }).url).not.toContain("tag=");

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG", "djreads-20");
    const configured = await import("./bookRetailers");
    expect(configured.buildAmazonBookLink({ title: "Dune" }).url).toContain("tag=djreads-20");
  });
});

describe("amazonStorefrontLink", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns null when no storefront URL is configured — never a fabricated link", async () => {
    vi.stubEnv("NEXT_PUBLIC_AMAZON_STOREFRONT_URL", "");
    const mod = await import("./bookRetailers");
    expect(mod.amazonStorefrontLink()).toBeNull();
  });

  it("rejects a non-Amazon storefront URL even if one is configured — never trust an arbitrary host", async () => {
    vi.stubEnv("NEXT_PUBLIC_AMAZON_STOREFRONT_URL", "https://evil.example.com/store");
    const mod = await import("./bookRetailers");
    expect(mod.amazonStorefrontLink()).toBeNull();
  });

  it("accepts a real amazon.com storefront URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_AMAZON_STOREFRONT_URL", "https://www.amazon.com/shop/djvaughn");
    const mod = await import("./bookRetailers");
    expect(mod.amazonStorefrontLink()?.url).toBe("https://www.amazon.com/shop/djvaughn");
  });
});

describe("buildAudibleLink", () => {
  it("is always a search, never a claimed product link — no way to verify a specific audiobook exists here", () => {
    const link = buildAudibleLink({ title: "Man's Search for Meaning", creators: ["Viktor E. Frankl"] });
    expect(link.kind).toBe("search");
    expect(link.url).toContain("audible.com/search?keywords=");
  });

  it("searches on the exact title AND author, so the results are the right book", () => {
    const link = buildAudibleLink({ title: "Man's Search for Meaning", creators: ["Viktor E. Frankl"] });
    const keywords = new URL(link.url).searchParams.get("keywords");
    expect(keywords).toBe("Man's Search for Meaning Viktor E. Frankl");
  });

  it("never promises listening — the label says search, because no audiobook edition is verified", () => {
    expect(buildAudibleLink({ title: "Dune" }).label).toBe("Search Audible");
  });
});

describe("AMAZON_DISCLOSURE", () => {
  it("is the required Associates disclosure text", () => {
    expect(AMAZON_DISCLOSURE).toMatch(/Amazon Associate/i);
    expect(AMAZON_DISCLOSURE).toMatch(/qualifying purchases/i);
  });
});
