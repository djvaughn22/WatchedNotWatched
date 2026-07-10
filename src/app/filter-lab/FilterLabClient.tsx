"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_MANIFEST, DEMO_VIDEO } from "@/data/filterManifests";
import { FilterEngine, type EngineState } from "@/lib/filter/engine";
import { createHtml5Player } from "@/lib/filter/html5";
import {
  ACTION_LABELS,
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type FilterAction,
  type FilterCategory,
} from "@/lib/filter/types";
import { sortEvents } from "@/lib/filter/manifest";

const manifest = DEMO_MANIFEST;
const usedCategories = Array.from(new Set(manifest.events.map((e) => e.category)));

const PRESETS: { id: string; label: string; categories: FilterCategory[] | "all" }[] = [
  { id: "little-kids", label: "Little Kids", categories: "all" },
  { id: "kids", label: "Kids", categories: ["language", "violence", "frightening", "substance-use"] },
  { id: "family", label: "Family", categories: ["language", "violence", "substance-use"] },
  { id: "teens", label: "Teens", categories: ["violence", "substance-use"] },
  { id: "custom", label: "Custom", categories: [] },
];

// action → shape (never rely on color alone)
const ACTION_GLYPH: Record<FilterAction, string> = { mute: "●", skip: "▮", warn: "▲" };

