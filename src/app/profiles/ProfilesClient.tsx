"use client";

import { CATEGORY_LABELS } from "@/lib/filter/types";
import { LEVEL_LABELS } from "@/lib/guidance";
import { useProfiles } from "@/lib/useLocal";

export default function ProfilesClient() {
  const { store, active, setActive, reset } = useProfiles();
  if (!store) return <div className="h-40 animate-pulse rounded-2xl bg-[#141d2e]" />;

  return (
    <div>
      <p className="mb-4 text-sm text-[#94a3b8]">
        Profiles are how a title is compared to your household’s settings. No account, no birth dates, no real names — <strong className="text-[#e8edf5]">saved on this device</strong>.
      </p>

      <div className="flex flex-wrap gap-2">
        {store.profiles.map((p) => (
          <button key={p.id} onClick={() => setActive(p.id)} aria-pressed={active?.id === p.id}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${active?.id === p.id ? "bg-[#22D3EE] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8]"}`}>
            {p.name}
          </button>
        ))}
      </div>

      {active && (
        <section className="mt-6 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
          <h2 className="text-sm font-bold text-[#e8edf5]">{active.name} — category limits</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.entries(active.thresholds).map(([cat, level]) => (
              <div key={cat} className="flex items-center justify-between rounded-lg border border-[#26324c] px-3 py-2 text-sm">
                <span className="text-[#e8edf5]">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}</span>
                <span className="text-[#94a3b8]">up to {LEVEL_LABELS[level].toLowerCase()}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#94a3b8]">
            A title is “Review first” or “Outside settings” when a reviewed category exceeds these limits. Unreviewed categories are never treated as safe.
          </p>
        </section>
      )}

      <button onClick={reset} className="mt-6 rounded-full border border-[#26324c] px-4 py-2 text-sm font-semibold text-[#94a3b8] hover:text-[#e8edf5]">
        Reset profiles to defaults
      </button>
    </div>
  );
}
