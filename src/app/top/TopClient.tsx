"use client";

// Top 222 board: all time by default, or narrow to a decade and/or genre —
// then sort the posters into Watched vs Not Watched and watch your score
// climb. Drag cards on desktop, tap on phones. Ranked by TMDB user ratings.
// No horror, no adult content.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SearchResultItem } from "@/lib/media/types";
import { DECADES, MOVIE_GENRES, TV_GENRES, isValidDecade, type DecadeId } from "@/lib/media/genres";
import { useLibrary } from "@/lib/useLocal";
import { toTitleRef } from "@/app/components/TitleCard";
import { STATUS_COLORS } from "@/app/components/TriageButtons";
import type { LibraryStatus } from "@/lib/library";

type MediaKind = "movie" | "series";

export default function TopClient() {
  const [kind, setKind] = useState<MediaKind>("movie");
  const [decade, setDecade] = useState<DecadeId | null>(null); // null = all time
  const [genreId, setGenreId] = useState<number | null>(null);
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "unsupported" | "done">("loading");
  const [dragOver, setDragOver] = useState<"watched" | "not" | null>(null);
  const [urlApplied, setUrlApplied] = useState(false);
  const { entryFor, mark, remove, hydrated } = useLibrary();

  const genres = kind === "series" ? TV_GENRES : MOVIE_GENRES;

  // Deep links (?decade=1990&genre=35&type=series) — read once on mount.
  // Parsed from window.location instead of useSearchParams so this page
  // needs no Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("decade") ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isValidDecade(d)) setDecade(d);
    if (params.get("type") === "series") setKind("series");
    const g = Number(params.get("genre"));
    if (g) setGenreId(g);
    setUrlApplied(true);
  }, []);

  // Keep the pick shareable.
  useEffect(() => {
    if (!urlApplied) return;
    const q = new URLSearchParams();
    if (decade) q.set("decade", decade);
    if (genreId) q.set("genre", String(genreId));
    if (kind === "series") q.set("type", "series");
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [decade, genreId, kind, urlApplied]);

  useEffect(() => {
    if (!urlApplied) return;
    const controller = new AbortController();
    setStatus("loading");
    const q = new URLSearchParams({ type: kind });
    if (decade) q.set("decade", decade);
    if (genreId) q.set("genre", String(genreId));
    fetch(`/api/top?${q.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { items?: SearchResultItem[]; supported?: boolean }) => {
        if (data.supported === false) {
          setStatus("unsupported");
          return;
        }
        setItems(data.items ?? []);
        setStatus("done");
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [kind, decade, genreId, urlApplied]);

  const ranked = useMemo(() => items.map((it, i) => ({ it, rank: i + 1 })), [items]);
  const toSort = ranked.filter(({ it }) => !entryFor(it.id));
  const watchedCol = ranked.filter(({ it }) => entryFor(it.id)?.status === "watched");
  const notCol = ranked.filter(({ it }) => {
    const s = entryFor(it.id)?.status;
    return s === "want_to_watch" || s === "prob_not";
  });
  const sortedCount = watchedCol.length + notCol.length;
  const seenPct = items.length > 0 ? Math.round((watchedCol.length / items.length) * 100) : 0;

  const sortTo = (item: SearchResultItem, statusValue: LibraryStatus) => mark(toTitleRef(item), statusValue);

  const onDrop = (zone: "watched" | "not") => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const item = JSON.parse(e.dataTransfer.getData("application/json")) as SearchResultItem;
      sortTo(item, zone === "watched" ? "watched" : "want_to_watch");
    } catch {
      /* ignore foreign drags */
    }
  };

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      on ? "bg-[#22D3EE] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"
    }`;

  const listLabel = `${genreId ? genres.find((g) => g.id === genreId)?.label + " " : ""}${kind === "movie" ? "movies" : "shows"} ${decade ? `of the ${DECADES.find((d) => d.id === decade)?.label}` : "of all time"}`;

  return (
    <>
      {/* Filters */}
      <div className="flex gap-2" role="group" aria-label="Movies or TV">
        {(["movie", "series"] as const).map((k) => (
          <button key={k} onClick={() => { setKind(k); setGenreId(null); }} aria-pressed={kind === k} className={chip(kind === k)}>
            {k === "movie" ? "Movies" : "TV"}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Decade">
        <button onClick={() => setDecade(null)} aria-pressed={decade === null} className={chip(decade === null)}>
          All time
        </button>
        {DECADES.map((d) => (
          <button key={d.id} onClick={() => setDecade(decade === d.id ? null : d.id)} aria-pressed={decade === d.id} className={chip(decade === d.id)}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Genre">
        {genres.map((g) => (
          <button key={g.id} onClick={() => setGenreId(genreId === g.id ? null : g.id)} aria-pressed={genreId === g.id} className={chip(genreId === g.id)}>
            {g.label}
          </button>
        ))}
      </div>

      {status === "loading" && (
        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl border border-[#26324c] bg-[#141d2e]" />
          ))}
        </div>
      )}

      {status === "unsupported" && (
        <p className="mt-5 rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center text-sm text-[#94a3b8]">
          Top lists need the movie database connection, which isn’t configured yet.
        </p>
      )}

      {status === "error" && (
        <p className="mt-5 rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center text-sm text-[#94a3b8]">
          The list didn’t load. Try again in a moment.
        </p>
      )}

      {status === "done" && items.length === 0 && (
        <p className="mt-5 rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center text-sm text-[#94a3b8]">
          The list didn’t load. Try again in a moment.
        </p>
      )}

      {status === "done" && items.length > 0 && hydrated && (
        <>
          {/* Scoreboard */}
          <div className="sticky top-12 z-30 mt-5 rounded-xl border border-[#26324c] bg-[#0e1626]/95 p-3 backdrop-blur">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-black text-[#e8edf5]">
                Top {items.length} {listLabel}
              </p>
              <p className="text-sm font-black text-[#22D3EE]">
                Seen {watchedCol.length} of {items.length}
                <span className="ml-1 text-xs font-semibold text-[#94a3b8]">({seenPct}%)</span>
              </p>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#26324c]" role="img"
              aria-label={`Watched ${watchedCol.length}, not watched ${notCol.length}, unsorted ${toSort.length}`}>
              <div style={{ width: `${(watchedCol.length / items.length) * 100}%`, backgroundColor: STATUS_COLORS.watched }} />
              <div style={{ width: `${(notCol.length / items.length) * 100}%`, backgroundColor: STATUS_COLORS.want_to_watch }} />
            </div>
            <p className="mt-1.5 text-[11px] text-[#64748b]">
              <span className="font-bold text-[#22D3EE]">Watched {watchedCol.length}</span>
              {" · "}
              <span className="font-bold text-[#60A5FA]">Not watched {notCol.length}</span>
              {toSort.length > 0 ? ` · ${toSort.length} to sort` : sortedCount > 0 ? " · all sorted" : ""}
            </p>
          </div>

          {/* Board */}
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_290px]">
            {/* To sort */}
            <div>
              {toSort.length === 0 ? (
                <div className="rounded-xl border border-[#26324c] bg-[#141d2e] p-6 text-center">
                  <p className="text-sm font-bold text-[#e8edf5]">All {items.length} sorted.</p>
                  <p className="mt-1 text-xs text-[#94a3b8]">
                    You’ve seen {watchedCol.length} — pick another decade or genre above, or{" "}
                    <Link href="/library" className="text-[#22D3EE] hover:underline">open your library</Link>.
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {toSort.map(({ it, rank }) => (
                    <li key={it.id}>
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/json", JSON.stringify(it));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className="flex cursor-grab flex-col overflow-hidden rounded-xl border border-[#26324c] bg-[#141d2e] active:cursor-grabbing"
                      >
                        <Link href={`/title/${it.source}/${it.sourceId}?mediaType=${it.mediaType}`} className="relative block aspect-[2/3] bg-[#0b1220]">
                          {it.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.posterUrl} alt={`${it.title} poster`} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
                              <span className="text-3xl" aria-hidden>🎬</span>
                              <span className="text-xs font-semibold text-[#94a3b8]">{it.title}</span>
                            </div>
                          )}
                          <span className="absolute right-2 top-2 rounded-lg bg-[#0b1220]/90 px-2 py-0.5 text-xs font-black text-[#e8edf5]">#{rank}</span>
                          {typeof it.voteAverage === "number" && (
                            <span className="absolute bottom-2 left-2 rounded-lg bg-[#0b1220]/90 px-1.5 py-0.5 text-[10px] font-black text-[#22D3EE]">
                              ★ {it.voteAverage.toFixed(1)}
                            </span>
                          )}
                        </Link>
                        <div className="flex flex-1 flex-col gap-1.5 p-2">
                          <p className="line-clamp-1 text-xs font-bold text-[#e8edf5]">{it.title}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => sortTo(it, "watched")}
                              className="rounded-lg border border-[#22D3EE]/50 px-1.5 py-1.5 text-[11px] font-bold text-[#22D3EE] hover:bg-[#22D3EE]/10"
                            >
                              ✓ Watched
                            </button>
                            <button
                              onClick={() => sortTo(it, "want_to_watch")}
                              className="rounded-lg border border-[#60A5FA]/50 px-1.5 py-1.5 text-[11px] font-bold text-[#60A5FA] hover:bg-[#60A5FA]/10"
                            >
                              Not yet
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Columns */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:content-start">
              <ColumnList
                label="Watched"
                color={STATUS_COLORS.watched}
                rows={watchedCol}
                highlight={dragOver === "watched"}
                onDragOver={(e) => { e.preventDefault(); setDragOver("watched"); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={onDrop("watched")}
                unsort={(id) => remove(id)}
              />
              <ColumnList
                label="Not Watched"
                color={STATUS_COLORS.want_to_watch}
                rows={notCol}
                highlight={dragOver === "not"}
                onDragOver={(e) => { e.preventDefault(); setDragOver("not"); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={onDrop("not")}
                unsort={(id) => remove(id)}
                subChips={(id) => {
                  const s = entryFor(id)?.status;
                  return (
                    <span className="flex gap-1">
                      <button
                        onClick={() => { const row = ranked.find((r) => r.it.id === id); if (row) sortTo(row.it, "want_to_watch"); }}
                        aria-pressed={s === "want_to_watch"}
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${s === "want_to_watch" ? "bg-[#60A5FA] text-[#06131a]" : "border border-[#26324c] text-[#64748b]"}`}
                      >
                        Want to
                      </button>
                      <button
                        onClick={() => { const row = ranked.find((r) => r.it.id === id); if (row) sortTo(row.it, "prob_not"); }}
                        aria-pressed={s === "prob_not"}
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${s === "prob_not" ? "bg-[#64748B] text-[#06131a]" : "border border-[#26324c] text-[#64748b]"}`}
                      >
                        Prob not
                      </button>
                    </span>
                  );
                }}
              />
            </div>
          </div>

          <p className="mt-4 text-[11px] text-[#64748b]">
            Ranked by TMDB user ratings. Drag a poster into a column, or tap the buttons.
          </p>
        </>
      )}
    </>
  );
}

function ColumnList({
  label,
  color,
  rows,
  highlight,
  onDragOver,
  onDragLeave,
  onDrop,
  unsort,
  subChips,
}: {
  label: string;
  color: string;
  rows: Array<{ it: SearchResultItem; rank: number }>;
  highlight: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  unsort: (id: string) => void;
  subChips?: (id: string) => React.ReactNode;
}) {
  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={`${label} column`}
      className={`min-h-40 rounded-xl border-2 border-dashed p-2 transition-colors ${highlight ? "bg-[#141d2e]" : "bg-transparent"}`}
      style={{ borderColor: highlight ? color : "#26324c" }}
    >
      <p className="px-1 pb-2 text-xs font-black uppercase tracking-wide" style={{ color }}>
        {label} ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="px-1 pb-2 text-[11px] text-[#64748b]">Drop posters here</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(({ it, rank }) => (
            <li key={it.id} className="flex items-center gap-2 rounded-lg bg-[#141d2e] p-1.5">
              <span className="w-7 shrink-0 text-center text-[10px] font-black text-[#64748b]">#{rank}</span>
              <div className="h-10 w-7 shrink-0 overflow-hidden rounded bg-[#0b1220]">
                {it.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/title/${it.source}/${it.sourceId}?mediaType=${it.mediaType}`} className="block truncate text-xs font-semibold text-[#e8edf5] hover:underline">
                  {it.title}
                </Link>
                {subChips?.(it.id)}
              </div>
              <button
                onClick={() => unsort(it.id)}
                aria-label={`Unsort ${it.title}`}
                className="shrink-0 rounded-full px-1.5 text-sm text-[#64748b] hover:text-[#e8edf5]"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
