// Recommendation preferences — on-device only (localStorage), adjustable any
// time, cleared with one tap. Cold-start chips write here too.

export const REC_PREFS_KEY = "wnw.recprefs.v1";

export const TONES = [
  "Light and funny",
  "Serious",
  "Exciting",
  "Comforting",
  "Family-friendly",
  "Surprise me",
] as const;

export interface RecPrefs {
  mediaType: "movie" | "series" | "either";
  tones: string[];
  dislikedGenres: string[];
  contentComfort: "family" | "standard" | "open";
  runtimeMaxMinutes?: number;
  /** User switch: never build or send a taste profile. */
  personalizationEnabled: boolean;
  /** Set once the user has been through cold start (or skipped it). */
  setupDone: boolean;
}

export function defaultPrefs(): RecPrefs {
  return {
    mediaType: "either",
    tones: [],
    dislikedGenres: [],
    contentComfort: "standard",
    runtimeMaxMinutes: undefined,
    personalizationEnabled: true,
    setupDone: false,
  };
}

export function sanitizePrefs(raw: unknown): RecPrefs {
  const d = defaultPrefs();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const runtime = Number(r.runtimeMaxMinutes);
  return {
    mediaType: r.mediaType === "movie" || r.mediaType === "series" ? r.mediaType : "either",
    tones: Array.isArray(r.tones) ? r.tones.filter((t): t is string => typeof t === "string").slice(0, 4) : [],
    dislikedGenres: Array.isArray(r.dislikedGenres)
      ? r.dislikedGenres.filter((g): g is string => typeof g === "string").slice(0, 6)
      : [],
    contentComfort: r.contentComfort === "family" || r.contentComfort === "open" ? r.contentComfort : "standard",
    runtimeMaxMinutes: Number.isFinite(runtime) && runtime >= 15 && runtime <= 600 ? Math.round(runtime) : undefined,
    personalizationEnabled: r.personalizationEnabled !== false,
    setupDone: r.setupDone === true,
  };
}
