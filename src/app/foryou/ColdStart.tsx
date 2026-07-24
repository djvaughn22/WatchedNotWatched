"use client";

// Cold start: one compact screen. Tap a few well-known titles you enjoyed
// (saved as Watched + Liked — real library entries, so everything else in
// the app learns too), optionally set movie/series and a mood, done.

import { useEffect, useState } from "react";
import type { SearchResultItem } from "@/lib/media/types";
import { toTitleRef } from "@/app/components/TitleCard";
import { TONES, type RecPrefs } from "@/lib/recommendations/prefs";
import type { TitleRef } from "@/lib/library";

const CHIP = (active: boolean) =>
  `min-h-10 rounded-full border px-3.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] ${
    active ? "border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE]" : "border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"
  }`;

export default function ColdStart({
  prefs,
  canSkip,
  onDone,
}: {
  prefs: RecPrefs;
  canSkip: boolean;
  onDone: (picked: TitleRef[], next: RecPrefs) => void;
}) {
  const [titles, setTitles] = useState<SearchResultItem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mediaType, setMediaType] = useState<RecPrefs["mediaType"]>(prefs.mediaType);
  const [tones, setTones] = useState<string[]>(prefs.tones);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      (["movie", "series"] as const).map((t) =>
        fetch(`/api/top?type=${t}`, { signal: controller.signal })
          .then((r) => r.json())
          .then((d: { items?: SearchResultItem[] }) => d.items ?? [])
          .catch(() => [] as SearchResultItem[]),
      ),
    ).then(([movies, series]) => {
      // Interleave so both types are visible without scrolling far.
      const mix: SearchResultItem[] = [];
      for (let i = 0; i < 9; i++) {
        if (movies[i]) mix.push(movies[i]);
        if (series[i]) mix.push(series[i]);
      }
      setTitles(mix.slice(0, 18));
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  const toggleTitle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleTone = (t: string) =>
    setTones((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 4)));

  const finish = () => {
    const refs = titles.filter((t) => picked.has(t.id)).map(toTitleRef);
    onDone(refs, {
      ...prefs,
      mediaType,
      tones,
      contentComfort: tones.includes("Family-friendly") ? "family" : prefs.contentComfort,
      setupDone: true,
    });
  };

  return (
    <section className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-4">
      <h2 className="text-lg font-black text-[#e8edf5]">Give us a starting point</h2>
      <p className="mt-1 text-sm text-[#94a3b8]">Tap a few titles you enjoyed. Everything stays on your device.</p>

      {loading ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-[#0b1220]" />
          ))}
        </div>
      ) : titles.length === 0 ? (
        <p className="mt-3 rounded-lg border border-[#26324c] p-3 text-sm text-[#94a3b8]">
          Couldn&apos;t load starter titles. You can still pick a mood below, or rate titles from search.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Titles you enjoyed">
          {titles.map((t) => {
            const on = picked.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleTitle(t.id)}
                aria-pressed={on}
                className={`relative overflow-hidden rounded-lg border-2 bg-[#0b1220] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] ${
                  on ? "border-[#22D3EE]" : "border-transparent"
                }`}
              >
                {t.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.posterUrl} alt={t.title} className="aspect-[2/3] w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex aspect-[2/3] items-center justify-center p-1 text-center text-[10px] font-bold text-[#94a3b8]">
                    {t.title}
                  </span>
                )}
                {on && (
                  <span className="absolute right-1 top-1 rounded-full bg-[#22D3EE] px-1.5 text-xs font-black text-[#06131a]" aria-hidden>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Movies or series?">
        {(
          [
            ["movie", "Movies"],
            ["series", "Series"],
            ["either", "Either"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} onClick={() => setMediaType(v)} aria-pressed={mediaType === v} className={CHIP(mediaType === v)}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="What sounds good?">
        {TONES.map((t) => (
          <button key={t} onClick={() => toggleTone(t)} aria-pressed={tones.includes(t)} className={CHIP(tones.includes(t))}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={finish}
          disabled={picked.size === 0 && tones.length === 0}
          className="min-h-11 rounded-xl bg-[#22D3EE] px-5 text-sm font-black text-[#06131a] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
        >
          Show my picks
        </button>
        {canSkip && (
          <button onClick={finish} className="min-h-11 text-sm font-bold text-[#94a3b8] hover:text-[#e8edf5]">
            Skip — use my ratings
          </button>
        )}
      </div>
    </section>
  );
}
