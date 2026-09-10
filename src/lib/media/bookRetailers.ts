// Amazon / Audible commerce links for ReadNotRead book detail pages.
// Same honesty rule as providers.ts: we only ever OPEN a link. No price or
// availability is displayed unless it came from an approved Amazon API
// (none is wired up), and no tag is ever fabricated.
//
// The Associates tag and storefront URL are not secrets — a tag is visible
// in plain sight in every resulting URL — so NEXT_PUBLIC_ exposure carries
// no real risk and matches the sibling PleaseBeReady site's existing
// NEXT_PUBLIC_AMAZON_TAG convention.

const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG?.trim() || undefined;
const AMAZON_STOREFRONT_URL = process.env.NEXT_PUBLIC_AMAZON_STOREFRONT_URL?.trim() || undefined;

export const AMAZON_DISCLOSURE = "As an Amazon Associate I earn from qualifying purchases.";

const AMAZON_HOSTS = ["amazon.com", "www.amazon.com"];

function isSafeAmazonUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && AMAZON_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function withTag(url: string): string {
  if (!AMAZON_TAG) return url;
  const u = new URL(url);
  u.searchParams.set("tag", AMAZON_TAG);
  return u.toString();
}

/** ISBN-13 (978-prefixed) → ISBN-10, the identifier Amazon's /dp/ path
 * actually expects for print books. Real ISO 2108 check-digit math, not a
 * guess — a wrong prefix or bad checksum returns null rather than a
 * plausible-looking but broken link. */
function isbn13To10(isbn13: string): string | null {
  const digits = isbn13.replace(/[^0-9]/g, "");
  if (digits.length !== 13 || !digits.startsWith("978")) return null;
  const core = digits.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(core[i]);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? "X" : String(check));
}

function toAsin(isbn: string): string | null {
  const cleaned = isbn.replace(/[^0-9Xx]/g, "");
  if (cleaned.length === 10) return cleaned.toUpperCase();
  if (cleaned.length === 13) return isbn13To10(cleaned);
  return null;
}

export interface RetailerLink {
  label: string;
  url: string;
  /** "product" = a specific book's page; "search" = a targeted query, not a guess at one exact page. */
  kind: "product" | "search";
}

export interface BookIdentity {
  title: string;
  creators?: string[];
  isbn?: string;
}

function titleAuthorQuery(book: BookIdentity): string {
  return [book.title, book.creators?.[0]].filter(Boolean).join(" ");
}

/** Priority: real ISBN→ASIN product link → ISBN-scoped search → title+author search. */
export function buildAmazonBookLink(book: BookIdentity): RetailerLink {
  if (book.isbn) {
    const asin = toAsin(book.isbn);
    if (asin) {
      return { label: "Buy on Amazon", url: withTag(`https://www.amazon.com/dp/${asin}`), kind: "product" };
    }
    return {
      label: "Search Amazon",
      url: withTag(`https://www.amazon.com/s?k=${encodeURIComponent(book.isbn)}&i=stripbooks`),
      kind: "search",
    };
  }
  return {
    label: "Search Amazon",
    url: withTag(`https://www.amazon.com/s?k=${encodeURIComponent(titleAuthorQuery(book))}&i=stripbooks`),
    kind: "search",
  };
}

/** Only returned when a real, safe (https, amazon.com host) storefront URL is
 * configured — this is a secondary "browse everything DJ recommends" link,
 * never presented as pointing at this specific book. */
export function amazonStorefrontLink(): RetailerLink | null {
  if (!isSafeAmazonUrl(AMAZON_STOREFRONT_URL)) return null;
  return { label: "Visit DJ's Amazon Store", url: AMAZON_STOREFRONT_URL, kind: "search" };
}

/** No public Audible catalog API exists here to verify a specific audiobook
 * edition, so this is always a targeted search — never a claimed product
 * link — per the "never claim an audiobook exists without verifying it" rule. */
export function buildAudibleLink(book: BookIdentity): RetailerLink {
  return {
    label: "Search Audible",
    url: `https://www.audible.com/search?keywords=${encodeURIComponent(titleAuthorQuery(book))}`,
    kind: "search",
  };
}

export function isAmazonConfigured(): boolean {
  return !!AMAZON_TAG;
}
