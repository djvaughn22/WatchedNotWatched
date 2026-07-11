// TMDB metadata adapter (SERVER ONLY). Replaceable: the UI never imports this
// directly — it goes through the normalized model + API routes.
//
// Licensing: free with attribution while WatchedNotWatched is non-commercial
// (free, no ads, no revenue). Charging money requires TMDB's commercial
// license (~$149/mo) FIRST. Provider results are JustWatch data surfaced by
// TMDB and require JustWatch attribution.
import type {
  AttributionReference,
  MediaMetadataAdapter,
  MediaTitle,
  MediaType,
  ProviderAvailability,
  SearchOptions,
  SearchResult,
  SearchResultItem,
  TrailerReference,
} from "./types";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const TIMEOUT_MS = 8000;

const TMDB_ATTRIBUTION: AttributionReference = {
  source: "TMDB",
  text: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
  url: "https://www.themoviedb.org/",
};
const JUSTWATCH_ATTRIBUTION: AttributionReference = {
  source: "JustWatch",
  text: "Streaming availability data provided by JustWatch.",
  url: "https://www.justwatch.com/",
};

function authInit(): { headers: Record<string, string>; keyParam: string } | null {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (token) return { headers: { Authorization: `Bearer ${token}`, accept: "application/json" }, keyParam: "" };
  const key = process.env.TMDB_API_KEY;
  if (key) return { headers: { accept: "application/json" }, keyParam: `api_key=${key}` };
  return null;
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T | null> {
  const auth = authInit();
  if (!auth) return null;
  const search = new URLSearchParams(params);
  if (auth.keyParam) search.set("api_key", auth.keyParam.split("=")[1]);
  const url = `${BASE}${path}?${search.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort());
  try {
    const res = await fetch(url, {
      headers: auth.headers,
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

const img = (path: string | null | undefined, size: string) => (path ? `${IMG}/${size}${path}` : undefined);
const yearOf = (d?: string) => (d && d.length >= 4 ? Number(d.slice(0, 4)) : undefined);

// Map TMDB provider names to our internal registry ids where possible.
const PROVIDER_ID_MAP: Record<string, string> = {
  netflix: "netflix",
  "amazon prime video": "prime",
  "prime video": "prime",
  "apple tv": "appletv",
  "apple tv+": "appletv",
  "apple tv plus": "appletv",
  "disney plus": "disney",
  "disney+": "disney",
  hulu: "hulu",
  max: "max",
  "hbo max": "max",
  peacock: "peacock",
  "peacock premium": "peacock",
  "paramount plus": "paramount",
  "paramount+": "paramount",
  tubi: "tubi",
  "tubi tv": "tubi",
  "pluto tv": "pluto",
  youtube: "youtube",
};
const mapProviderId = (name: string) => PROVIDER_ID_MAP[name.trim().toLowerCase()] ?? "";

interface TmdbSearchResponse {
  results?: Array<{
    id: number;
    media_type?: string;
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string | null;
  }>;
}

export interface TmdbAdapter extends MediaMetadataAdapter {
  discoverTop(opts: {
    mediaType: "movie" | "series";
    decade?: string;
    genreId?: number;
    page: number;
  }): Promise<SearchResultItem[]>;
}

export function createTmdbAdapter(): TmdbAdapter {
  const region = process.env.DEFAULT_WATCH_REGION || "US";

  async function searchTitles(query: string, options?: SearchOptions): Promise<SearchResult> {
    const attribution = [TMDB_ATTRIBUTION];
    const data = await tmdbFetch<TmdbSearchResponse>(
      "/search/multi",
      { query, include_adult: "false", language: "en-US", page: "1" },
      options?.signal,
    );
    if (!data) return { query, items: [], dataStatus: "unavailable", attribution };

    const items: SearchResultItem[] = (data.results ?? [])
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .slice(0, 12)
      .map((r) => {
        const mediaType: MediaType = r.media_type === "tv" ? "series" : "movie";
        return {
          id: `tmdb:${r.id}`,
          source: "tmdb",
          sourceId: String(r.id),
          mediaType,
          title: (r.title ?? r.name ?? "").trim(),
          releaseYear: yearOf(r.release_date ?? r.first_air_date),
          posterUrl: img(r.poster_path, "w342"),
          dataStatus: "live" as const,
        };
      })
      .filter((r) => r.title);

    return { query, items, dataStatus: "live", attribution };
  }

  async function getTitle(sourceId: string, mediaType: MediaType): Promise<MediaTitle | null> {
    const isTv = mediaType === "series" || mediaType === "episode";
    const path = isTv ? `/tv/${sourceId}` : `/movie/${sourceId}`;
    const append = isTv ? "content_ratings,watch/providers,videos" : "release_dates,watch/providers,videos";
    const d = await tmdbFetch<Record<string, unknown>>(path, { language: "en-US", append_to_response: append });
    if (!d) return null;

    const title = String((d.title as string) ?? (d.name as string) ?? "").trim();
    if (!title) return null;

    const officialRating = extractRating(d, isTv, region);
    const { availability, watchOptionsUrl } = extractProviders(d, region);
    const attribution: AttributionReference[] = [TMDB_ATTRIBUTION];
    if (availability.length || watchOptionsUrl) attribution.push(JUSTWATCH_ATTRIBUTION);

    return {
      id: `tmdb:${sourceId}`,
      source: "tmdb",
      sourceId,
      mediaType: isTv ? "series" : "movie",
      title,
      originalTitle: (d.original_title as string) ?? (d.original_name as string) ?? undefined,
      releaseYear: yearOf((d.release_date as string) ?? (d.first_air_date as string)),
      synopsis: (d.overview as string) || undefined,
      posterUrl: img(d.poster_path as string, "w500"),
      backdropUrl: img(d.backdrop_path as string, "w780"),
      runtimeMinutes: (d.runtime as number) ?? (Array.isArray(d.episode_run_time) ? (d.episode_run_time as number[])[0] : undefined),
      genres: Array.isArray(d.genres) ? (d.genres as Array<{ name: string }>).map((g) => g.name).filter(Boolean) : undefined,
      officialRating,
      availability,
      watchOptionsUrl,
      trailer: extractTrailer(d),
      attribution,
      dataStatus: "live",
      updatedAt: new Date().toISOString(),
    };
  }

  async function getProviders(sourceId: string, mediaType: MediaType, r: string): Promise<ProviderAvailability[]> {
    const isTv = mediaType === "series" || mediaType === "episode";
    const path = isTv ? `/tv/${sourceId}/watch/providers` : `/movie/${sourceId}/watch/providers`;
    const d = await tmdbFetch<Record<string, unknown>>(path, {});
    if (!d) return [];
    return extractProviders({ "watch/providers": { results: d.results } }, r).availability;
  }

  /**
   * Top titles for a decade and/or genre, ranked by TMDB user ratings with a
   * vote floor so obscure titles don't outrank classics. Horror and adult
   * content are always excluded. One call = one TMDB page (20 titles).
   */
  async function discoverTop(opts: {
    mediaType: "movie" | "series";
    decade?: string; // "1980" … "2020"
    genreId?: number;
    page: number;
  }): Promise<SearchResultItem[]> {
    const isTv = opts.mediaType === "series";
    const dateField = isTv ? "first_air_date" : "primary_release_date";
    const params: Record<string, string> = {
      language: "en-US",
      sort_by: "vote_average.desc",
      "vote_count.gte": isTv ? "200" : "500",
      include_adult: "false",
      without_genres: "27", // no horror, per product rule
      page: String(opts.page),
    };
    if (opts.decade) {
      params[`${dateField}.gte`] = `${opts.decade}-01-01`;
      params[`${dateField}.lte`] = `${Number(opts.decade) + 9}-12-31`;
    }
    if (opts.genreId) params.with_genres = String(opts.genreId);

    const data = await tmdbFetch<TmdbListResponse>(isTv ? "/discover/tv" : "/discover/movie", params);
    return (data?.results ?? [])
      .map((r) => {
        const title = (r.title ?? r.name ?? "").trim();
        return {
          id: `tmdb:${r.id}`,
          source: "tmdb",
          sourceId: String(r.id),
          mediaType: opts.mediaType as MediaType,
          title,
          releaseYear: yearOf(r.release_date ?? r.first_air_date),
          posterUrl: img(r.poster_path, "w342"),
          dataStatus: "live" as const,
        };
      })
      .filter((r) => r.title);
  }

  /** Similar + recommended titles, deduped, recommendations first. */
  async function getSimilar(sourceId: string, mediaType: MediaType): Promise<SearchResultItem[]> {
    const isTv = mediaType === "series" || mediaType === "episode";
    const base = isTv ? `/tv/${sourceId}` : `/movie/${sourceId}`;
    const [rec, sim] = await Promise.all([
      tmdbFetch<TmdbListResponse>(`${base}/recommendations`, { language: "en-US", page: "1" }),
      tmdbFetch<TmdbListResponse>(`${base}/similar`, { language: "en-US", page: "1" }),
    ]);
    const seen = new Set<string>([sourceId]);
    const items: SearchResultItem[] = [];
    for (const r of [...(rec?.results ?? []), ...(sim?.results ?? [])]) {
      const id = String(r.id);
      const title = (r.title ?? r.name ?? "").trim();
      if (!title || seen.has(id)) continue;
      seen.add(id);
      items.push({
        id: `tmdb:${id}`,
        source: "tmdb",
        sourceId: id,
        mediaType: r.first_air_date || r.name ? "series" : "movie",
        title,
        releaseYear: yearOf(r.release_date ?? r.first_air_date),
        posterUrl: img(r.poster_path, "w342"),
        dataStatus: "live" as const,
      });
      if (items.length >= 12) break;
    }
    return items;
  }

  return { id: "tmdb", searchTitles, getTitle, getProviders, getSimilar, discoverTop };
}

interface TmdbListResponse {
  results?: Array<{
    id: number;
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string | null;
  }>;
}

/** Best trailer from the videos append: official YouTube trailer preferred. */
function extractTrailer(d: Record<string, unknown>): TrailerReference | undefined {
  const vids = ((d.videos as { results?: Array<{ key?: string; site?: string; type?: string; name?: string; official?: boolean }> })?.results ?? [])
    .filter((v) => v.key && v.site === "YouTube" && v.type === "Trailer");
  if (vids.length === 0) return undefined;
  const chosen = vids.find((v) => v.official) ?? vids[0];
  return {
    youtubeId: chosen.key!,
    title: chosen.name ?? "Trailer",
    official: chosen.official === true,
  };
}

function extractRating(d: Record<string, unknown>, isTv: boolean, region: string): string | undefined {
  try {
    if (isTv) {
      const results = ((d.content_ratings as { results?: Array<{ iso_3166_1: string; rating: string }> })?.results) ?? [];
      const match = results.find((x) => x.iso_3166_1 === region) ?? results[0];
      return match?.rating || undefined;
    }
    const results = ((d.release_dates as { results?: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> })?.results) ?? [];
    const match = results.find((x) => x.iso_3166_1 === region) ?? results[0];
    const cert = match?.release_dates?.map((r) => r.certification).find((c) => c && c.trim());
    return cert || undefined;
  } catch {
    return undefined;
  }
}

function extractProviders(d: Record<string, unknown>, region: string): { availability: ProviderAvailability[]; watchOptionsUrl?: string } {
  try {
    const wp = (d["watch/providers"] as { results?: Record<string, unknown> })?.results ?? {};
    const regionData = wp[region] as
      | { link?: string; flatrate?: Array<{ provider_name: string }>; rent?: Array<{ provider_name: string }>; buy?: Array<{ provider_name: string }>; ads?: Array<{ provider_name: string }>; free?: Array<{ provider_name: string }> }
      | undefined;
    if (!regionData) return { availability: [] };
    const availability: ProviderAvailability[] = [];
    const add = (list: Array<{ provider_name: string }> | undefined, monetization: ProviderAvailability["monetization"]) => {
      for (const p of list ?? []) {
        availability.push({
          providerId: mapProviderId(p.provider_name),
          providerName: p.provider_name,
          monetization,
          region,
        });
      }
    };
    add(regionData.flatrate, "sub");
    add(regionData.free, "free");
    add(regionData.ads, "ads");
    add(regionData.rent, "rent");
    add(regionData.buy, "buy");
    // Dedupe by name.
    const seen = new Set<string>();
    const deduped = availability.filter((a) => (seen.has(a.providerName) ? false : (seen.add(a.providerName), true)));
    return { availability: deduped, watchOptionsUrl: regionData.link };
  } catch {
    return { availability: [] };
  }
}
