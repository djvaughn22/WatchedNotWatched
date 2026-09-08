// The whole-application mode switch: WatchedNotWatched (movies + TV) vs.
// ReadNotRead (books). One product, two complete experiences that share a
// shell. Framework-free so the parsing/copy logic is easy to test directly.

export type AppMode = "screen" | "book";

export const MODE_STORAGE_KEY = "wnw.mode.v1";
export const MODE_QUERY_PARAM = "mode";
export const DEFAULT_MODE: AppMode = "screen"; // backward-compatible: existing users see the unchanged product

export function parseMode(value: unknown): AppMode | null {
  return value === "screen" || value === "book" ? value : null;
}

export interface ModeCopy {
  /** Site brand shown in hero/product surfaces (nav brand stays "WatchedNotWatched.com" — synced chrome). */
  brand: string;
  heroHeading: string;
  heroSub: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  searchToggleLabel: string;
  statusDone: string; // "Watched" | "Read"
  statusNotDone: string; // "Not watched" | "Not read"
  emptyLibraryHint: string;
  picksEyebrow: string; // "Picks to start with" copy body
  picksColdStartCopy: string;
  picksPersonalCopy: string;
  trendingLabel: string;
  moreHref: string;
  forYouHeading: string;
  forYouSub: string;
  savedFootnote: string;
}

export const MODE_COPY: Record<AppMode, ModeCopy> = {
  screen: {
    brand: "WatchedNotWatched",
    heroHeading: "What to watch next, based on what you like.",
    heroSub: "Log what you've seen. Movie and TV picks change with every rating.",
    searchPlaceholder: "Search movies and TV shows",
    searchAriaLabel: "Search movies and TV shows",
    searchToggleLabel: "Movies + TV",
    statusDone: "Watched",
    statusNotDone: "Not watched",
    emptyLibraryHint: "Search a movie or show, tap Watched, or save it for later. Your library builds itself.",
    picksEyebrow: "Picks to start with",
    picksColdStartCopy: "From the Top 222 boards. Rate a few and your picks go personal.",
    picksPersonalCopy: "Built from your 👍s. Rate anything and the deck changes.",
    trendingLabel: "Top 22 movies today",
    moreHref: "/foryou",
    forYouHeading: "What should I watch next?",
    forYouSub: "Recommendations based on what you watched, skipped, saved, and enjoyed.",
    savedFootnote: "Saved on this device. Export a backup anytime. No account needed.",
  },
  book: {
    brand: "ReadNotRead",
    heroHeading: "What to read next, based on what you like.",
    heroSub: "Log what you've read. Book picks change with every rating.",
    searchPlaceholder: "Search books, authors, or ISBNs",
    searchAriaLabel: "Search books, authors, or ISBNs",
    searchToggleLabel: "Books",
    statusDone: "Read",
    statusNotDone: "Not read",
    emptyLibraryHint: "Search a book, tap Read, or save it for later. Your library builds itself.",
    picksEyebrow: "Picks to start with",
    picksColdStartCopy: "Trending on Open Library right now — not personalized yet. Rate a few books and your picks go personal.",
    picksPersonalCopy: "Built from your 👍s. Rate anything and the deck changes.",
    trendingLabel: "Trending books today",
    moreHref: "/foryou",
    forYouHeading: "What should I read next?",
    forYouSub: "Recommendations based on what you read, skipped, saved, and enjoyed.",
    savedFootnote: "Saved on this device. Export a backup anytime. No account needed.",
  },
};

export function copyFor(mode: AppMode): ModeCopy {
  return MODE_COPY[mode];
}
