"use client";

// The personal library — the product. Views are derived from status + My Take
// + Again; filters and sorting stay client-side over local data.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AGAIN_LABELS,
  MY_TAKE_LABELS,
  STATUS_LABELS,
  VIEW_LABELS,
  inView,
  type Again,
  type LibraryEntry,
  type LibraryView,
  type MyTake,
} from "@/lib/library";
import { useLibrary } from "@/lib/useLocal";
import { emailSummaryUrl, exportCsv, exportJson, exportMarkdown, shareSummary } from "@/lib/export";

const VIEWS: LibraryView[] = ["all", "want_to_watch", "watched", "watch_again", "favorites", "not_for_me", "prob_not"];
const TAKES: MyTake[] = ["loved", "liked", "fine", "not_for_me"];
const AGAINS: Again[] = ["yes", "maybe", "no"];

type SortKey = "added" | "watched" | "title" | "year" | "take";

const SORT_LABELS: Record<SortKey, string> = {
  added: "Recently added",
  watched: "Recently watched",
  title: "Title A–Z",
  year: "Release year",
  take: "My Take",
};

const TAKE_ORDER: Record<MyTake, number> = { loved: 0, liked: 1, fine: 2, not_for_me: 3 };

function sortEntries(entries: LibraryEntry[], sort: SortKey): LibraryEntry[] {
  const list = [...entries];
  switch (sort) {
    case "added":
      return list.sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
    case "watched":
      return list.sort((a, b) => (b.watchedAt ?? "").localeCompare(a.watchedAt ?? ""));
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "year":
      return list.sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0));
    case "take":
      return list.sort((a, b) => (a.myTake ? TAKE_ORDER[a.myTake] : 9) - (b.myTake ? TAKE_ORDER[b.myTake] : 9));
  }
}

