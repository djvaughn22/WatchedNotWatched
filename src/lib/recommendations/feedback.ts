// Recommendation feedback — on-device only. Dismissals keep titles from
// coming back; reasons feed the next request's profile (e.g. "too intense"
// nudges content comfort). Resettable from the privacy controls.

export const REC_FEEDBACK_KEY = "wnw.recfeedback.v1";

export type DismissReason =
  | "not_for_me"
  | "too_intense"
  | "too_slow"
  | "too_childish"
  | "too_mature"
  | "already_seen"
  | "not_available"
  | "wrong_mood"
  | "show_another";

export const DISMISS_REASON_LABELS: Record<DismissReason, string> = {
  not_for_me: "Not for me",
  too_intense: "Too intense",
  too_slow: "Too slow",
  too_childish: "Too childish",
  too_mature: "Too mature",
  already_seen: "Already seen",
  not_available: "Not available to me",
  wrong_mood: "Wrong mood",
  show_another: "Show me another",
};

export interface Dismissal {
  id: string; // title id, e.g. "tmdb:27205"
  reason: DismissReason;
  at: string;
}

export interface RecFeedbackStore {
  version: 1;
  dismissed: Dismissal[];
}

const REASONS = new Set<DismissReason>(Object.keys(DISMISS_REASON_LABELS) as DismissReason[]);
const MAX_DISMISSED = 400;

export function emptyFeedback(): RecFeedbackStore {
  return { version: 1, dismissed: [] };
}

export function sanitizeFeedback(raw: unknown): RecFeedbackStore {
  if (!raw || typeof raw !== "object") return emptyFeedback();
  const d = (raw as RecFeedbackStore).dismissed;
  if (!Array.isArray(d)) return emptyFeedback();
  return {
    version: 1,
    dismissed: d
      .filter(
        (x): x is Dismissal =>
          !!x && typeof x === "object" && typeof x.id === "string" && REASONS.has(x.reason),
      )
      .slice(-MAX_DISMISSED),
  };
}

/** Record a dismissal (newest wins; capped). "show_another" hides the title but is a softer signal. */
export function addDismissal(store: RecFeedbackStore, id: string, reason: DismissReason, at = new Date().toISOString()): RecFeedbackStore {
  const rest = store.dismissed.filter((d) => d.id !== id);
  return { version: 1, dismissed: [...rest, { id, reason, at }].slice(-MAX_DISMISSED) };
}

export function dismissedIds(store: RecFeedbackStore): string[] {
  return store.dismissed.map((d) => d.id);
}

/** Signals that shift the profile for the NEXT request. */
export function feedbackAdjustments(store: RecFeedbackStore): { intenseComplaints: number; matureComplaints: number } {
  let intenseComplaints = 0;
  let matureComplaints = 0;
  for (const d of store.dismissed) {
    if (d.reason === "too_intense") intenseComplaints += 1;
    if (d.reason === "too_mature") matureComplaints += 1;
  }
  return { intenseComplaints, matureComplaints };
}
