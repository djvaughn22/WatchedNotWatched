"use client";

// The one product-wide control: WatchedNotWatched (movies + TV) vs.
// ReadNotRead (books). Lives in the quick-nav bar so it's visible and
// switchable from every page, not just the homepage.

import { useMode } from "@/app/ModeProvider";
import type { AppMode } from "@/lib/mode";

const OPTIONS: Array<{ value: AppMode; label: string }> = [
  { value: "screen", label: "WatchedNotWatched" },
  { value: "book", label: "ReadNotRead" },
];

export default function ModeSwitch() {
  const { mode, setMode } = useMode();
  return (
    <div
      role="group"
      aria-label="Product mode"
      className="flex shrink-0 rounded-full border border-[#26324c] bg-[#0e1626] p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setMode(o.value)}
          aria-pressed={mode === o.value}
          className={`min-h-8 whitespace-nowrap rounded-full px-3 text-xs font-bold transition-colors ${
            mode === o.value ? "bg-[#22D3EE] text-[#06131a]" : "text-[#94a3b8] hover:text-[#e8edf5]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