function fmt(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function FilterLabClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<FilterEngine | null>(null);

  const [state, setState] = useState<EngineState | null>(null);
  const [enabledCats, setEnabledCats] = useState<Set<FilterCategory>>(new Set(usedCategories));
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const [preset, setPreset] = useState("little-kids");
  const [duration, setDuration] = useState(manifest.durationSeconds);
  const [current, setCurrent] = useState(0);
  const [ended, setEnded] = useState(false);
  const [src, setSrc] = useState<string>(DEMO_VIDEO.src);

  const events = useMemo(() => sortEvents(manifest.events), []);

  // Wire engine to the video element.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const player = createHtml5Player(video);
    const engine = new FilterEngine(player, manifest, {
      enabledCategories: new Set(usedCategories),
      disabledEventIds: new Set(),
      warnLeadSeconds: 3,
    });
    engineRef.current = engine;
    const unsub = engine.subscribe(setState);
    engine.start();

    const onMeta = () => setDuration(video.duration || manifest.durationSeconds);
    const onTime = () => setCurrent(video.currentTime || 0);
    const onEnded = () => setEnded(true);
    const onPlay = () => setEnded(false);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);
    return () => {
      unsub();
      engine.stop();
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
    };
  }, [src]);

  // Push settings into the engine when toggles change.
  useEffect(() => {
    engineRef.current?.setSettings({ enabledCategories: enabledCats, disabledEventIds: disabledIds });
  }, [enabledCats, disabledIds]);

  const applyPreset = (id: string) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p || p.id === "custom") return;
    const cats = p.categories === "all" ? new Set(usedCategories) : new Set(p.categories.filter((c) => usedCategories.includes(c)));
    setEnabledCats(cats);
    setDisabledIds(new Set());
  };

  const toggleCategory = (c: FilterCategory) => {
    setPreset("custom");
    setEnabledCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  const toggleEvent = (id: string) => {
    setPreset("custom");
    setDisabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const enableAll = () => { setPreset("custom"); setEnabledCats(new Set(usedCategories)); setDisabledIds(new Set()); };
  const disableAll = () => { setPreset("custom"); setEnabledCats(new Set()); };

  const seekTo = (s: number) => {
    const v = videoRef.current;
    if (v) { v.currentTime = Math.max(0, s - 0.3); v.play().catch(() => {}); }
  };

  const active = state?.activeEvents ?? [];
  const upcoming = state?.upcoming ?? null;
  const counts = state?.counts ?? { muted: 0, skipped: 0, warned: 0, total: 0 };
  const activeNow = active[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-[#e8edf5] sm:text-3xl">Filter Lab</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#94a3b8]">
          A working demonstration of automatic mute and skip on supported video. Toggle filters and watch the player respond in real time. Everything here stays on your device.
        </p>
      </header>

      {/* Player */}
      <div className="overflow-hidden rounded-2xl border border-[#26324c] bg-black">
        <div className="relative aspect-video w-full bg-black">
          <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            className="h-full w-full"
            onError={() => { if (src !== DEMO_VIDEO.localOverride) setSrc(DEMO_VIDEO.localOverride); }}
          />
          {/* Notices (aria-live) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3" aria-live="polite">
            {upcoming && (
              <span className="rounded-full border border-[#26324c] bg-[#0b1220]/90 px-3 py-1.5 text-xs font-bold text-[#e8edf5]">
                {ACTION_LABELS[upcoming.event.action]} · {CATEGORY_LABELS[upcoming.event.category]} in {upcoming.secondsUntil}s
              </span>
            )}
            {activeNow && (
              <span className="rounded-full border border-[#22D3EE] bg-[#06131a]/90 px-3 py-1.5 text-xs font-bold text-[#22D3EE]">
                {activeNow.action === "skip" ? "Scene skipped" : activeNow.action === "mute" ? "Language muted" : "Heads-up"} — {PRESETS.find((p) => p.id === preset)?.label} preset
              </span>
            )}
          </div>
        </div>
        {/* status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#26324c] px-4 py-3 text-xs text-[#94a3b8]">
          <span>{fmt(current)} / {fmt(duration)}</span>
          <span>
            Now: <span className="font-bold text-[#e8edf5]">{activeNow ? `${ACTION_LABELS[activeNow.action]} — ${CATEGORY_LABELS[activeNow.category]}` : "—"}</span>
          </span>
          <span>Filtered this session: <span className="font-bold text-[#22D3EE]">{counts.total}</span></span>
        </div>
      </div>
      <p className="mt-2 text-xs text-[#94a3b8]">{DEMO_VIDEO.attribution}</p>

      {/* Timeline */}
      <section className="mt-6" aria-label="Filter timeline">
        <h2 className="mb-2 text-sm font-bold text-[#e8edf5]">Timeline</h2>
        <div className="relative h-10 rounded-lg border border-[#26324c] bg-[#141d2e]">
          {/* playhead */}
          <div className="absolute top-0 h-full w-0.5 bg-[#22D3EE]" style={{ left: `${Math.min(100, (current / duration) * 100)}%` }} aria-hidden />
          {events.map((e) => {
            const left = Math.min(98, (e.startSeconds / duration) * 100);
            const on = enabledCats.has(e.category) && !disabledIds.has(e.id);
            return (
              <button
                key={e.id}
                onClick={() => seekTo(e.startSeconds)}
                title={`${ACTION_LABELS[e.action]} · ${CATEGORY_LABELS[e.category]} · ${fmt(e.startSeconds)}`}
                aria-label={`${ACTION_LABELS[e.action]} ${CATEGORY_LABELS[e.category]} at ${fmt(e.startSeconds)}. ${on ? "Enabled" : "Disabled"}. Jump here.`}
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded px-1 text-[11px] font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${on ? "text-[#22D3EE]" : "text-[#475569]"}`}
                style={{ left: `${left}%` }}
              >
                {ACTION_GLYPH[e.action]}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-[#94a3b8]">
          <span>● Mute</span><span>▮ Skip</span><span>▲ Warn</span>
        </div>
      </section>

      {/* Controls */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
          <h2 className="mb-3 text-sm font-bold text-[#e8edf5]">Presets</h2>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                aria-pressed={preset === p.id}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${preset === p.id ? "bg-[#22D3EE] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#94a3b8]">Presets are a starting point, not a safety guarantee.</p>
          <div className="mt-4 flex gap-2">
            <button onClick={enableAll} className="rounded-full border border-[#26324c] px-3 py-1.5 text-xs font-semibold text-[#e8edf5] hover:bg-[#0b1220]">Enable all</button>
            <button onClick={disableAll} className="rounded-full border border-[#26324c] px-3 py-1.5 text-xs font-semibold text-[#e8edf5] hover:bg-[#0b1220]">Disable all</button>
          </div>
        </section>

        <section className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
          <h2 className="mb-3 text-sm font-bold text-[#e8edf5]">Categories</h2>
          <div className="space-y-2">
            {ALL_CATEGORIES.filter((c) => usedCategories.includes(c)).map((c) => {
              const on = enabledCats.has(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  role="switch"
                  aria-checked={on}
                  className="flex w-full items-center justify-between rounded-lg border border-[#26324c] px-3 py-2 text-sm text-[#e8edf5] hover:bg-[#0b1220]"
                >
                  <span>{CATEGORY_LABELS[c]}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${on ? "bg-[#22D3EE] text-[#06131a]" : "bg-[#26324c] text-[#94a3b8]"}`}>{on ? "On" : "Off"}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Event panel */}
      <section className="mt-6 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
        <h2 className="mb-3 text-sm font-bold text-[#e8edf5]">Filter events ({events.length})</h2>
        <ul className="divide-y divide-[#26324c]">
          {events.map((e) => {
            const on = enabledCats.has(e.category) && !disabledIds.has(e.id);
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#e8edf5]">
                    {ACTION_GLYPH[e.action]} {e.label}
                  </p>
                  <p className="text-xs text-[#94a3b8]">
                    {ACTION_LABELS[e.action]} · {CATEGORY_LABELS[e.category]} · {e.severity} · {fmt(e.startSeconds)}–{fmt(e.endSeconds)}
                  </p>
                </div>
                <button
                  onClick={() => toggleEvent(e.id)}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${on ? "Disable" : "Enable"} ${e.label}`}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-[#22D3EE] text-[#06131a]" : "bg-[#26324c] text-[#94a3b8]"}`}
                >
                  {on ? "On" : "Off"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* End-of-session summary */}
      {ended && (
        <section className="mt-6 rounded-2xl border border-[#22D3EE] bg-[#06131a] p-5">
          <h2 className="text-sm font-black text-[#22D3EE]">Session summary</h2>
          <p className="mt-1 text-sm text-[#e8edf5]">
            {counts.total} filter{counts.total !== 1 ? "s" : ""} applied — {counts.muted} muted, {counts.skipped} skipped, {counts.warned} warnings.
          </p>
          <p className="mt-1 text-xs text-[#94a3b8]">
            Categories involved: {Array.from(new Set(events.filter((e) => (state?.appliedEventIds ?? []).includes(e.id)).map((e) => CATEGORY_LABELS[e.category]))).join(", ") || "—"}. This session stayed on your device.
          </p>
        </section>
      )}

      <p className="mt-8 text-xs leading-relaxed text-[#94a3b8]">
        This demonstration filters a licensed sample video only. WatchedNotWatched does not connect to or alter playback from subscription streaming services.
      </p>
    </div>
  );
}
