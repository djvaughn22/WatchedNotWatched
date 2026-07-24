"use client";

// For You orchestrator. The library lives on-device; each generation sends
// the server a compact taste profile + seeds + ids to exclude, and gets back
// up to five cards plus spares (spares power "Show me another" without a new
// request). All AI gating happens server-side — this component only renders
// what came back and records feedback locally.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLibrary } from "@/lib/useLocal";
import { track } from "@/lib/analytics";
import type { TitleRef } from "@/lib/library";
import { buildSeeds, buildTasteProfile } from "@/lib/recommendations/profile";
import { defaultPrefs, REC_PREFS_KEY, sanitizePrefs, type RecPrefs } from "@/lib/recommendations/prefs";
import {
  addDismissal,
  dismissedIds,
  emptyFeedback,
  feedbackAdjustments,
  REC_FEEDBACK_KEY,
  sanitizeFeedback,
  type DismissReason,
  type RecFeedbackStore,
} from "@/lib/recommendations/feedback";
import {
  REC_MODE_LABELS,
  REC_MODES,
  type RecMode,
  type RecommendationItem,
  type RecResponse,
} from "@/lib/recommendations/types";
import RecommendationCard from "./RecommendationCard";
import ColdStart from "./ColdStart";
import RecSettings from "./RecSettings";

const DEVICE_KEY = "wnw.device.v1";
const VISIBLE = 5;

