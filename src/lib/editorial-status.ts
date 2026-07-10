// Editorial status: derive the clear state of a title's WatchedNotWatched review.
import type { MediaTitle } from "./media/types";

export type EditorialState =
  | "reviewed" // WatchedNotWatched editorial review with full guidance
  | "filter-ready" // Has filters available
  | "in-progress" // Marked for review but not yet completed
  | "basic-only" // Basic title info, not yet reviewed
  | "not-reviewed"; // External source, not yet reviewed

export interface EditorialStatus {
  state: EditorialState;
  headline: string;
  description: string;
}

export function getEditorialStatus(title: MediaTitle): EditorialStatus {
  // Reviewed: has editorial guidance with actual reviewed categories
  if (title.dataStatus === "editorial" || (title.source === "sample" && title.guidance)) {
    const reviewedCats = (title.guidance?.categories ?? []).filter((c) => c.level !== "not-reviewed" && c.source === "editorial");
    if (reviewedCats.length > 0) {
      return {
        state: "reviewed",
        headline: "Reviewed by WatchedNotWatched",
        description: "Detailed guidance is available for this title.",
      };
    }
  }

  // In-progress: explicitly marked as editorial draft
  if (title.dataStatus === "editorial") {
    return {
      state: "in-progress",
      headline: "Guidance in progress",
      description: "WatchedNotWatched is preparing detailed guidance for this title.",
    };
  }

  // Basic-only: external metadata without guidance
  if (["tvmaze", "wikidata"].includes(title.source)) {
    return {
      state: "basic-only",
      headline: "Basic title information",
      description: `Title information from ${title.source}. WatchedNotWatched guidance is not yet available.`,
    };
  }

  // Not-reviewed: any other external source
  return {
    state: "not-reviewed",
    headline: "Not yet reviewed",
    description: "WatchedNotWatched has not completed detailed guidance for this title.",
  };
}

export function getEditorialLabel(state: EditorialState): string {
  const labels: Record<EditorialState, string> = {
    reviewed: "Reviewed",
    "filter-ready": "Filter-ready",
    "in-progress": "In progress",
    "basic-only": "Basic info",
    "not-reviewed": "Not reviewed",
  };
  return labels[state];
}
