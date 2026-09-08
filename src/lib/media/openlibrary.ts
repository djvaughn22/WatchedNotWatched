import type { MediaMetadataAdapter, MediaTitle, SearchResult, SearchResultItem } from "./types";

const API = "https://openlibrary.org";
const COVER = "https://covers.openlibrary.org/b";
// Identifies the app per Open Library's usage guidance (human-triggered, low
// volume); no private contact address is exposed.
const USER_AGENT = "WatchedNotWatched/1.0 (+https://watchednotwatched.com)";
const REQUEST_TIMEOUT_MS = 9000;

type OpenLibrarySearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  publisher?: string[];
  language?: string[];
  number_of_pages_median?: number;
  subject?: string[];
  edition_key?: string[];
};

type OpenLibraryWork = {
  key?: string;
  title?: string;
  description?: string | { value?: string };
  first_publish_date?: string;
  covers?: number[];
  subjects?: string[];
  authors?: Array<{ author?: { key?: string } }>;
  // Open Library returns HTTP 200 with this shape (not a 404, not an HTTP
  // redirect) for a work id that was merged into another — a stale-but-valid
  // link, not a missing book. Confirmed via direct testing during this fix.
  type?: { key?: string };
  location?: string;
};

type OpenLibraryAuthor = { name?: string };

function workId(key: string | undefined): string | null {
  const match = key?.match(/^\/works\/([^/]+)$/);
  return match?.[1] ?? null;
}

function yearOf(value: string | undefined): number | undefined {
  const match = value?.match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : undefined;
}

/** Merge an external signal (request cancellation) with a hard timeout so a
 * slow Open Library response can never hang past the serverless function's
 * own budget — an honest "unavailable" beats a silent freeze. */
function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function olFetch(url: string, signal?: AbortSignal, revalidateSeconds?: number): Promise<Response> {
  return fetch(url, {
    signal: withTimeout(signal),
    headers: { "User-Agent": USER_AGENT },
    // Work/author/edition records change rarely — letting Next's Data Cache
    // hold a successful response by URL (which already embeds the stable
    // Open Library work id) means the *next* reader of the same book skips
    // Open Library's own latency entirely, not just this one.
    ...(revalidateSeconds !== undefined ? { next: { revalidate: revalidateSeconds } } : {}),
  });
}

/** A confirmed "this book does not exist" — distinct from a timeout, 429, or
 * 5xx, which are transient and must never be presented as a permanent 404. */
export class OpenLibraryNotFoundError extends Error {}

/** `?default=false` makes a missing cover 404 instead of silently returning
 * Open Library's generic icon, so the UI can detect it and fall back cleanly. */
function coverUrl(id: number | undefined, size: "M" | "L" = "M"): string | undefined {
  return id ? `${COVER}/id/${id}-${size}.jpg?default=false` : undefined;
}

export function isbnCoverUrl(isbn: string, size: "M" | "L" = "M"): string {
  return `${COVER}/isbn/${encodeURIComponent(isbn)}-${size}.jpg?default=false`;
}

export function normalizeOpenLibrarySearchDoc(doc: OpenLibrarySearchDoc): SearchResultItem | null {
  const sourceId = workId(doc.key);
  if (!sourceId || !doc.title) return null;
  return {
    id: `openlibrary:${sourceId}`,
    source: "openlibrary",
    sourceId,
    mediaType: "book",
    title: doc.title,
    creators: doc.author_name?.filter(Boolean).slice(0, 3),
    releaseYear: doc.first_publish_year,
    posterUrl: coverUrl(doc.cover_i),
    dataStatus: "live",
  };
}

const ATTRIBUTION = [{ source: "Open Library", text: "Book data from Open Library", url: "https://openlibrary.org" }];

async function search(params: URLSearchParams, signal?: AbortSignal): Promise<SearchResultItem[]> {
  const response = await olFetch(`${API}/search.json?${params}`, signal);
  if (!response.ok) throw new Error(`Open Library search failed: ${response.status}`);
  const raw = (await response.json()) as { docs?: OpenLibrarySearchDoc[] };
  return (raw.docs ?? []).map(normalizeOpenLibrarySearchDoc).filter((item): item is SearchResultItem => !!item);
}

