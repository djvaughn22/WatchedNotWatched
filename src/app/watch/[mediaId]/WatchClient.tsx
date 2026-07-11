"use client";

// Watch with Filter — plays media WatchedNotWatched is AUTHORIZED to play
// (owned / licensed / public-domain / CC), with the Filter Engine applying the
// active family profile. Automatic actions run only when the manifest is
// verified AND the loaded media's runtime matches the authored edition.
// No streaming service is involved on this page.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthorizedMedia, getManifestForMedia } from "@/data/filterManifests";
import { FilterEngine, type EngineState } from "@/lib/filter/engine";
import { createHtml5Player } from "@/lib/filter/html5";
import { canRunAutomaticActions, sortEvents } from "@/lib/filter/manifest";
import { settingsFromProfile } from "@/lib/filter/profileSettings";
import {
  ACTION_LABELS,
  CATEGORY_LABELS,
  type FilterCategory,
} from "@/lib/filter/types";
import { useProfiles, useWatchStatus } from "@/lib/useLocal";

type FilterMode = "checking" | "active" | "unverified" | "off";

function fmt(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function WatchClient({ mediaId }: { mediaId: string }) {
  const manifest = useMemo(() => getManifestForMedia(mediaId), [mediaId]);
  const media = useMemo(() => getAuthorizedMedia(mediaId), [mediaId]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<FilterEngine | null>(null);

  const { active: profile } = useProfiles();
  const { decisionFor, mark } = useWatchStatus();

  const [mode, setMode] = useState<FilterMode>("checking");
  const [filteringOn, setFilteringOn] = useState(true);
  const [state, setState] = useState<EngineState | null>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(manifest?.durationSeconds ?? 0);
  const [ended, setEnded] = useState(false);
  const [enabledCats, setEnabledCats] = useState<Set<FilterCategory> | null>(null);
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());

  const usedCategories = useMemo(
    () => (manifest ? Array.from(new Set(manifest.events.map((e) => e.category))) : []),
    [manifest],
  );

  // Apply the active profile once it hydrates (user can still adjust below).
  useEffect(() => {
    if (!manifest || !profile) return;
    const s = settingsFromProfile(profile, manifest);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabledCats(s.enabledCategories);
    setDisabledIds(s.disabledEventIds);
  }, [manifest, profile]);

  // Wire the engine after metadata loads and the edition check passes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !manifest || !media) return;

    let engine: FilterEngine | null = null;
    let unsub: (() => void) | null = null;

    const verify = () => {
      const d = video.duration;
      setDuration(d || manifest.durationSeconds);
      if (!canRunAutomaticActions(manifest, d)) {
        setMode("unverified"); // wrong file/edition: automatic actions must not run
        return;
      }
      engine = new FilterEngine(createHtml5Player(video), manifest, { warnLeadSeconds: 3 });
      engineRef.current = engine;
      unsub = engine.subscribe(setState);
      engine.start();
      setMode("active");
    };

    if (video.readyState >= 1) verify();
    else video.addEventListener("loadedmetadata", verify, { once: true });

    const onTime = () => {
      setCurrent(video.currentTime || 0);
      // "ended" doesn't fire on a paused seek to the end — check the property too.
      if (video.ended) setEnded(true);
    };
    video.addEventListener("seeked", onTime);
    const onEnded = () => setEnded(true);
    const onPlay = () => setEnded(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);
    return () => {
      unsub?.();
      engine?.stop();
      engineRef.current = null;
      video.removeEventListener("loadedmetadata", verify);
      video.removeEventListener("seeked", onTime);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
    };
  }, [manifest, media]);

  // Push profile/toggle settings into the engine.
  useEffect(() => {
    if (!engineRef.current || !enabledCats) return;
    engineRef.current.setSettings({
      enabledCategories: filteringOn ? enabledCats : new Set(),
      disabledEventIds: disabledIds,
    });
  }, [enabledCats, disabledIds, filteringOn, mode]);

  if (!manifest || !media) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-black text-[#e8edf5]">Watch with Filter isn’t available for this title</h1>
        <p className="mt-3 text-sm text-[#94a3b8]">
          Automatic filtering runs only on media WatchedNotWatched is allowed to play, with a verified filter track for the exact version. This title doesn’t have one.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/search" className="rounded-full bg-[#22D3EE] px-4 py-2 text-sm font-bold text-[#06131a]">Back to search</Link>
          <Link href="/filter-lab" className="rounded-full border border-[#26324c] px-4 py-2 text-sm font-semibold text-[#94a3b8]">See the Filter Lab</Link>
        </div>
      </div>
    );
  }

  const decision = decisionFor(mediaId);
  const upcoming = mode === "active" && filteringOn ? state?.upcoming ?? null : null;
  const activeNow = mode === "active" && filteringOn ? state?.activeEvents[0] : undefined;
  const counts = state?.counts ?? { muted: 0, skipped: 0, warned: 0, total: 0 };
  const skippable = upcoming?.event ?? activeNow;

  const manualSkip = () => {
    const v = videoRef.current;
    if (v && skippable) v.currentTime = skippable.endSeconds;
  };

  const toggleCategory = (c: FilterCategory) => {
    setEnabledCats((prev) => {
      const next = new Set(prev ?? usedCategories);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  const markWatched = () =>
    mark({
      id: mediaId,
      source: mediaId.split(":")[0] ?? "sample",
      sourceId: mediaId.split(":")[1] ?? mediaId,
      mediaType: "movie",
      title: media.title,
      decision: "watched",
    });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-black text-[#e8edf5]">Watch with Filter</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          {media.title}{manifest.edition ? ` · ${manifest.edition}` : ""} · {fmt(manifest.runtimeSeconds ?? manifest.durationSeconds)}
          {manifest.verification?.state === "verified" && manifest.verification.verifiedAt
            ? ` · Track verified ${manifest.verification.verifiedAt}`
            : ""}
        </p>
      </header>

      {/* Filter status — always visible, always honest */}
      <div aria-live="polite">
        {mode === "unverified" && (
          <p className="mb-3 rounded-lg border border-[#94a3b8] bg-[#141d2e] px-3 py-2 text-sm font-semibold text-[#e8edf5]">
            Filtering is not verified for this version. The loaded video doesn’t match the runtime this filter track was authored for, so automatic actions are off.
          </p>
        )}
        {mode === "active" && !filteringOn && (
          <p className="mb-3 rounded-lg border border-[#26324c] bg-[#141d2e] px-3 py-2 text-sm text-[#94a3b8]">
            Filtering is off. Turn it back on below.
          </p>
        )}
      </div>

      {/* Player + overlay */}
      <div className="overflow-hidden rounded-2xl border border-[#26324c] bg-black">
        <div className="relative aspect-video w-full bg-black">
          <video ref={videoRef} src={media.src} controls playsInline preload="metadata" className="h-full w-full" />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3" aria-live="polite">
            {upcoming && (
              <span className="rounded-full border border-[#26324c] bg-[#0b1220]/90 px-3 py-1.5 text-xs font-bold text-[#e8edf5]">
                {ACTION_LABELS[upcoming.event.action]} · {CATEGORY_LABELS[upcoming.event.category]} in {upcoming.secondsUntil}s
              </span>
            )}
            {activeNow && (
              <span className="rounded-full border border-[#22D3EE] bg-[#06131a]/90 px-3 py-1.5 text-xs font-bold text-[#22D3EE]">
                {activeNow.action === "skip" ? "Scene skipped" : activeNow.action === "mute" ? "Audio muted" : "Heads-up"} — {CATEGORY_LABELS[activeNow.category]}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#26324c] px-4 py-3 text-xs text-[#94a3b8]">
          <span>{fmt(current)} / {fmt(duration)}</span>
          <span>
            Filtering:{" "}
            <span className={`font-bold ${mode === "active" && filteringOn ? "text-[#22D3EE]" : "text-[#e8edf5]"}`}>
              {mode === "checking" ? "checking version…" : mode === "unverified" ? "off (version not verified)" : filteringOn ? "on" : "off"}
            </span>
          </span>
          <span>Applied: <span className="font-bold text-[#22D3EE]">{counts.total}</span></span>
        </div>
      </div>
      <p className="mt-2 text-xs text-[#94a3b8]">{media.attribution}</p>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {mode === "active" && (
          <button
            onClick={() => setFilteringOn((v) => !v)}
            aria-pressed={filteringOn}
            className={`rounded-full px-4 py-2 text-sm font-bold ${filteringOn ? "bg-[#22D3EE] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8]"}`}
          >
            {filteringOn ? "Filtering on" : "Filtering off"}
          </button>
        )}
        <button
          onClick={manualSkip}
          disabled={!skippable}
          className="rounded-full border border-[#26324c] px-4 py-2 text-sm font-semibold text-[#e8edf5] disabled:opacity-40"
        >
          Skip this scene
        </button>
        {profile && (
          <span className="text-xs text-[#94a3b8]">Using the <span className="font-bold text-[#e8edf5]">{profile.name}</span> profile.{" "}
            <Link href="/profiles" className="text-[#22D3EE] hover:underline">Change</Link>
          </span>
        )}
      </div>

      {/* Category toggles (profile defaults, adjustable per session) */}
      {mode === "active" && enabledCats && (
        <section className="mt-5 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
          <h2 className="mb-3 text-sm font-bold text-[#e8edf5]">Categories filtered this session</h2>
          <div className="flex flex-wrap gap-2">
            {usedCategories.map((c) => {
              const on = enabledCats.has(c);
              return (
                <button key={c} onClick={() => toggleCategory(c)} role="switch" aria-checked={on}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-[#22D3EE] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8]"}`}>
                  {CATEGORY_LABELS[c]} {on ? "· On" : "· Off"}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[#94a3b8]">
            Session changes are not saved to your profile. Events your profile already tolerates stay off automatically.
          </p>
        </section>
      )}

      {/* Track detail */}
      <section className="mt-5 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
        <h2 className="mb-2 text-sm font-bold text-[#e8edf5]">Filter track ({manifest.events.length} events)</h2>
        <ul className="space-y-1 text-xs text-[#94a3b8]">
          {sortEvents(manifest.events).map((e) => (
            <li key={e.id}>
              {fmt(e.startSeconds)}–{fmt(e.endSeconds)} · {ACTION_LABELS[e.action]} · {CATEGORY_LABELS[e.category]} · {e.severity}
              {disabledIds.has(e.id) ? " · tolerated by profile" : ""}
            </li>
          ))}
        </ul>
      </section>

      {/* Completion */}
      {ended && (
        <section className="mt-5 rounded-2xl border border-[#22D3EE] bg-[#06131a] p-5" aria-live="polite">
          <h2 className="text-sm font-black text-[#22D3EE]">Finished</h2>
          <p className="mt-1 text-sm text-[#e8edf5]">
            {counts.total} filter action{counts.total !== 1 ? "s" : ""} applied — {counts.muted} muted, {counts.skipped} skipped, {counts.warned} warnings.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={markWatched} aria-pressed={decision === "watched"}
              className={`rounded-full px-4 py-2 text-sm font-bold ${decision === "watched" ? "bg-[#22D3EE] text-[#06131a]" : "border border-[#22D3EE] text-[#22D3EE]"}`}>
              {decision === "watched" ? "Marked Watched ✓" : "Mark Watched"}
            </button>
            <Link href={`/title/${mediaId.split(":")[0]}/${mediaId.split(":")[1]}?mediaType=movie`}
              className="rounded-full border border-[#26324c] px-4 py-2 text-sm font-semibold text-[#94a3b8]">
              Back to title
            </Link>
            <Link href="/saved" className="rounded-full border border-[#26324c] px-4 py-2 text-sm font-semibold text-[#94a3b8]">
              My titles
            </Link>
          </div>
        </section>
      )}

      <p className="mt-8 text-xs leading-relaxed text-[#94a3b8]">
        This page plays video WatchedNotWatched is authorized to filter. It does not connect to, control, or alter playback from subscription streaming services.
      </p>
    </div>
  );
}
