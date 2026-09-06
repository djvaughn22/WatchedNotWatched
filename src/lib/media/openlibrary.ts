import type { MediaMetadataAdapter, MediaTitle, SearchResult, SearchResultItem } from "./types";

const API = "https://openlibrary.org";
const COVER = "https://covers.openlibrary.org/b";

type OpenLibrarySearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
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

function coverUrl(id: number | undefined, size: "M" | "L" = "M"): string | undefined {
  return id ? `${COVER}/id/${id}-${size}.jpg` : undefined;
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

async function fetchAuthorNames(work: OpenLibraryWork): Promise<string[]> {
  const keys = (work.authors ?? [])
    .map((item) => item.author?.key)
    .filter((key): key is string => !!key)
    .slice(0, 3);
  const authors = await Promise.all(
    keys.map(async (key) => {
      try {
        const response = await fetch(`${API}${key}.json`);
        if (!response.ok) return null;
        return ((await response.json()) as OpenLibraryAuthor).name ?? null;
      } catch {
        return null;
      }
    }),
  );
  return authors.filter((name): name is string => !!name);
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
      const response = await fetch(`${API}/search.json?${params}`, { signal: options?.signal });
      if (!response.ok) throw new Error(`Open Library search failed: ${response.status}`);
      const raw = (await response.json()) as { docs?: OpenLibrarySearchDoc[] };
      return {
        query,
        items: (raw.docs ?? [])
          .map(normalizeOpenLibrarySearchDoc)
          .filter((item): item is SearchResultItem => !!item),
        dataStatus: "live",
        attribution: [{ source: "Open Library", text: "Book data from Open Library", url: "https://openlibrary.org" }],
      };
    },

    async getTitle(sourceId): Promise<MediaTitle | null> {
      const response = await fetch(`${API}/works/${encodeURIComponent(sourceId)}.json`);
      if (!response.ok) return null;
      const work = (await response.json()) as OpenLibraryWork;
      if (!work.title) return null;
      const creators = await fetchAuthorNames(work);
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
        posterUrl: coverUrl(coverId, "L"),
        genres: work.subjects?.slice(0, 6),
        dataStatus: "live",
        updatedAt: new Date().toISOString(),
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