export default function LibraryClient() {
  const params = useSearchParams();
  const initialView = (params.get("view") as LibraryView) || "all";
  const { entries, hydrated, mark, take, again, removeMany, restore } = useLibrary();

  const [view, setView] = useState<LibraryView>(VIEWS.includes(initialView) ? initialView : "all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [takeFilter, setTakeFilter] = useState("all");
  const [againFilter, setAgainFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("added");

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [undoStack, setUndoStack] = useState<LibraryEntry[] | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const genres = useMemo(
    () => [...new Set(entries.flatMap((e) => e.genres ?? []))].sort(),
    [entries],
  );
  const years = useMemo(
    () => [...new Set(entries.map((e) => e.releaseYear).filter((y): y is number => !!y))].sort((a, b) => b - a),
    [entries],
  );

  const visible = useMemo(() => {
    const filtered = entries.filter(
      (e) =>
        inView(e, view) &&
        (typeFilter === "all" || e.mediaType === typeFilter) &&
        (genreFilter === "all" || (e.genres ?? []).includes(genreFilter)) &&
        (yearFilter === "all" || String(e.releaseYear) === yearFilter) &&
        (takeFilter === "all" || e.myTake === takeFilter) &&
        (againFilter === "all" || e.again === againFilter),
    );
    return sortEntries(filtered, sort);
  }, [entries, view, typeFilter, genreFilter, yearFilter, takeFilter, againFilter, sort]);

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAllVisible = () => setSelected(new Set(visible.map((e) => e.id)));

  const exitSelection = () => {
    setSelecting(false);
    setSelected(new Set());
    setConfirmRemove(false);
  };

  const selectedEntries = entries.filter((e) => selected.has(e.id));

  const bulkMark = (status: "watched" | "want_to_watch" | "prob_not") => {
    for (const e of selectedEntries) mark(e, status);
    exitSelection();
  };

  const bulkAgain = (value: Again) => {
    for (const e of selectedEntries) again(e.id, value);
    exitSelection();
  };

  const bulkRemove = () => {
    const removed = selectedEntries;
    removeMany([...selected]);
    exitSelection();
    setUndoStack(removed);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoStack(null), 8000);
  };

  const removeOne = (e: LibraryEntry) => {
    removeMany([e.id]);
    setUndoStack([e]);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoStack(null), 8000);
  };

  const undo = () => {
    if (undoStack) restore(undoStack);
    setUndoStack(null);
  };

  const doShare = async () => {
    const result = await shareSummary(entries);
    setShareMsg(result === "copied" ? "Summary copied" : result === "failed" ? "Couldn’t share" : "");
    setTimeout(() => setShareMsg(""), 2000);
  };

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[#141d2e]" />;
  }

  const undoSnackbar = undoStack && (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#26324c] bg-[#0e1626] px-4 py-2.5 shadow-lg">
      <span className="text-sm text-[#e8edf5]">
        Removed {undoStack.length === 1 ? `“${undoStack[0].title}”` : `${undoStack.length} titles`}
      </span>
      <button onClick={undo} className="text-sm font-bold text-[#22D3EE]">Undo</button>
    </div>
  );

  if (entries.length === 0) {
    return (
      <>
        <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-8 text-center">
          <p className="text-[#e8edf5]">Your library is empty.</p>
          <p className="mt-1 text-sm text-[#94a3b8]">Search a title and tap Watched or Want to Watch — it lands here.</p>
          <Link href="/search" className="mt-4 inline-block rounded-full bg-[#22D3EE] px-4 py-2 text-sm font-bold text-[#06131a]">Search titles</Link>
        </div>
        {undoSnackbar}
      </>
    );
  }

  const select = "rounded-lg border border-[#26324c] bg-[#141d2e] px-2 py-1.5 text-xs text-[#e8edf5]";

  return (
    <>
      {/* Views */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Library view">
        {VIEWS.map((v) => {
          const count = entries.filter((e) => inView(e, v)).length;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${view === v ? "bg-[#22D3EE] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"}`}
            >
              {VIEW_LABELS[v]} {count > 0 ? `(${count})` : ""}
            </button>
          );
        })}
      </div>

      {/* Filters + sort */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type" className={select}>
          <option value="all">All types</option>
          <option value="movie">Movies</option>
          <option value="series">TV</option>
        </select>
        {genres.length > 0 && (
          <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} aria-label="Filter by genre" className={select}>
            <option value="all">All genres</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        {years.length > 1 && (
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} aria-label="Filter by year" className={select}>
            <option value="all">All years</option>
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        )}
        <select value={takeFilter} onChange={(e) => setTakeFilter(e.target.value)} aria-label="Filter by My Take" className={select}>
          <option value="all">Any take</option>
          {TAKES.map((t) => <option key={t} value={t}>{MY_TAKE_LABELS[t]}</option>)}
        </select>
        <select value={againFilter} onChange={(e) => setAgainFilter(e.target.value)} aria-label="Filter by Again" className={select}>
          <option value="all">Again: any</option>
          {AGAINS.map((a) => <option key={a} value={a}>Again: {AGAIN_LABELS[a]}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort" className={select}>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
        </select>
      </div>

      {/* Toolbar */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {!selecting ? (
          <button onClick={() => setSelecting(true)} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">
            Select
          </button>
        ) : (
          <>
            <button onClick={selectAllVisible} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">
              Select all shown ({visible.length})
            </button>
            <button onClick={exitSelection} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">
              Cancel
            </button>
          </>
        )}
        <span className="mx-1 text-[#26324c]">|</span>
        <button onClick={() => exportCsv(entries)} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">CSV</button>
        <button onClick={() => exportJson(entries)} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">JSON</button>
        <button onClick={() => exportMarkdown(entries)} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">Markdown</button>
        <button onClick={doShare} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">{shareMsg || "Share"}</button>
        <a href={emailSummaryUrl(entries)} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">Email a summary</a>
      </div>
      <p className="mt-2 text-xs text-[#64748b]">Saved on this device. Export a backup anytime.</p>

      {/* Bulk action bar */}
      {selecting && selected.size > 0 && (
        <div className="sticky top-14 z-30 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#22D3EE] bg-[#0e1626] p-3 text-xs">
          <span className="font-bold text-[#e8edf5]">{selected.size} selected</span>
          <button onClick={() => bulkMark("watched")} className="rounded-full bg-[#22D3EE] px-3 py-1.5 font-bold text-[#06131a]">Mark Watched</button>
          <button onClick={() => bulkMark("want_to_watch")} className="rounded-full border border-[#60A5FA] px-3 py-1.5 font-semibold text-[#60A5FA]">Want to Watch</button>
          <button onClick={() => bulkMark("prob_not")} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8]">Prob Not</button>
          {AGAINS.map((a) => (
            <button key={a} onClick={() => bulkAgain(a)} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">
              Again: {AGAIN_LABELS[a]}
            </button>
          ))}
          <button onClick={() => exportCsv(selectedEntries)} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">Export</button>
          {!confirmRemove ? (
            <button onClick={() => setConfirmRemove(true)} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#94a3b8] hover:text-[#e8edf5]">Remove…</button>
          ) : (
            <button onClick={bulkRemove} className="rounded-full border border-[#e8edf5] bg-[#e8edf5] px-3 py-1.5 font-bold text-[#06131a]">
              Remove {selected.size} — confirm
            </button>
          )}
        </div>
      )}

      {/* Rows */}
      {visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center text-sm text-[#94a3b8]">
          Nothing matches these filters.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {visible.map((e) => (
            <li key={e.id} className={`flex gap-3 rounded-xl border bg-[#141d2e] p-3 ${selecting && selected.has(e.id) ? "border-[#22D3EE]" : "border-[#26324c]"}`}>
              {selecting && (
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggleSelected(e.id)}
                  aria-label={`Select ${e.title}`}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#22D3EE]"
                />
              )}
              <Link href={`/title/${e.source}/${e.sourceId}?mediaType=${e.mediaType}`} className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-[#0b1220]">
                {e.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : <div className="flex h-full w-full items-center justify-center text-2xl">🎬</div>}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/title/${e.source}/${e.sourceId}?mediaType=${e.mediaType}`} className="truncate text-sm font-bold text-[#e8edf5] hover:underline">
                  {e.title}
                </Link>
                <p className="text-xs text-[#94a3b8]">
                  {e.mediaType === "series" ? "TV" : "Movie"}{e.releaseYear ? ` · ${e.releaseYear}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${e.status === "watched" ? "border-[#22D3EE] text-[#22D3EE]" : e.status === "want_to_watch" ? "border-[#60A5FA] text-[#60A5FA]" : "border-[#64748B] text-[#94a3b8]"}`}>
                    {STATUS_LABELS[e.status]}
                  </span>
                  {selecting && e.myTake && <span className="rounded-full border border-[#26324c] px-2 py-0.5 text-[10px] font-bold text-[#94a3b8]">{MY_TAKE_LABELS[e.myTake]}</span>}
                  {selecting && e.again && <span className="rounded-full border border-[#26324c] px-2 py-0.5 text-[10px] font-bold text-[#94a3b8]">Again: {AGAIN_LABELS[e.again]}</span>}
                </div>
                {!selecting && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    {e.status !== "watched" ? (
                      <button onClick={() => mark(e, "watched")} className="rounded-full bg-[#22D3EE] px-3 py-1.5 text-xs font-bold text-[#06131a]">
                        Mark Watched
                      </button>
                    ) : (
                      <button onClick={() => mark(e, "want_to_watch")} className="rounded-full border border-[#60A5FA]/60 px-3 py-1.5 text-xs font-semibold text-[#60A5FA]">
                        Move to Want to Watch
                      </button>
                    )}
                    {e.status === "watched" && (
                      <>
                        <select
                          value={e.myTake ?? ""}
                          onChange={(ev) => take(e.id, (ev.target.value || undefined) as MyTake | undefined)}
                          aria-label={`My Take for ${e.title}`}
                          className={`rounded-full border bg-[#141d2e] px-2 py-1 text-xs ${e.myTake ? "border-[#22D3EE]/60 text-[#e8edf5]" : "border-[#26324c] text-[#94a3b8]"}`}
                        >
                          <option value="">My Take…</option>
                          {TAKES.map((t) => <option key={t} value={t}>{MY_TAKE_LABELS[t]}</option>)}
                        </select>
                        <select
                          value={e.again ?? ""}
                          onChange={(ev) => again(e.id, (ev.target.value || undefined) as Again | undefined)}
                          aria-label={`Watch again for ${e.title}`}
                          className={`rounded-full border bg-[#141d2e] px-2 py-1 text-xs ${e.again ? "border-[#22D3EE]/60 text-[#e8edf5]" : "border-[#26324c] text-[#94a3b8]"}`}
                        >
                          <option value="">Watch again?</option>
                          {AGAINS.map((a) => <option key={a} value={a}>Again: {AGAIN_LABELS[a]}</option>)}
                        </select>
                      </>
                    )}
                    <button onClick={() => removeOne(e)} className="rounded-full border border-[#26324c] px-3 py-1.5 text-xs font-semibold text-[#94a3b8] hover:text-[#e8edf5]">
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {undoSnackbar}
    </>
  );
}
