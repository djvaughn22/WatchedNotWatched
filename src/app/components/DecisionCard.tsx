"use client";

// "Do I Want to Watch This?" — the decision card. One tap gets a
// personalized, spoiler-free answer: Quick Take, age guidance by category,
// and a Deep Dive. Generic guidance comes from /api/guidance (server-side AI,
// cached); the personal verdict is computed on-device from local preferences.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MediaTitle } from "@/lib/media/types";
import {
  CATEGORY_LABELS,
  LEVEL_LABELS,
  UNKNOWN_NOTE,
  type GuidanceLevel,
  type GuidanceResponse,
  type TitleGuidance,
} from "@/lib/guidance/types";
import { personalize } from "@/lib/guidance/personalize";
import { usePrefs } from "@/lib/usePrefs";
import { hasAnyPrefs } from "@/lib/prefs";
import { track } from "@/lib/analytics";
import PreferencesEditor from "./PreferencesEditor";

type Phase = "idle" | "loading" | GuidanceResponse["status"];

function levelBadgeClass(level: GuidanceLevel): string {
  switch (level) {
    case "none":
      return "border border-[#26324c] text-[#64748b]";
    case "mild":
      return "border border-[#26324c] text-[#94a3b8]";
    case "moderate":
      return "border border-[#26324c] text-[#e8edf5]";
    case "strong":
    case "high":
      return "border border-[#f59e0b]/70 text-[#fbbf24] font-bold";
    case "unknown":
      return "border border-dashed border-[#26324c] text-[#64748b]";
  }
}

const VERDICT_ICON: Record<string, string> = { yes: "👍", mixed: "🤔", no: "👎", kids_no: "🧒" };

const ERROR_COPY: Partial<Record<Phase, { message: string; retry: boolean }>> = {
  error: { message: "Couldn’t build guidance for this title right now.", retry: true },
  rate_limited: { message: "Guidance is busy right now. Give it a minute and try again.", retry: true },
  no_metadata: { message: "There isn’t enough title information to build guidance for this one.", retry: false },
  unconfigured: {
    message: "Spoiler-free guidance isn’t switched on yet for this site. Check back soon.",
    retry: false,
  },
};

