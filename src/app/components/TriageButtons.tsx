"use client";

// The brand mechanic in button form: you've Watched it, or you haven't —
// and if you haven't, you Want to Watch it or Prob Not.
// One color per decision, everywhere in the app:
//   Watched = cyan · Want to Watch = blue · Prob Not = slate.
// Tapping the active state again un-marks the title (fast oops recovery).

import type { LibraryEntry, LibraryStatus, TitleRef } from "@/lib/library";

export const STATUS_COLORS: Record<LibraryStatus, string> = {
  watched: "#22D3EE",
  want_to_watch: "#60A5FA",
  prob_not: "#64748B",
};

const BUTTONS: Array<{
  status: LibraryStatus;
  idle: string;
  active: string;
  classIdle: string;
  classActive: string;
}> = [
  {
    status: "watched",
    idle: "✓ Watched",
    active: "✓ Watched",
    classIdle: "border-[#22D3EE]/50 text-[#22D3EE] hover:bg-[#22D3EE]/10",
    classActive: "border-[#22D3EE] bg-[#22D3EE] text-[#06131a]",
  },
  {
    status: "want_to_watch",
    idle: "+ Want to Watch",
    active: "★ On your list",
    classIdle: "border-[#60A5FA]/50 text-[#60A5FA] hover:bg-[#60A5FA]/10",
    classActive: "border-[#60A5FA] bg-[#60A5FA] text-[#06131a]",
  },
  {
    status: "prob_not",
    idle: "Prob Not",
    active: "Prob Not ✓",
    classIdle: "border-[#26324c] text-[#64748b] hover:text-[#94a3b8] hover:bg-[#64748B]/10",
    classActive: "border-[#64748B] bg-[#64748B] text-[#06131a]",
  },
];

export default function TriageButtons({
  titleRef,
  entry,
  onMark,
  onClear,
  size = "sm",
}: {
  titleRef: TitleRef;
  entry: LibraryEntry | undefined;
  onMark: (ref: TitleRef, status: LibraryStatus) => void;
  /** Called when the active status is tapped again (un-mark). */
  onClear: (id: string) => void;
  size?: "sm" | "lg";
}) {
  const pad = size === "lg" ? "px-4 py-2.5 text-sm" : "px-2 py-2 text-xs";
  return (
    <div className={size === "lg" ? "flex flex-wrap gap-2" : "grid gap-1.5"}>
      <div className={size === "lg" ? "contents" : "grid grid-cols-2 gap-1.5"}>
        {BUTTONS.slice(0, 2).map((b) => {
          const active = entry?.status === b.status;
          return (
            <button
              key={b.status}
              onClick={() => (active ? onClear(titleRef.id) : onMark(titleRef, b.status))}
              aria-pressed={active}
              className={`rounded-lg border font-bold transition-colors ${pad} ${active ? b.classActive : b.classIdle}`}
            >
              {active ? b.active : b.idle}
            </button>
          );
        })}
      </div>
      {(() => {
        const b = BUTTONS[2];
        const active = entry?.status === b.status;
        return (
          <button
            onClick={() => (active ? onClear(titleRef.id) : onMark(titleRef, b.status))}
            aria-pressed={active}
            className={`rounded-lg border font-bold transition-colors ${pad} ${active ? b.classActive : b.classIdle}`}
          >
            {active ? b.active : b.idle}
          </button>
        );
      })()}
    </div>
  );
}
