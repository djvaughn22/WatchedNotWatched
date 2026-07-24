// Builds the compact taste profile from on-device activity. Pure functions —
// the library and preferences stay on the device; only this small summary is
// sent to the server. Inference first, questionnaire never: genres come from
// what the user actually rated, and saved preferences only refine that.

import type { LibraryEntry } from "@/lib/library";
import type { RecSeed, TasteProfile } from "./types";
import type { RecPrefs } from "./prefs";

/** Loved beats liked, newest first — same seed rule as the home deck. */
export function buildSeeds(entries: LibraryEntry[]): RecSeed[] {
  const liked = entries.filter((e) => (e.myTake === "loved" || e.myTake === "liked") && e.source === "tmdb");
  liked.sort((a, b) => (a.myTake === b.myTake ? 0 : a.myTake === "loved" ? -1 : 1));
  return liked.slice(0, 8).map((e) => ({
    sourceId: e.sourceId,
    mediaType: e.mediaType === "series" ? "series" : "movie",
    title: e.title,
    weight: e.myTake === "loved" ? 3 : 2,
  }));
}

export function buildTasteProfile(entries: LibraryEntry[], prefs: RecPrefs): TasteProfile {
  // Genre affinity from actual verdicts: loved 3, liked 2, want-to-watch 1,
  // fine 0, not-for-me / prob-not count against.
  const genreScore = new Map<string, number>();
  const add = (genres: string[] | undefined, delta: number) => {
    for (const g of genres ?? []) genreScore.set(g, (genreScore.get(g) ?? 0) + delta);
  };
  for (const e of entries) {
    if (e.myTake === "loved") add(e.genres, 3);
    else if (e.myTake === "liked") add(e.genres, 2);
    else if (e.myTake === "not_for_me") add(e.genres, -2);
    else if (e.status === "prob_not") add(e.genres, -1);
    else if (e.status === "want_to_watch") add(e.genres, 1);
  }
  const ranked = [...genreScore.entries()].sort((a, b) => b[1] - a[1]);
  const likedGenres = ranked.filter(([, s]) => s > 0).slice(0, 6).map(([g]) => g);
  const inferredDisliked = ranked.filter(([, s]) => s <= -2).map(([g]) => g);
  const dislikedGenres = [...new Set([...prefs.dislikedGenres, ...inferredDisliked])].slice(0, 6);

  // Media type: explicit preference wins; otherwise infer from a clear lean.
  let mediaTypePreference = prefs.mediaType;
  if (mediaTypePreference === "either") {
    const movies = entries.filter((e) => e.mediaType === "movie").length;
    const series = entries.filter((e) => e.mediaType === "series").length;
    const total = movies + series;
    if (total >= 8) {
      if (movies / total >= 0.85) mediaTypePreference = "movie";
      else if (series / total >= 0.85) mediaTypePreference = "series";
    }
  }

  return {
    likedGenres,
    dislikedGenres,
    mediaTypePreference,
    tones: prefs.tones,
    contentComfort: prefs.contentComfort,
    runtimeMaxMinutes: prefs.runtimeMaxMinutes,
  };
}