export default function DecisionCard({
  source,
  id,
  title,
}: {
  source: string;
  id: string;
  title: MediaTitle;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [guidance, setGuidance] = useState<TitleGuidance | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const { prefs, hydrated, setPrefs, reset } = usePrefs();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setPhase("loading");
    track("decision_card_requested", { content_title: title.title, media_type: title.mediaType });
    try {
      const res = await fetch(
        `/api/guidance?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}&mediaType=${encodeURIComponent(title.mediaType)}`,
      );
      const data = (await res.json()) as GuidanceResponse;
      if (!alive.current) return;
      if (data.status === "ok" && data.guidance) {
        setGuidance(data.guidance);
        setPhase("ok");
      } else {
        setPhase(data.status && data.status !== "ok" ? data.status : "error");
      }
    } catch {
      if (alive.current) setPhase("error");
    }
  }, [source, id, title.title, title.mediaType]);

  const verdict = useMemo(
    () => (guidance && hydrated ? personalize(guidance, prefs, { genres: title.genres }) : null),
    [guidance, hydrated, prefs, title.genres],
  );

  const personalized = hydrated && hasAnyPrefs(prefs);

  return (
    <section className="mt-6" aria-label="Do I Want to Watch This?">
      {phase === "idle" && (
        <div>
          <button
            type="button"
            onClick={load}
            className="w-full rounded-xl bg-[#22D3EE] px-5 py-4 text-base font-black text-[#06131a] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] sm:text-lg"
          >
            Do I Want to Watch This?
          </button>
          <p className="mt-1.5 text-center text-xs text-[#64748b]">Get a personalized, spoiler-free answer.</p>
        </div>
      )}

      {phase === "loading" && (
        <div
          role="status"
          className="rounded-xl border border-[#26324c] bg-[#141d2e] px-5 py-4 text-center text-sm font-semibold text-[#94a3b8]"
        >
          <span className="mr-2 inline-block animate-pulse" aria-hidden>
            ✓
          </span>
          Building your spoiler-free answer…
        </div>
      )}

      {ERROR_COPY[phase] && (
        <div role="alert" className="rounded-xl border border-[#26324c] bg-[#141d2e] px-5 py-4 text-center">
          <p className="text-sm text-[#94a3b8]">{ERROR_COPY[phase]!.message}</p>
          {ERROR_COPY[phase]!.retry && (
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-full bg-[#22D3EE] px-4 py-2 text-sm font-bold text-[#06131a]"
            >
              Try again
            </button>
          )}
        </div>
      )}

      <div aria-live="polite">
        {phase === "ok" && guidance && (
          <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
            <h2 className="text-base font-black text-[#e8edf5]">Do I Want to Watch This?</h2>

            {/* 1. Quick Take — always first */}
            <p className="mt-3 text-sm leading-relaxed text-[#e8edf5]">{guidance.quickTake}</p>

            {/* 2. Personal verdict (on-device, from local preferences) */}
            {verdict ? (
              <div className="mt-4 rounded-xl border border-[#22D3EE]/40 bg-[#0b1220] p-4">
                <p className="text-sm font-bold text-[#e8edf5]">
                  <span aria-hidden className="mr-1.5">
                    {VERDICT_ICON[verdict.kind]}
                  </span>
                  {verdict.headline}
                </p>
                {verdict.points.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {verdict.points.map((p, i) => (
                      <li key={i} className="text-xs leading-relaxed text-[#94a3b8]">
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px] text-[#64748b]">Based on the preferences saved on this device.</p>
              </div>
            ) : (
              phase === "ok" &&
              !personalized && (
                <p className="mt-3 text-xs text-[#64748b]">
                  Set your viewing preferences below and this answer gets personal — genres, content limits, who’s
                  watching tonight.
                </p>
              )
            )}

            {/* 3. Age guidance by category */}
            <h3 className="mt-5 text-sm font-bold text-[#e8edf5]">Age guidance</h3>
            <p className="mt-0.5 text-[11px] text-[#64748b]">
              {title.officialRating
                ? `Official rating: ${title.officialRating}. `
                : "No official rating available for this title. "}
              The levels below are WatchedNotWatched guidance, not an official rating.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {guidance.categories.map((cat) => (
                <li key={cat.id} className="rounded-lg border border-[#26324c] bg-[#0b1220] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#e8edf5]">{CATEGORY_LABELS[cat.id]}</span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${levelBadgeClass(cat.level)}`}
                    >
                      {LEVEL_LABELS[cat.level]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#94a3b8]">
                    {cat.level === "unknown" ? UNKNOWN_NOTE : cat.note}
                  </p>
                </li>
              ))}
            </ul>

            {/* 4. Best Fit */}
            <p className="mt-4 text-sm text-[#e8edf5]">
              <span className="font-bold">Best fit:</span> <span className="text-[#94a3b8]">{guidance.bestFit}</span>
            </p>

            {/* 5. Deep Dive — collapsed below the categories */}
            <button
              type="button"
              onClick={() => setDeepDiveOpen((v) => !v)}
              aria-expanded={deepDiveOpen}
              className="mt-4 flex items-center gap-1.5 text-sm font-bold text-[#22D3EE] hover:underline"
            >
              Deep Dive {deepDiveOpen ? "▴" : "▾"}
            </button>
            {deepDiveOpen && (
              <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">{guidance.deepDive}</p>
            )}

            <p className="mt-4 border-t border-[#26324c] pt-3 text-[11px] leading-relaxed text-[#64748b]">
              WatchedNotWatched guidance is designed to help with viewing decisions. It is not an official rating and
              may not capture every concern.
            </p>
          </div>
        )}
      </div>

      {/* Preferences — small, obvious, works before or after generating */}
      {hydrated && (
        <div className="mt-3">
          {!prefsOpen ? (
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              aria-expanded={false}
              className="w-full rounded-xl border border-[#26324c] px-4 py-2.5 text-sm font-semibold text-[#94a3b8] hover:text-[#e8edf5]"
            >
              {personalized ? "My viewing preferences ✓" : "Make this personal"}
            </button>
          ) : (
            <PreferencesEditor prefs={prefs} setPrefs={setPrefs} onDone={() => setPrefsOpen(false)} onReset={reset} />
          )}
        </div>
      )}
    </section>
  );
}