function dedupeByWork(items: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>();
  return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
}

/** Books by the same author, for the related-books / recommendation deck. Excludes `excludeIds` (already-classified or seed works). */
export async function relatedByAuthor(
  authorName: string,
  excludeIds: Set<string>,
  limit = 12,
  signal?: AbortSignal,
): Promise<SearchResultItem[]> {
  const params = new URLSearchParams({
    q: `author:"${authorName}"`,
    fields: "key,title,author_name,first_publish_year,cover_i",
    limit: String(limit + excludeIds.size),
  });
  const items = await search(params, signal);
  return dedupeByWork(items.filter((it) => !excludeIds.has(it.id))).slice(0, limit);
}

/** Books in a subject, sorted by rating where Open Library has enough votes to rank. */
export async function relatedBySubject(
  subject: string,
  excludeIds: Set<string>,
  limit = 12,
  signal?: AbortSignal,
): Promise<SearchResultItem[]> {
  const params = new URLSearchParams({
    q: `subject:"${subject}"`,
    sort: "rating",
    fields: "key,title,author_name,first_publish_year,cover_i",
    limit: String(limit + excludeIds.size),
  });
  const items = await search(params, signal);
  return dedupeByWork(items.filter((it) => !excludeIds.has(it.id))).slice(0, limit);
}

type TrendingWork = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
};

/** Open Library's daily trending list — an honest, non-personalized cold start. */
export async function trendingBooks(limit = 24, signal?: AbortSignal): Promise<SearchResultItem[]> {
  const response = await olFetch(`${API}/trending/daily.json?limit=${limit}`, signal);
  if (!response.ok) throw new Error(`Open Library trending failed: ${response.status}`);
  const raw = (await response.json()) as { works?: TrendingWork[] };
  return dedupeByWork(
    (raw.works ?? [])
      .map((w) =>
        normalizeOpenLibrarySearchDoc({
          key: w.key,
          title: w.title,
          author_name: w.author_name,
          first_publish_year: w.first_publish_year,
          cover_i: w.cover_i,
        }),
      )
      .filter((item): item is SearchResultItem => !!item),
  );
}

async function fetchAuthorNames(work: OpenLibraryWork, signal?: AbortSignal): Promise<string[]> {
  const keys = (work.authors ?? [])
    .map((item) => item.author?.key)
    .filter((key): key is string => !!key)
    .slice(0, 3);
  const authors = await Promise.all(
    keys.map(async (key) => {
      try {
        const response = await olFetch(`${API}${key}.json`, signal, 3600);
        if (!response.ok) return null;
        return ((await response.json()) as OpenLibraryAuthor).name ?? null;
      } catch {
        return null;
      }
    }),
  );
  return authors.filter((name): name is string => !!name);
}

/** One follow-up call for the single work being viewed — not per search result — to
 * surface edition facts (ISBN, publisher, language, page count) search.json already
 * indexes at the work level. Never throws: a failed enrichment call must not
 * take down the whole detail page, so it degrades to "no extra facts" instead. */
async function fetchEditionFacts(
  workKey: string,
  signal?: AbortSignal,
): Promise<{ isbn?: string; publisher?: string; language?: string; pageCount?: number; editionKey?: string }> {
  try {
    const params = new URLSearchParams({
      q: `key:/works/${workKey}`,
      fields: "isbn,publisher,language,number_of_pages_median,edition_key",
      limit: "1",
    });
    const response = await olFetch(`${API}/search.json?${params}`, signal, 3600);
    if (!response.ok) return {};
    const raw = (await response.json()) as { docs?: OpenLibrarySearchDoc[] };
    const doc = raw.docs?.[0];
    if (!doc) return {};
    return {
      isbn: doc.isbn?.[0],
      publisher: doc.publisher?.[0],
      language: doc.language?.[0],
      pageCount: doc.number_of_pages_median,
      editionKey: doc.edition_key?.[0],
    };
  } catch {
    return {};
  }
}

type OpenLibraryAvailability = {
  status?: string;
  is_readable?: boolean;
  is_lendable?: boolean;
  available_to_borrow?: boolean;
  available_to_waitlist?: boolean;
  error_message?: string;
};

