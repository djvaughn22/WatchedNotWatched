"use client";

// Inline editor for local viewing preferences ("Make this personal").
// Everything is optional — the decision card works without any of it and
// gets smarter as things are set. Saved only on this device.

import { MOVIE_GENRES, TV_GENRES } from "@/lib/media/genres";
import { CATEGORY_IDS, CATEGORY_LABELS, OCCASION_LABELS, OCCASIONS } from "@/lib/guidance/types";
import {
  CHALLENGE_PREFS,
  SENSITIVITIES,
  SENSITIVITY_LABELS,
  TONE_PREFS,
  type ViewingPrefs,
} from "@/lib/prefs";

const ALL_GENRES = [...new Set([...MOVIE_GENRES, ...TV_GENRES].map((g) => g.label))].sort();

const TONE_LABELS: Record<(typeof TONE_PREFS)[number], string> = {
  either: "Either",
  light: "Lighter",
  dark: "Darker",
};
const CHALLENGE_LABELS: Record<(typeof CHALLENGE_PREFS)[number], string> = {
  either: "Either",
  easy: "Easy viewing",
  challenging: "Challenging",
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
        active ? "bg-[#22D3EE] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-[#64748b]">{hint}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function PreferencesEditor({
  prefs,
  setPrefs,
  onDone,
  onReset,
}: {
  prefs: ViewingPrefs;
  setPrefs: (update: (prev: ViewingPrefs) => ViewingPrefs) => void;
  onDone: () => void;
  onReset: () => void;
}) {
  const toggleList = (field: "preferredGenres" | "avoidGenres", genre: string) =>
    setPrefs((p) => {
      const has = p[field].includes(genre);
      const other = field === "preferredGenres" ? "avoidGenres" : "preferredGenres";
      return {
        ...p,
        [field]: has ? p[field].filter((g) => g !== genre) : [...p[field], genre],
        // A genre can't be both enjoyed and avoided.
        [other]: p[other].filter((g) => g !== genre),
      };
    });

  return (
    <div className="space-y-4 rounded-xl border border-[#26324c] bg-[#0b1220] p-4">
      <div>
        <h3 className="text-sm font-bold text-[#e8edf5]">My viewing preferences</h3>
        <p className="mt-0.5 text-xs text-[#64748b]">
          All optional — set what helps. Stored only on this device, never sent anywhere.
        </p>
      </div>

      <Field label="Who's watching?" hint="Used to flag titles that don't fit the youngest viewer.">
        <Chip active={prefs.kidsWatching} onClick={() => setPrefs((p) => ({ ...p, kidsWatching: !p.kidsWatching }))}>
          Kids (under 13)
        </Chip>
        <Chip active={prefs.teensWatching} onClick={() => setPrefs((p) => ({ ...p, teensWatching: !p.teensWatching }))}>
          Teens
        </Chip>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Ages of viewers, optional, comma separated"
          placeholder="Ages (optional): 8, 11, 41"
          defaultValue={prefs.viewerAges.join(", ")}
          onChange={(e) => {
            const ages = e.target.value
              .split(/[,\s]+/)
              .map((s) => Number(s))
              .filter((n) => Number.isFinite(n) && n > 0 && n <= 120);
            setPrefs((p) => ({ ...p, viewerAges: ages }));
          }}
          className="min-w-0 flex-1 rounded-full border border-[#26324c] bg-transparent px-3 py-1.5 text-xs text-[#e8edf5] placeholder:text-[#64748b] focus:border-[#22D3EE] focus:outline-none"
        />
      </Field>

      <Field label="Genres I enjoy">
        {ALL_GENRES.map((g) => (
          <Chip key={g} active={prefs.preferredGenres.includes(g)} onClick={() => toggleList("preferredGenres", g)}>
            {g}
          </Chip>
        ))}
      </Field>

      <Field label="Genres I usually avoid">
        {ALL_GENRES.map((g) => (
          <Chip key={g} active={prefs.avoidGenres.includes(g)} onClick={() => toggleList("avoidGenres", g)}>
            {g}
          </Chip>
        ))}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tone I'm after">
          {TONE_PREFS.map((t) => (
            <Chip key={t} active={prefs.tone === t} onClick={() => setPrefs((p) => ({ ...p, tone: t }))}>
              {TONE_LABELS[t]}
            </Chip>
          ))}
        </Field>
        <Field label="Viewing effort">
          {CHALLENGE_PREFS.map((c) => (
            <Chip key={c} active={prefs.challenge === c} onClick={() => setPrefs((p) => ({ ...p, challenge: c }))}>
              {CHALLENGE_LABELS[c]}
            </Chip>
          ))}
        </Field>
      </div>

      <Field label="Content comfort" hint="How much of each is OK for your usual watch.">
        <div className="w-full space-y-2">
          {CATEGORY_IDS.map((id) => (
            <div key={id} className="flex flex-wrap items-center gap-1.5">
              <span className="w-32 shrink-0 text-xs font-semibold text-[#94a3b8]">{CATEGORY_LABELS[id]}</span>
              <Chip
                active={!prefs.sensitivities[id]}
                onClick={() =>
                  setPrefs((p) => {
                    const next = { ...p.sensitivities };
                    delete next[id];
                    return { ...p, sensitivities: next };
                  })
                }
              >
                {SENSITIVITY_LABELS.not_sensitive}
              </Chip>
              {SENSITIVITIES.filter((s) => s !== "not_sensitive").map((s) => (
                <Chip
                  key={s}
                  active={prefs.sensitivities[id] === s}
                  onClick={() => setPrefs((p) => ({ ...p, sensitivities: { ...p.sensitivities, [id]: s } }))}
                >
                  {SENSITIVITY_LABELS[s]}
                </Chip>
              ))}
            </div>
          ))}
        </div>
      </Field>

      <Field label="Tonight's mood">
        <Chip active={prefs.occasion === "any"} onClick={() => setPrefs((p) => ({ ...p, occasion: "any" }))}>
          Any
        </Chip>
        {OCCASIONS.map((o) => (
          <Chip key={o} active={prefs.occasion === o} onClick={() => setPrefs((p) => ({ ...p, occasion: o }))}>
            {OCCASION_LABELS[o]}
          </Chip>
        ))}
      </Field>

      <div className="flex items-center justify-between gap-2 border-t border-[#26324c] pt-3">
        <button type="button" onClick={onReset} className="text-xs font-semibold text-[#64748b] hover:text-[#e8edf5]">
          Reset all
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full bg-[#22D3EE] px-4 py-2 text-xs font-bold text-[#06131a]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
