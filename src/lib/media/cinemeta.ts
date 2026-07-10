// Cinemeta metadata adapter (SERVER-friendly, keyless, free).
// Cinemeta is the public IMDb-based metadata service used by Stremio. No API
// key, no commercial plan. It provides title/year/poster/genre/plot/IMDb score
// and IMDb ids — but NOT an official MPAA/TV content rating and NOT streaming
// availability, so guidance stays "not-reviewed" and where-to-watch uses
// provider search handoffs.
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

const BASE = "https://v3-cinemeta.strem.io";
const TIMEOUT_MS = 8000;

const ATTRIBUTION: AttributionReference = {
  source: "Cinemeta / IMDb",
  text: "Title metadata from Cinemeta (IMDb-based). Ratings are IMDb user scores, not content ratings.",
  url: "https://www.stremio.com/",
};

interface CinemetaMeta {
  id?: string; // imdb id "tt..."
  type?: string;
  name?: string;
  poster?: string;
  background?: string;
  releaseInfo?: string;
  year?: string;
  imdbRating?: string;
  runtime?: string;
  genres?: string[];
  description?: string;
}

async function cinemetaFetch<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort());
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal, next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const yearOf = (m: CinemetaMeta) => {
  const s = (m.releaseInfo || m.year || "").match(/\d{4}/);
  return s ? Number(s[0]) : undefined;
};
const runtimeOf = (m: CinemetaMeta) => {
  const s = (m.runtime || "").match(/\d+/);
  return s ? Number(s[0]) : undefined;
};

export function createCinemetaAdapter(): MediaMetadataAdapter {
  async function searchTitles(query: string, options?: SearchOptions): Promise<SearchResult> {
    const q = encodeURIComponent(query);
    const [movies, series] = await Promise.all([
      cinemetaFetch<{ metas?: CinemetaMeta[] }>(`/catalog/movie/top/search=${q}.json`, options?.signal),
      cinemetaFetch<{ metas?: CinemetaMeta[] }>(`/catalog/series/top/search=${q}.json`, options?.signal),
    ]);
    if (!movies && !series) {
      return { query, items: [], dataStatus: "unavailable", attribution: [ATTRIBUTION] };
    }
    const toItem = (m: CinemetaMeta, mediaType: MediaType): SearchResultItem | null => {
      if (!m.id || !m.name) return null;
      return {
        id: `cinemeta:${m.id}`,
        source: "cinemeta",
        sourceId: m.id,
        mediaType,
        title: m.name,
        releaseYear: yearOf(m),
        posterUrl: m.poster,
        dataStatus: "live",
      };
    };
    const mItems = (movies?.metas ?? []).map((m) => toItem(m, "movie")).filter(Boolean) as SearchResultItem[];
    const sItems = (series?.metas ?? []).map((m) => toItem(m, "series")).filter(Boolean) as SearchResultItem[];
    // Interleave a little so a series match isn't buried under 16 movies.
    const items: SearchResultItem[] = [];
    const max = Math.max(mItems.length, sItems.length);
    for (let i = 0; i < max && items.length < 16; i++) {
      if (mItems[i]) items.push(mItems[i]);
      if (sItems[i] && items.length < 16) items.push(sItems[i]);
    }
    return { query, items, dataStatus: "live", attribution: [ATTRIBUTION] };
  }

  async function getTitle(sourceId: string, mediaType: MediaType): Promise<MediaTitle | null> {
    const type = mediaType === "series" || mediaType === "episode" ? "series" : "movie";
    const d = await cinemetaFetch<{ meta?: CinemetaMeta }>(`/meta/${type}/${encodeURIComponent(sourceId)}.json`);
    const m = d?.meta;
    if (!m || !m.name) return null;
    const imdb = m.imdbRating ? `IMDb ${m.imdbRating}/10.` : "";
    return {
      id: `cinemeta:${sourceId}`,
      source: "cinemeta",
      sourceId,
      mediaType: type === "series" ? "series" : "movie",
      title: m.name,
      releaseYear: yearOf(m),
      synopsis: m.description || undefined,
      posterUrl: m.poster,
      backdropUrl: m.background,
      runtimeMinutes: runtimeOf(m),
      genres: Array.isArray(m.genres) ? m.genres : undefined,
      officialRating: undefined, // Cinemeta has no MPAA/TV content rating
      guidance: notReviewedGuidance([...ALL_CATEGORIES]),
      availability: [], // no availability data; UI offers provider search
      attribution: [{ ...ATTRIBUTION, text: `${ATTRIBUTION.text} ${imdb}`.trim() }],
      dataStatus: "live",
      updatedAt: new Date().toISOString(),
    };
  }

  return { id: "cinemeta", searchTitles, getTitle };
}
