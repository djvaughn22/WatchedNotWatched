// WatchedNotWatched — Filter Engine types.
// The engine operates on ANY video through the ControllablePlayer interface,
// never directly on a specific component or a protected stream.

export type FilterAction = "mute" | "skip" | "warn";

export type FilterCategory =
  | "language"
  | "violence"
  | "sexual-content"
  | "nudity"
  | "frightening"
  | "substance-use"
  | "religious-concern"
  | "other";

export type FilterSeverity = "mild" | "moderate" | "strong";

export interface FilterEvent {
  id: string;
  startSeconds: number;
  endSeconds: number;
  action: FilterAction;
  category: FilterCategory;
  severity: FilterSeverity;
  label: string;
  description?: string;
  enabledByDefault?: boolean;
}

// A manifest only applies to ONE exact version of one piece of media.
// A different cut, recap, ad break, intro, or runtime invalidates every
// timestamp — verification exists so automatic actions never run blind.
export interface ManifestVerification {
  state: "verified" | "unverified";
  /** ISO date the timing was last checked against the media. */
  verifiedAt?: string;
  /** How it was checked, e.g. "manual playback check". */
  method?: string;
  notes?: string;
}

export interface FilterManifest {
  id: string;
  version: number;
  mediaId: string;
  title: string;
  durationSeconds: number;
  events: FilterEvent[];
  source: "editorial" | "owner-authored" | "sample";
  createdAt: string;
  updatedAt: string;
  /** Exact cut this track was authored against, e.g. "CC-BY demo clip, 10s". */
  edition?: string;
  /** Where this exact edition plays. "watchednotwatched" = our own player. */
  provider?: string;
  /** Catalog region, when it matters for the edition. */
  region?: string;
  /** Expected media runtime; playback must match within tolerance. */
  runtimeSeconds?: number;
  runtimeToleranceSeconds?: number;
  verification?: ManifestVerification;
}

// A minimal, player-agnostic control surface. An HTML5 <video>, a future
// licensed player, or a test double can all implement this.
export interface ControllablePlayer {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number): void;
  getMuted(): boolean;
  setMuted(muted: boolean): void;
  getVolume?(): number;
  setVolume?(volume: number): void;
  // Returns an unsubscribe function.
  onTimeUpdate(callback: (seconds: number) => void): () => void;
  onSeek?(callback: (seconds: number) => void): () => void;
}

// Neutral, factual public labels for categories.
export const CATEGORY_LABELS: Record<FilterCategory, string> = {
  language: "Language",
  violence: "Violence",
  "sexual-content": "Sexual content",
  nudity: "Nudity",
  frightening: "Frightening",
  "substance-use": "Substance use",
  "religious-concern": "Religious concern",
  other: "Other",
};

export const ACTION_LABELS: Record<FilterAction, string> = {
  mute: "Mute",
  skip: "Skip",
  warn: "Warn",
};

export const ALL_CATEGORIES: FilterCategory[] = [
  "language",
  "violence",
  "sexual-content",
  "nudity",
  "frightening",
  "substance-use",
  "religious-concern",
  "other",
];
