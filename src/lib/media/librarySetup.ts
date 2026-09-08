// A one-time, per-device "which library do I use" setting for the
// "Find at my library" action. This is intentionally the ENTIRE surface
// area: we store a label and a validated OverDrive/Libby collection URL,
// nothing else. No library-card number, PIN, password, or borrowing record
// is ever collected, proxied, or stored — Libby's own app handles all of
// that, on Libby's own servers, under the reader's own library account.

const KEY = "wnw.readerLibrary.v1";

// Every OverDrive-hosted library collection lives at "<slug>.overdrive.com";
// Libby's own domain covers the newer app-first flow. Anything else is
// refused — this is what stops a malicious or mistaken URL from ever being
// saved or opened as if it were the reader's library.
const ALLOWED_DOMAINS = ["overdrive.com", "libbyapp.com"];

export const OVERDRIVE_FIND_LIBRARY_URL = "https://www.overdrive.com/libraries";
export const LIBBY_APP_URL = "https://www.overdrive.com/apps/libby";

export interface ReaderLibrary {
  /** Display label only, e.g. "Chicago Public Library" — the reader's own words. */
  label: string;
  collectionUrl: string;
}

export function isSafeLibraryUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export function saveReaderLibrary(lib: ReaderLibrary): boolean {
  if (!isSafeLibraryUrl(lib.collectionUrl)) return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ label: lib.label.slice(0, 120), collectionUrl: lib.collectionUrl }));
    return true;
  } catch {
    return false;
  }
}

export function readReaderLibrary(): ReaderLibrary | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { label?: unknown; collectionUrl?: unknown };
    if (typeof parsed.collectionUrl !== "string" || !isSafeLibraryUrl(parsed.collectionUrl)) return null;
    return { label: typeof parsed.label === "string" && parsed.label ? parsed.label : "My library", collectionUrl: parsed.collectionUrl };
  } catch {
    return null;
  }
}

export function clearReaderLibrary(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export interface LibrarySearchIntent {
  /** Best-effort deep link into the reader's saved collection. */
  url: string;
  /** False when we could only open the collection itself, not a search within it. */
  isDeepLink: boolean;
  /** Always provided so the reader has a copyable fallback even for a deep link that might not match their library's exact template. */
  copyText: string;
}

/** Prefer ISBN (unambiguous); fall back to exact title + author. */
export function buildLibrarySearchIntent(lib: ReaderLibrary, book: { isbn?: string; title: string; creators?: string[] }): LibrarySearchIntent {
  const query = book.isbn || [book.title, book.creators?.[0]].filter(Boolean).join(" ");
  try {
    const origin = new URL(lib.collectionUrl).origin;
    // The standard OverDrive collection template serves search at
    // "<collection>/search?query=...". Most collections honor it, but not
    // every library customizes their template the same way, so the copyable
    // phrase below is always shown alongside this, never hidden behind it.
    const url = `${origin}/search?query=${encodeURIComponent(query)}`;
    return { url, isDeepLink: true, copyText: query };
  } catch {
    return { url: lib.collectionUrl, isDeepLink: false, copyText: query };
  }
}
