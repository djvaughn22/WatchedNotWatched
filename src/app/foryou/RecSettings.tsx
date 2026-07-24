"use client";

// Preferences + privacy controls for For You. One disclosure, no modals.
// Every control writes localStorage only; the privacy copy states exactly
// what leaves the device.

import { TONES, type RecPrefs } from "@/lib/recommendations/prefs";

const CHIP = (active: boolean) =>
  `min-h-10 rounded-full border px-3.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] ${
    active ? "border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE]" : "border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"
  }`;

const RUNTIMES = [30, 60, 90, 120] as const;

export default function RecSettings({
  prefs,
  dismissedCount,
  onChange,
  onResetHistory,
  onClearPrefs,
}: {
  prefs: RecPrefs;
  dismissedCount: number;
  onChange: (next: RecPrefs) => void;
  onResetHistory: () => void;
  onClearPrefs: () => void;
}) {
  const toggleTone = (t: string) =>
    onChange({
      ...prefs,
      tones: prefs.tones.includes(t) ? prefs.tones.filter((x) => x !== t) : [...prefs.tones, t].slice(0, 4),
    });

  return (
    <details className="rounded-2xl border border-[#26324c] bg-[#141d2e]">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-[#94a3b8]">
        Preferences &amp; privacy
      </summary>
      <div className="space-y-4 px-4 pb-4">
        <div>
          <h3 className="mb-1.5 text-xs font-black uppercase tracking-widest text-[#64748b]">Movies or series</h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Movies or series">
            {(
              [
                ["movie", "Movies"],
                ["series", "Series"],
                ["either", "Either"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} onClick={() => onChange({ ...prefs, mediaType: v })} aria-pressed={prefs.mediaType === v} className={CHIP(prefs.mediaType === v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-1.5 text-xs font-black uppercase tracking-widest text-[#64748b]">Mood</h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mood">
            {TONES.map((t) => (
              <button key={t} onClick={() => toggleTone(t)} aria-pressed={prefs.tones.includes(t)} className={CHIP(prefs.tones.includes(t))}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-1.5 text-xs font-black uppercase tracking-widest text-[#64748b]">Content comfort</h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Content comfort">
            {(
              [
                ["family", "Family-friendly only"],
                ["standard", "Standard"],
                ["open", "Anything"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => onChange({ ...prefs, contentComfort: v })}
                aria-pressed={prefs.contentComfort === v}
                className={CHIP(prefs.contentComfort === v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-1.5 text-xs font-black uppercase tracking-widest text-[#64748b]">Quick Watch time budget</h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick Watch time budget">
            {RUNTIMES.map((r) => (
              <button
                key={r}
                onClick={() => onChange({ ...prefs, runtimeMaxMinutes: prefs.runtimeMaxMinutes === r ? undefined : r })}
                aria-pressed={prefs.runtimeMaxMinutes === r}
                className={CHIP(prefs.runtimeMaxMinutes === r)}
              >
                {r} min
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[#26324c] pt-3">
          <p className="text-xs leading-relaxed text-[#94a3b8]">
            Your viewing choices are used to improve your recommendations. WatchedNotWatched sends only the minimum
            needed to create them: your liked titles, genre leanings, and these preferences. Your full library and
            ratings stay on this device.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              onClick={() => onChange({ ...prefs, personalizationEnabled: !prefs.personalizationEnabled })}
              aria-pressed={!prefs.personalizationEnabled}
              className={CHIP(!prefs.personalizationEnabled)}
            >
              {prefs.personalizationEnabled ? "Turn off personalization" : "Personalization is off — turn on"}
            </button>
            <button onClick={onResetHistory} className={CHIP(false)}>
              Reset recommendation history{dismissedCount > 0 ? ` (${dismissedCount})` : ""}
            </button>
            <button onClick={onClearPrefs} className={CHIP(false)}>
              Clear preferences
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-[#64748b]">
            Reset clears dismissed titles and stored feedback from this device; cleared titles can be recommended again.
          </p>
        </div>
      </div>
    </details>
  );
}