function readLocal<T>(key: string, sanitize: (raw: unknown) => T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitize(null);
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function deviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

type UiState = "setup" | "loading" | "ready" | "empty" | "error" | "metadata_unavailable";

export default function ForYouClient() {
  const { entries, mark, take, hydrated } = useLibrary();
  const [prefs, setPrefs] = useState<RecPrefs>(defaultPrefs);
  const [feedback, setFeedback] = useState<RecFeedbackStore>(emptyFeedback);
  const [mode, setMode] = useState<RecMode>("best_match");
  const [state, setState] = useState<UiState>("loading");
  const [deck, setDeck] = useState<RecommendationItem[]>([]);
  const [spares, setSpares] = useState<RecommendationItem[]>([]);
  const [meta, setMeta] = useState<Pick<RecResponse, "ai" | "aiReason" | "summary" | "tasteProfile"> | null>(null);
  const [announce, setAnnounce] = useState("");
  const [localReady, setLocalReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(readLocal(REC_PREFS_KEY, sanitizePrefs));
    setFeedback(readLocal(REC_FEEDBACK_KEY, sanitizeFeedback));
    setLocalReady(true);
    track("for_you_opened");
  }, []);

  const hasHistory = useMemo(
    () => entries.some((e) => e.myTake === "loved" || e.myTake === "liked"),
    [entries],
  );

  const generate = useCallback(
    (
      genMode: RecMode,
      genPrefs: RecPrefs,
      genFeedback: RecFeedbackStore,
      justPicked: TitleRef[] = [],
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState("loading");
      setAnnounce("Finding your picks…");

      const personalized = genPrefs.personalizationEnabled;
      // Cold-start picks are marked in the library asynchronously; fold them
      // in directly so the very first generation is already personalized.
      const pickedSeeds = justPicked
        .filter((r) => r.source === "tmdb")
        .map((r) => ({
          sourceId: r.sourceId,
          mediaType: r.mediaType === "series" ? ("series" as const) : ("movie" as const),
          title: r.title,
          weight: 2,
        }));
      const seeds = personalized ? [...pickedSeeds, ...buildSeeds(entries)].slice(0, 8) : [];
      const profile = buildTasteProfile(personalized ? entries : [], genPrefs);
      // Repeated intensity complaints steer the engine away from the usual suspects.
      const adj = feedbackAdjustments(genFeedback);
      if (adj.intenseComplaints >= 2) {
        profile.dislikedGenres = [...new Set([...profile.dislikedGenres, "Thriller", "Crime"])].slice(0, 8);
      }
      const excludeIds = [
        ...justPicked.map((r) => r.id),
        ...entries.map((e) => e.id),
        ...dismissedIds(genFeedback),
      ].slice(-400);

      fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: genMode, deviceId: deviceId(), seeds, profile, excludeIds }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data: RecResponse) => {
          if (controller.signal.aborted) return;
          if (data.status === "metadata_unavailable") {
            setState("metadata_unavailable");
            return;
          }
          if (data.status !== "ok" || data.items.length === 0) {
            setState("empty");
            return;
          }
          setDeck(data.items.slice(0, VISIBLE));
          setSpares(data.items.slice(VISIBLE));
          setMeta({ ai: data.ai, aiReason: data.aiReason, summary: data.summary, tasteProfile: data.tasteProfile });
          setState("ready");
          setAnnounce(`${Math.min(data.items.length, VISIBLE)} picks ready.`);
          track("recommendation_generated", { mode: genMode, ai: data.ai, count: data.items.length });
          track("recommendation_viewed", { mode: genMode });
          if (data.aiReason === "daily_limit") track("recommendation_limit_reached");
          if (data.aiReason === "entitlement_required") track("recommendation_upgrade_viewed");
        })
        .catch((e) => {
          if (e?.name === "AbortError") return;
          setState("error");
          setAnnounce("Recommendations didn’t load.");
          track("recommendation_error", { mode: genMode });
        });
    },
    [entries],
  );

  // First load: wait for both stores, then either cold-start or generate.
  const booted = useRef(false);
  useEffect(() => {
    if (!hydrated || !localReady || booted.current) return;
    booted.current = true;
    if (!prefs.setupDone && !hasHistory) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("setup");
    } else {
      generate(mode, prefs, feedback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, localReady]);

  const savePrefs = (next: RecPrefs) => {
    setPrefs(next);
    writeLocal(REC_PREFS_KEY, next);
  };

  const saveFeedback = (next: RecFeedbackStore) => {
    setFeedback(next);
    writeLocal(REC_FEEDBACK_KEY, next);
  };

  const switchMode = (m: RecMode) => {
    setMode(m);
    generate(m, prefs, feedback);
  };

  /** Remove a card in place and slide the next spare in — no scroll jump. */
  const replaceCard = (id: string) => {
    setDeck((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (spares.length > 0) {
        next.push(spares[0]);
        setSpares((s) => s.slice(1));
      }
      return next;
    });
  };

  const toRef = (item: RecommendationItem): TitleRef => ({
    id: item.id,
    source: item.source,
    sourceId: item.sourceId,
    mediaType: item.mediaType,
    title: item.title,
    releaseYear: item.releaseYear,
    posterUrl: item.posterUrl,
    genres: item.genres,
  });

  const onSave = (item: RecommendationItem) => {
    mark(toRef(item), "want_to_watch");
    track("recommendation_saved", { content_title: item.title });
    setAnnounce(`${item.title} added to Want to Watch.`);
    replaceCard(item.id);
  };

  const onWatched = (item: RecommendationItem) => {
    mark(toRef(item), "watched");
    track("recommendation_watched", { content_title: item.title });
    setAnnounce(`${item.title} marked watched. Rate it in your library to sharpen your picks.`);
    replaceCard(item.id);
  };

  const onDismiss = (item: RecommendationItem, reason: DismissReason) => {
    saveFeedback(addDismissal(feedback, item.id, reason));
    track("recommendation_dismissed", { reason });
    track("recommendation_feedback", { reason });
    setAnnounce(`${item.title} dismissed.`);
    replaceCard(item.id);
  };

  const onAnother = (item: RecommendationItem) => {
    saveFeedback(addDismissal(feedback, item.id, "show_another"));
    track("recommendation_dismissed", { reason: "show_another" });
    setAnnounce("Showing another pick.");
    replaceCard(item.id);
  };

  const coldStartDone = (picked: TitleRef[], nextPrefs: RecPrefs) => {
    for (const ref of picked) {
      mark(ref, "watched");
      take(ref.id, "liked");
    }
    savePrefs(nextPrefs);
    generate(mode, nextPrefs, feedback, picked);
  };

  const resetHistory = () => {
    saveFeedback(emptyFeedback());
    setAnnounce("Recommendation history cleared.");
  };

  const clearPrefs = () => {
    savePrefs({ ...defaultPrefs(), setupDone: true });
    setAnnounce("Preferences cleared.");
  };

  return (
    <div className="space-y-4">
      <p aria-live="polite" role="status" className="sr-only">
        {announce}
      </p>

      {state === "setup" && <ColdStart prefs={prefs} canSkip={hasHistory} onDone={coldStartDone} />}

      {state !== "setup" && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Recommendation mode">
            {REC_MODES.map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`min-h-11 shrink-0 rounded-xl border px-3.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] ${
                  mode === m
                    ? "border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE]"
                    : "border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"
                }`}
              >
                {REC_MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {state === "ready" && meta?.summary && (
            <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] px-4 py-3">
              <p className="text-sm text-[#e8edf5]">{meta.summary}</p>
              {meta.tasteProfile && meta.tasteProfile.enjoys.length > 0 && (
                <p className="mt-1 text-xs text-[#94a3b8]">
                  You lean toward {meta.tasteProfile.enjoys.slice(0, 3).join(", ").toLowerCase()}
                  {meta.tasteProfile.avoids.length > 0
                    ? ` — steering clear of ${meta.tasteProfile.avoids.slice(0, 2).join(", ").toLowerCase()}`
                    : ""}
                  .
                </p>
              )}
            </div>
          )}

          {state === "ready" && meta?.aiReason === "entitlement_required" && (
            <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] px-4 py-3">
              <p className="text-sm font-bold text-[#e8edf5]">These are standard picks.</p>
              <p className="mt-0.5 text-xs text-[#94a3b8]">
                Personal explanations, content guides, and smarter matching are part of the upcoming paid add-on. Your
                lists and these picks stay free.
              </p>
            </div>
          )}

          {state === "ready" && meta?.aiReason === "daily_limit" && (
            <p className="rounded-2xl border border-[#26324c] bg-[#141d2e] px-4 py-3 text-xs text-[#94a3b8]">
              You&apos;ve used today&apos;s smart picks — these are standard picks. Smart picks return tomorrow.
            </p>
          )}

          {!prefs.personalizationEnabled && (
            <p className="rounded-2xl border border-[#26324c] bg-[#141d2e] px-4 py-3 text-xs text-[#94a3b8]">
              Personalization is off — these picks don&apos;t use your library. Turn it back on under Preferences &amp;
              privacy.
            </p>
          )}

          {state === "loading" && (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl border border-[#26324c] bg-[#141d2e]" />
              ))}
            </div>
          )}

          {state === "error" && (
            <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5 text-center">
              <p className="text-sm font-bold text-[#e8edf5]">Recommendations are taking a break.</p>
              <p className="mt-1 text-xs text-[#94a3b8]">Your lists still work, and nothing has been lost.</p>
              <button
                onClick={() => generate(mode, prefs, feedback)}
                className="mt-3 min-h-11 rounded-xl border border-[#26324c] px-4 text-sm font-bold text-[#22D3EE]"
              >
                Try again
              </button>
            </div>
          )}

          {state === "metadata_unavailable" && (
            <p className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5 text-center text-sm text-[#94a3b8]">
              Picks need the movie database connection, which isn&apos;t configured yet. Your lists still work.
            </p>
          )}

          {state === "empty" && (
            <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5 text-center">
              <p className="text-sm font-bold text-[#e8edf5]">Nothing matched your current filters.</p>
              <p className="mt-1 text-xs text-[#94a3b8]">
                Try another mode, loosen preferences, or thumb up more titles on the{" "}
                <Link href="/top" className="text-[#22D3EE] hover:underline">
                  Top 222 board
                </Link>
                .
              </p>
              <button
                onClick={() => setState("setup")}
                className="mt-3 min-h-11 rounded-xl border border-[#26324c] px-4 text-sm font-bold text-[#22D3EE]"
              >
                Give us a starting point
              </button>
            </div>
          )}

          {state === "ready" && (
            <>
              <div className="space-y-3">
                {deck.map((item) => (
                  <RecommendationCard
                    key={item.id}
                    item={item}
                    onSave={onSave}
                    onWatched={onWatched}
                    onDismiss={onDismiss}
                    onAnother={onAnother}
                  />
                ))}
              </div>
              {deck.length === 0 && (
                <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5 text-center">
                  <p className="text-sm font-bold text-[#e8edf5]">You&apos;ve been through this batch.</p>
                  <button
                    onClick={() => generate(mode, prefs, feedback)}
                    className="mt-3 min-h-11 rounded-xl bg-[#22D3EE] px-4 text-sm font-black text-[#06131a]"
                  >
                    Deal me more
                  </button>
                </div>
              )}
            </>
          )}

          <RecSettings
            prefs={prefs}
            dismissedCount={feedback.dismissed.length}
            onChange={savePrefs}
            onResetHistory={resetHistory}
            onClearPrefs={clearPrefs}
          />
        </>
      )}
    </div>
  );
}
