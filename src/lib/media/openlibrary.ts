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

function olFetch(url: string, signal?: AbortSignal): Promise<Response> {
  return fetch(url, { signal: withTimeout(signal), headers: { "User-Agent": USER_AGENT } });
}

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
        const response = await olFetch(`${API}${key}.json`, signal);
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
 * indexes at the work level. */
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
    const response = await olFetch(`${API}/search.json?${params}`, signal);
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

    async getTitle(sourceId): Promise<MediaTitle | null> {
      const response = await olFetch(`${API}/works/${encodeURIComponent(sourceId)}.json`);
      if (!response.ok) return null;
      const work = (await response.json()) as OpenLibraryWork;
      if (!work.title) return null;
      const [creators, facts] = await Promise.all([
        fetchAuthorNames(work),
        fetchEditionFacts(sourceId),
      ]);
      const description = typeof work.description === "string" ? work.description : work.description?.value;
      const coverId = work.covers?.find((id) => id > 0);
      return {
        id: `openlibrary:${sourceId}`,
        source: "openlibrary",
        sourceId,
        mediaType: "book",
        title: work.title,
        creators,
        releaseYear: yearOf(work.first_publish_date),
        synopsis: description,
        posterUrl: coverId ? coverUrl(coverId, "L") : facts.isbn ? isbnCoverUrl(facts.isbn, "L") : undefined,
        genres: work.subjects?.slice(0, 6),
        dataStatus: "live",
        updatedAt: new Date().toISOString(),
        book: { workKey: sourceId, ...facts },
        attribution: [
          {
            source: "Open Library",
            text: "Book data from Open Library",
            url: `${API}/works/${sourceId}`,
          },
        ],
      };
    },
  };
}
