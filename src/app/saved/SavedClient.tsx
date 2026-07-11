"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSaved, useWatchStatus, type SavedTitle } from "@/lib/useLocal";
import type { WatchDecision } from "@/lib/watchStatus";

type ListFilter = "all" | "saved" | "watched" | "not-watched";

interface Row {
  id: string;
  source: string;
  sourceId: string;
  mediaType: string;
  title: string;
  releaseYear?: number;
  posterUrl?: string;
  saved: boolean;
  decision: WatchDecision | null;
}

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "saved", label: "Saved for later" },
  { id: "watched", label: "Watched" },
  { id: "not-watched", label: "Not watched" },
];

export default function SavedClient() {
  const { saved, remove } = useSaved();
  const { entries, clear } = useWatchStatus();
  const [filter, setFilter] = useState<ListFilter>("all");

  const rows = useMemo<Row[]>(() => {
    const byId = new Map<string, Row>();
    const add = (t: SavedTitle | (typeof entries)[number], isSaved: boolean, decision: WatchDecision | null) => {
      const existing = byId.get(t.id);
      byId.set(t.id, {
        id: t.id,
        source: t.source,
        sourceId: t.sourceId,
        mediaType: t.mediaType,
        title: t.title,
        releaseYear: t.releaseYear,
        posterUrl: t.posterUrl,
        saved: existing?.saved || isSaved,
        decision: decision ?? existing?.decision ?? null,
      });
    };
    for (const t of saved) add(t, true, null);
    for (const e of entries) add(e, false, e.decision);
    return [...byId.values()];
  }, [saved, entries]);

  const visible = rows.filter((r) =>
    filter === "all" ? true
    : filter === "saved" ? r.saved
    : r.decision === filter,
  );

  const removeRow = (r: Row) => {
    if (r.saved) remove(r.id);
    if (r.decision) clear(r.id);
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-8 text-center">
        <p className="text-[#e8edf5]">Nothing here yet.</p>
        <p className="mt-1 text-sm text-[#94a3b8]">Mark a title Watched or Not Watched, or save it for later, from search or a title page.</p>
        <Link href="/search" className="mt-4 inline-block rounded-full bg-[#22D3EE] px-4 py-2 text-sm font-bold text-[#06131a]">Search titles</Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-[#94a3b8]">Saved on this device.</p>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter my titles">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f.id ? "bg-[#22D3EE] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center text-sm text-[#94a3b8]">
          No titles under “{FILTERS.find((f) => f.id === filter)?.label}”.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((t) => (
            <li key={t.id} className="flex gap-3 rounded-xl border border-[#26324c] bg-[#141d2e] p-3">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-[#0b1220]">
                {t.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.posterUrl} alt="" className="h-full w-full object-cover" />
                ) : <div className="flex h-full w-full items-center justify-center text-2xl">🎬</div>}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-sm font-bold text-[#e8edf5]">{t.title}</p>
                <p className="text-xs text-[#94a3b8]">{t.mediaType === "series" ? "Series" : "Movie"}{t.releaseYear ? ` · ${t.releaseYear}` : ""}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {t.decision === "watched" && <span className="rounded-full border border-[#22D3EE] px-2 py-0.5 text-[10px] font-bold text-[#22D3EE]">Watched</span>}
                  {t.decision === "not-watched" && <span className="rounded-full border border-[#94a3b8] px-2 py-0.5 text-[10px] font-bold text-[#94a3b8]">Not watched</span>}
                  {t.saved && <span className="rounded-full border border-[#26324c] px-2 py-0.5 text-[10px] font-bold text-[#94a3b8]">Saved for later</span>}
                </div>
                <div className="mt-auto flex gap-2 pt-2">
                  <Link href={`/title/${t.source}/${t.sourceId}?mediaType=${t.mediaType}`} className="rounded-full bg-[#22D3EE] px-3 py-1.5 text-xs font-bold text-[#06131a]">Details</Link>
                  <button onClick={() => removeRow(t)} className="rounded-full border border-[#26324c] px-3 py-1.5 text-xs font-semibold text-[#94a3b8] hover:text-[#e8edf5]">Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
