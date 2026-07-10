"use client";

import { useProfiles } from "@/lib/useLocal";

export default function ProfileChips({ compact = false }: { compact?: boolean }) {
  const { store, active, setActive } = useProfiles();
  if (!store) {
    return <div className="h-9 w-full animate-pulse rounded-full bg-[#141d2e]" aria-hidden />;
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Who is watching">
        {store.profiles.map((p) => {
          const on = active?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              aria-pressed={on}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                on ? "bg-[#22D3EE] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      {!compact && (
        <p className="mt-2 text-xs text-[#94a3b8]">
          Saved on this device. Used to explain how a title fits — never a safety guarantee.
        </p>
      )}
    </div>
  );
}
