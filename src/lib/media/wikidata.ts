// Wikidata metadata adapter (SERVER ONLY).
// Free, CC0 API for movie and general title metadata.
// Approved for commercial use.
import { ALL_CATEGORIES } from "../filter/types";
import { notReviewedGuidance } from "../guidance";
import type {
  AttributionReference,
  MediaMetadataAdapter,
  MediaTitle,
  MediaType,
  SearchOptions,
  SearchResult,
  SearchResultItem,
} from "./types";

const TIMEOUT_MS = 8000;

const WIKIDATA_ATTRIBUTION: AttributionReference = {
  source: "Wikidata",
  text: "Title data from Wikidata (CC0 1.0).",
  url: "https://www.wikidata.org/",
};

interface WikidataEntity {
  id: string; // "Q123456"
  type: string;
  labels?: Record<string, { language: string; value: string }>;
  descriptions?: Record<string, { language: string; value: string }>;
  claims?: Record<string, Array<{ mainsnak?: { datatype?: string; datavalue?: { value: unknown } } }>>;
}

interface WikidataSearchResult {
  label: string;
  description?: string;
  id: string; // "Q123456"
}

async function wikiDataFetch<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort());
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "WatchedNotWatched/1.0" },
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const getClaimValue = (claims: Record<string, unknown[]> | undefined, prop: string): unknown => {
  const list = claims?.[prop] as Array<{ mainsnak?: { datavalue?: { value: unknown } } }> | undefined;
  return list?.[0]?.mainsnak?.datavalue?.value;
};

const extractYear = (dateStr: unknown): number | undefined => {
  if (typeof dateStr === "string") {
    const match = dateStr.match(/(\d{4})/);
    return match ? Number(match[1]) : undefined;
  }
  if (typeof dateStr === "object" && dateStr !== null) {
    const obj = dateStr as Record<string, unknown>;
    const time = obj.time;
    if (typeof time === "string") {
      const match = time.match(/(\d{4})/);
      return match ? Number(match[1]) : undefined;
    }
  }
  return undefined;
};

const isMovie = (claims: Record<string, unknown[]> | undefined): boolean => {
  const instanceOf = getClaimValue(claims, "P31") as Record<string, unknown> | undefined;
  if (!instanceOf || !instanceOf.id) return false;
  const id = String(instanceOf.id);
  // Q11424 = film; Q15416 = television series
  return id === "Q11424";
};

const isSeries = (claims: Record<string, unknown[]> | undefined): boolean => {
  const instanceOf = getClaimValue(claims, "P31") as Record<string, unknown> | undefined;
  if (!instanceOf || !instanceOf.id) return false;
  const id = String(instanceOf.id);
  return id === "Q15416" || id === "Q5398426"; // TV series or web series
};

export function createWikidataAdapter(): MediaMetadataAdapter {
  async function searchTitles(query: string, options?: SearchOptions): Promise<SearchResult> {
    const q = encodeURIComponent(query.trim());
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${q}&language=en&limit=12&format=json`;
    const data = await wikiDataFetch<{ search?: WikidataSearchResult[] }>(url, options?.signal);

    if (!data?.search) {
      return {
        query,
        items: [],
        dataStatus: "unavailable",
        attribution: [WIKIDATA_ATTRIBUTION],
      };
    }

    const items: SearchResultItem[] = data.search
      .filter((r) => r.id && r.label)
      .slice(0, 12)
      .map((r) => ({
        id: `wikidata:${r.id}`,
        source: "wikidata",
        sourceId: r.id,
        mediaType: "movie" as MediaType, // default; will refine on detail fetch
        title: r.label,
        releaseYear: undefined, // not in search results
        posterUrl: undefined,
        dataStatus: "live" as const,
      }));

    return {
      query,
      items,
      dataStatus: "live",
      attribution: [WIKIDATA_ATTRIBUTION],
    };
  }

  async function getTitle(sourceId: string, mediaType: MediaType): Promise<MediaTitle | null> {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${sourceId}.json`;
    const data = await wikiDataFetch<{ entities?: Record<string, WikidataEntity> }>(url);
    if (!data?.entities) return null;

    const entity = data.entities[sourceId];
    if (!entity) return null;

    const label = entity.labels?.en?.value || entity.labels?.[Object.keys(entity.labels || {})[0]]?.value;
    if (!label) return null;

    const description = entity.descriptions?.en?.value;
    const claims = entity.claims as Record<string, unknown[]> | undefined;

    // Infer media type from claims if not provided
    let finalMediaType: MediaType = mediaType;
    if (isMovie(claims)) finalMediaType = "movie";
    else if (isSeries(claims)) finalMediaType = "series";

    const releaseDate = getClaimValue(claims, "P580") ?? getClaimValue(claims, "P577"); // inception or publication date
    const releaseYear = extractYear(releaseDate);

    return {
      id: `wikidata:${sourceId}`,
      source: "wikidata",
      sourceId,
      mediaType: finalMediaType,
      title: label,
      releaseYear,
      synopsis: description,
      posterUrl: undefined, // Wikidata rarely has URLs we can use directly
      runtimeMinutes: undefined,
      genres: undefined,
      officialRating: undefined,
      guidance: notReviewedGuidance([...ALL_CATEGORIES]),
      availability: [],
      attribution: [WIKIDATA_ATTRIBUTION],
      dataStatus: "live",
      updatedAt: new Date().toISOString(),
    };
  }

  return { id: "wikidata", searchTitles, getTitle };
}
