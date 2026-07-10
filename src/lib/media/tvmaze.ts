// TVmaze metadata adapter (SERVER ONLY).
// Free, keyless API for television search and metadata.
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

const BASE = "https://api.tvmaze.com";
const TIMEOUT_MS = 8000;

const TVMAZE_ATTRIBUTION: AttributionReference = {
  source: "TVmaze",
  text: "Television data from TVmaze.",
  url: "https://www.tvmaze.com/",
};

interface TVmazeShow {
  id: number;
  name: string;
  type?: string;
  language?: string;
  genres?: string[];
  status?: string;
  runtime?: number;
  premiered?: string;
  ended?: string;
  officialSite?: string;
  summary?: string;
  image?: { medium: string; original: string } | null;
  rating?: { average: number | null };
}

async function tvmazeFetch<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort());
  try {
    const res = await fetch(`${BASE}${path}`, {
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

const yearOf = (d: string | undefined): number | undefined => {
  if (!d) return undefined;
  const match = d.match(/(\d{4})/);
  return match ? Number(match[1]) : undefined;
};

export function createTvmazeAdapter(): MediaMetadataAdapter {
  async function searchTitles(query: string, options?: SearchOptions): Promise<SearchResult> {
    const q = encodeURIComponent(query.trim());
    const data = await tvmazeFetch<Array<{ show: TVmazeShow }>>(
      `/search/shows?q=${q}`,
      options?.signal,
    );

    if (!data) {
      return {
        query,
        items: [],
        dataStatus: "unavailable",
        attribution: [TVMAZE_ATTRIBUTION],
      };
    }

    const items: SearchResultItem[] = data
      .slice(0, 12)
      .filter((r) => r.show && r.show.name)
      .map((r) => {
        const show = r.show;
        return {
          id: `tvmaze:${show.id}`,
          source: "tvmaze",
          sourceId: String(show.id),
          mediaType: "series" as MediaType,
          title: show.name,
          releaseYear: yearOf(show.premiered),
          posterUrl: show.image?.medium,
          dataStatus: "live" as const,
        };
      });

    return {
      query,
      items,
      dataStatus: "live",
      attribution: [TVMAZE_ATTRIBUTION],
    };
  }

  async function getTitle(sourceId: string): Promise<MediaTitle | null> {
    const show = await tvmazeFetch<TVmazeShow>(`/shows/${sourceId}`);
    if (!show || !show.name) return null;

    const synopsis = show.summary
      ? show.summary.replace(/<[^>]*>/g, "").trim()
      : undefined;

    return {
      id: `tvmaze:${sourceId}`,
      source: "tvmaze",
      sourceId,
      mediaType: "series",
      title: show.name,
      releaseYear: yearOf(show.premiered),
      synopsis,
      posterUrl: show.image?.original ?? show.image?.medium,
      runtimeMinutes: show.runtime,
      genres: show.genres?.filter(Boolean),
      officialRating: undefined, // TVmaze doesn't provide MPAA/TV ratings
      guidance: notReviewedGuidance([...ALL_CATEGORIES]),
      availability: [],
      attribution: [TVMAZE_ATTRIBUTION],
      dataStatus: "live",
      updatedAt: new Date().toISOString(),
    };
  }

  return { id: "tvmaze", searchTitles, getTitle };
}
