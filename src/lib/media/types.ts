// Normalized internal media model. The UI consumes THIS, never a raw external
// API shape. External response types stay inside adapters.

export type MediaType = "movie" | "series" | "episode" | "video";

export type DataStatus = "live" | "cached" | "editorial" | "sample" | "unavailable";

export interface ProviderAvailability {
  providerId: string; // maps to providers.ts ids where possible
  providerName: string;
  monetization?: "sub" | "rent" | "buy" | "free" | "ads" | "unknown";
  region: string;
}

export interface TrailerReference {
  youtubeId: string;
  title: string;
  channelTitle?: string;
  official: boolean; // only true when there is adequate evidence
}

export interface AttributionReference {
  source: string; // "TMDB", "JustWatch", "TVmaze", "YouTube"
  text: string;
  url?: string;
}

export interface MediaTitle {
  id: string; // internal id: `${source}:${sourceId}`
  source: string; // "tmdb" | "sample" | ...
  sourceId: string;
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  releaseYear?: number;
  synopsis?: string;
  posterUrl?: string;
  backdropUrl?: string;
  runtimeMinutes?: number;
  genres?: string[];
  officialRating?: string;
  availability?: ProviderAvailability[];
  watchOptionsUrl?: string; // e.g. a TMDB/JustWatch watch page
  trailer?: TrailerReference;
  attribution?: AttributionReference[];
  dataStatus: DataStatus;
  updatedAt?: string;
}

export interface SearchOptions {
  region?: string;
  signal?: AbortSignal;
}

export interface SearchResultItem {
  id: string;
  source: string;
  sourceId: string;
  mediaType: MediaType;
  title: string;
  releaseYear?: number;
  posterUrl?: string;
  officialRating?: string;
  voteAverage?: number; // TMDB user score, 0–10
  dataStatus: DataStatus;
}

export interface SearchResult {
  query: string;
  items: SearchResultItem[];
  dataStatus: DataStatus;
  attribution: AttributionReference[];
}

export interface MediaMetadataAdapter {
  id: string;
  searchTitles(query: string, options?: SearchOptions): Promise<SearchResult>;
  getTitle(sourceId: string, mediaType: MediaType): Promise<MediaTitle | null>;
  getProviders?(sourceId: string, mediaType: MediaType, region: string): Promise<ProviderAvailability[]>;
  getSimilar?(sourceId: string, mediaType: MediaType): Promise<SearchResultItem[]>;
}
