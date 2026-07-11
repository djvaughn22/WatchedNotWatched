// Browsable genres for the Top 100 pages, with TMDB's public genre ids.
// Horror is intentionally absent, and every discover query also excludes it
// (without_genres) and adult content (include_adult=false) — DJ's rule.

export const EXCLUDED_GENRE_IDS = { horror: 27 };

export interface BrowseGenre {
  id: number;
  label: string;
}

export const MOVIE_GENRES: BrowseGenre[] = [
  { id: 28, label: "Action" },
  { id: 12, label: "Adventure" },
  { id: 16, label: "Animation" },
  { id: 35, label: "Comedy" },
  { id: 80, label: "Crime" },
  { id: 99, label: "Documentary" },
  { id: 18, label: "Drama" },
  { id: 10751, label: "Family" },
  { id: 14, label: "Fantasy" },
  { id: 36, label: "History" },
  { id: 10402, label: "Music" },
  { id: 9648, label: "Mystery" },
  { id: 10749, label: "Romance" },
  { id: 878, label: "Sci-Fi" },
  { id: 53, label: "Thriller" },
  { id: 10752, label: "War" },
  { id: 37, label: "Western" },
];

export const TV_GENRES: BrowseGenre[] = [
  { id: 10759, label: "Action & Adventure" },
  { id: 16, label: "Animation" },
  { id: 35, label: "Comedy" },
  { id: 80, label: "Crime" },
  { id: 99, label: "Documentary" },
  { id: 18, label: "Drama" },
  { id: 10751, label: "Family" },
  { id: 10762, label: "Kids" },
  { id: 9648, label: "Mystery" },
  { id: 10765, label: "Sci-Fi & Fantasy" },
  { id: 10768, label: "War & Politics" },
  { id: 37, label: "Western" },
];

export const DECADES = [
  { id: "1980", label: "’80s" },
  { id: "1990", label: "’90s" },
  { id: "2000", label: "2000s" },
  { id: "2010", label: "2010s" },
  { id: "2020", label: "2020s" },
] as const;

export type DecadeId = (typeof DECADES)[number]["id"];

export function isValidDecade(v: string): v is DecadeId {
  return DECADES.some((d) => d.id === v);
}

export function isValidGenre(mediaType: "movie" | "series", id: number): boolean {
  const list = mediaType === "series" ? TV_GENRES : MOVIE_GENRES;
  return list.some((g) => g.id === id);
}