export interface BookAvailability {
  /** Genuinely free to read right now — the strongest, rarest claim. */
  readable: boolean;
  /** Can be borrowed right now (controlled digital lending). */
  borrowable: boolean;
  /** Lendable in principle but not free-to-borrow this moment (waitlist). */
  waitlisted: boolean;
  url: string;
}

/** Bibliographic existence is not lending availability — this is the ONLY
 * source of truth for whether "Read free" / "Borrow" may be shown. A failed
 * or inconclusive check returns null, which callers must treat as "don't
 * claim availability," never as "assume available." */
export async function checkBookAvailability(workKey: string, signal?: AbortSignal): Promise<BookAvailability | null> {
  try {
    const response = await olFetch(
      `${API}/availability/v2?type=openlibrary_work&ids=${encodeURIComponent(workKey)}`,
      signal,
      3600,
    );
    if (!response.ok) return null;
    const raw = (await response.json()) as Record<string, OpenLibraryAvailability>;
    const entry = raw[workKey];
    if (!entry || entry.status === "error" || entry.error_message) return null;
    return {
      readable: entry.is_readable === true,
      borrowable: entry.available_to_borrow === true,
      waitlisted: entry.is_lendable === true && entry.available_to_borrow !== true && entry.is_readable !== true,
      url: `${API}/works/${workKey}`,
    };
  } catch {
    return null;
  }
}

/** Fetches the work record with one retry on a transient failure. A genuine
 * 404 from Open Library is NOT retried and is thrown as a distinct error type
 * so callers can tell "this book doesn't exist" apart from "Open Library was
 * briefly unreachable" — conflating the two is the root cause of the
 * first-click failure this module exists to prevent. */
export interface ResolvedWork {
  work: OpenLibraryWork;
  /** The work id actually used, after following any merge redirect. */
  workId: string;
}

/** A work that was merged into another returns HTTP 200 (not a 404, not an
 * HTTP redirect) with `{type: {key: "/type/redirect"}, location: "/works/..."}`
 * — a stale-but-valid link, not a missing book. Confirmed via direct testing:
 * treating this as "not found" would break every old link to a merged work. */
function isRedirectStub(work: OpenLibraryWork): boolean {
  return work.type?.key === "/type/redirect" && !!work.location;
}

async function fetchWorkOnce(sourceId: string, signal?: AbortSignal): Promise<OpenLibraryWork> {
  const response = await olFetch(`${API}/works/${encodeURIComponent(sourceId)}.json`, signal, 3600);
  if (response.status === 404) throw new OpenLibraryNotFoundError(`Open Library work not found: ${sourceId}`);
  if (!response.ok) throw new Error(`Open Library work fetch failed: ${response.status}`);
  return (await response.json()) as OpenLibraryWork;
}

/** Fetches the work record with one retry on a transient failure, following
 * at most one merge redirect. A genuine 404 (or an empty/missing title with
 * no redirect) is NOT retried and is thrown as a distinct error type so
 * callers can tell "this book doesn't exist" apart from "Open Library was
 * briefly unreachable" — conflating the two is the root cause of the
 * first-click failure this module exists to prevent. */
async function fetchWork(sourceId: string, signal?: AbortSignal): Promise<ResolvedWork> {
  const attempt = async (): Promise<ResolvedWork> => {
    let id = sourceId;
    let work = await fetchWorkOnce(id, signal);
    if (isRedirectStub(work)) {
      const nextId = workId(work.location) ?? work.location!.replace(/^\/works\//, "");
      id = nextId;
      work = await fetchWorkOnce(id, signal);
    }
    if (!work.title) throw new OpenLibraryNotFoundError(`Open Library work has no title: ${sourceId}`);
    return { work, workId: id };
  };
  try {
    return await attempt();
  } catch (e) {
    if (e instanceof OpenLibraryNotFoundError) throw e; // confirmed absent — retrying won't change that
    if (signal?.aborted) throw e; // caller gave up
    return await attempt();
  }
}

// Uses the RESOLVED (canonical) work id, never the id the caller originally
// asked for — a stale link to a merged work must settle on one identity so a
// saved library entry and a future visit to the canonical url are the same
// row, not two.
function buildCoreTitle(resolved: ResolvedWork): MediaTitle {
  const { work, workId: canonicalId } = resolved;
  const description = typeof work.description === "string" ? work.description : work.description?.value;
  const coverId = work.covers?.find((id) => id > 0);
  return {
    id: `openlibrary:${canonicalId}`,
    source: "openlibrary",
    sourceId: canonicalId,
    mediaType: "book",
    title: work.title!,
    creators: [],
    releaseYear: yearOf(work.first_publish_date),
    synopsis: description,
    posterUrl: coverId ? coverUrl(coverId, "L") : undefined,
    genres: work.subjects?.slice(0, 6),
    dataStatus: "live",
    updatedAt: new Date().toISOString(),
    book: { workKey: canonicalId },
    attribution: [
      {
        source: "Open Library",
        text: "Book data from Open Library",
        url: `${API}/works/${canonicalId}`,
      },
    ],
  };
}

/**
 * Tier 1 — the essential detail shell: title, cover, synopsis, subjects, and
 * publication year all live directly on the work record, so this is a single
 * fast call (with retry) and nothing here blocks on author or edition
 * enrichment. Throws OpenLibraryNotFoundError for a confirmed-absent work,
 * or a generic Error for a transient failure — never returns a false null.
 */
export async function getTitleCore(sourceId: string, signal?: AbortSignal): Promise<MediaTitle> {
  const resolved = await fetchWork(sourceId, signal);
  return buildCoreTitle(resolved);
}

export interface TitleExtendedPatch {
  creators: string[];
  book: { isbn?: string; publisher?: string; language?: string; pageCount?: number; editionKey?: string };
  availability: BookAvailability | null;
}

/**
 * Tier 2 — author names, edition facts (ISBN/publisher/language/pages), and
 * lending availability. Each sub-call is independently fault-tolerant
 * (fetchAuthorNames/fetchEditionFacts/checkBookAvailability never throw), so
 * this whole tier degrades to partial or empty data instead of failing the
 * page that already rendered from tier 1. Re-fetches the work record, but
 * that hits Next's Data Cache from the tier-1 call moments earlier.
 */
export async function getTitleExtended(sourceId: string, signal?: AbortSignal): Promise<TitleExtendedPatch> {
  const { work, workId: canonicalId } = await fetchWork(sourceId, signal);
  const [creators, facts, availability] = await Promise.all([
    fetchAuthorNames(work, signal),
    fetchEditionFacts(canonicalId, signal),
    checkBookAvailability(canonicalId, signal),
  ]);
  return { creators, book: facts, availability };
}

export function createOpenLibraryAdapter(): MediaMetadataAdapter {
  return {
    id: "openlibrary",

    async searchTitles(query, options): Promise<SearchResult> {
      const params = new URLSearchParams({
        q: query,
        fields: "key,title,author_name,first_publish_year,cover_i",
        limit: "24",
      });
      // Open Library's latency on common-word queries is genuinely bimodal
      // (often ~2s, sometimes 8-10s+). One retry on a timed-out/failed first
      // attempt meaningfully raises the odds of a real answer within the
      // caller's own budget, instead of surfacing a retryable error for what
      // is usually just a slow draw.
      let items: SearchResultItem[];
      try {
        items = await search(params, options?.signal);
      } catch (e) {
        if (options?.signal?.aborted) throw e; // caller gave up — don't retry
        items = await search(params, options?.signal);
      }
      return { query, items, dataStatus: "live", attribution: ATTRIBUTION };
    },

    /** Full one-shot fetch for internal server-to-server callers (related-books
     * lookups) that want the complete record in one call. The client-facing
     * detail page uses getTitleCore/getTitleExtended instead, so it can render
     * before enrichment finishes — see that pair for the reliability contract. */
    async getTitle(sourceId): Promise<MediaTitle | null> {
      try {
        const core = await getTitleCore(sourceId);
        const patch = await getTitleExtended(sourceId).catch(() => null);
        if (!patch) return core;
        return { ...core, creators: patch.creators, book: { workKey: sourceId, ...patch.book } };
      } catch (e) {
        if (e instanceof OpenLibraryNotFoundError) return null;
        throw e;
      }
    },
  };
}
