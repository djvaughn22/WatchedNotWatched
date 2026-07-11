"use client";

// Top 222 board, split screen: everything you still have to watch on the
// left, everything you've watched on the right — sorted into 👍 Liked and
// 👎 Not liked. Thumb a poster, or drag it into a zone on desktop. All time
// by default, or narrow to a decade and/or genre. Ranked by TMDB user
// ratings. No horror, no adult content.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SearchResultItem } from "@/lib/media/types";
import { DECADES, MOVIE_GENRES, TV_GENRES, isValidDecade, type DecadeId } from "@/lib/media/genres";
import { useLibrary } from "@/lib/useLocal";
import { toTitleRef } from "@/app/components/TitleCard";
import type { MyTake } from "@/lib/library";

type MediaKind = "movie" | "series";
type Zone = "liked" | "not_liked";

const LIKED = "#22D3EE"; // thumbs up — brand cyan
const NOT_LIKED = "#64748B"; // thumbs down — slate (no red, house rule)

export default function TopClient() {
  const [kind, setKind] = useState<MediaKind>("movie");
  const [decade, setDecade] = useState<DecadeId | null>(null); // null = all time
  const [genreId, setGenreId] = useState<number | null>(null);
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "unsupported" | "done">("loading");
  const [dragOver, setDragOver] = useState<Zone | null>(null);
  const [urlApplied, setUrlApplied] = useState(false);
  const { entryFor, mark, take, remove, hydrated } = useLibrary();

  const genres = kind === "series" ? TV_GENRES : MOVIE_GENRES;

  // Deep links (?decade=1990&genre=35&type=series) — read once on mount.
  // Parsed from window.location instead of useSearchParams so this page
  // needs no Suspense boundary (Next 16 gotcha).
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

  // Left = still to watch (including "prob not", dimmed). Right = watched,
  // split by your thumbs. "fine"/unrated watched titles wait in "No call yet".
  const toWatch = ranked.filter(({ it }) => entryFor(it.id)?.status !== "watched");
  const watched = ranked.filter(({ it }) => entryFor(it.id)?.status === "watched");
  const likedRows = watched.filter(({ it }) => {
    const t = entryFor(it.id)?.myTake;
    return t === "loved" || t === "liked";
  });
  const notLikedRows = watched.filter(({ it }) => entryFor(it.id)?.myTake === "not_for_me");
  const unratedRows = watched.filter(({ it }) => {
    const t = entryFor(it.id)?.myTake;
    return !t || t === "fine";
  });
  const seenPct = items.length > 0 ? Math.round((watched.length / items.length) * 100) : 0;

  const thumb = (item: SearchResultItem, myTake: MyTake) => {
    mark(toTitleRef(item), "watched");
    take(item.id, myTake);
  };
  const probNot = (item: SearchResultItem) => {
    const current = entryFor(item.id)?.status;
    if (current === "prob_not") remove(item.id);
    else mark(toTitleRef(item), "prob_not");
  };

  const onDrop = (zone: Zone) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const item = JSON.parse(e.dataTransfer.getData("application/json")) as SearchResultItem;
      thumb(item, zone === "liked" ? "liked" : "not_for_me");
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

      {(status === "error" || (status === "done" && items.length === 0)) && (
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
                Seen {watched.length} of {items.length}
                <span className="ml-1 text-xs font-semibold text-[#94a3b8]">({seenPct}%)</span>
              </p>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#26324c]" role="img"
              aria-label={`Watched ${watched.length}, to watch ${toWatch.length}`}>
              <div style={{ width: `${(watched.length / items.length) * 100}%`, backgroundColor: LIKED }} />
            </div>
            <p className="mt-1.5 text-[11px] text-[#64748b]">
              <span className="font-bold" style={{ color: LIKED }}>👍 {likedRows.length}</span>
              {" · "}
              <span className="font-bold" style={{ color: NOT_LIKED }}>👎 {notLikedRows.length}</span>
              {unratedRows.length > 0 ? ` · ${unratedRows.length} watched, no call yet` : ""}
              {` · ${toWatch.length} to watch`}
            </p>
          </div>

          {/* Split board: to watch | watched */}
          <div className="mt-4 grid items-start gap-3 md:grid-cols-[1fr_320px]">
            {/* LEFT: still to watch */}
            <div>
              <p className="pb-2 text-xs font-black uppercase tracking-wide text-[#94a3b8]">
                To watch ({toWatch.length})
              </p>
              {toWatch.length === 0 ? (
                <div className="rounded-xl border border-[#26324c] bg-[#141d2e] p-6 text-center">
                  <p className="text-sm font-bold text-[#e8edf5]">You’ve seen all {items.length}.</p>
                  <p className="mt-1 text-xs text-[#94a3b8]">
                    Pick another decade or genre above, or see{" "}
                    <Link href="/foryou" className="text-[#22D3EE] hover:underline">picks based on your 👍s</Link>.
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {toWatch.map(({ it, rank }) => {
                    const isProbNot = entryFor(it.id)?.status === "prob_not";
                    return (
                      <li key={it.id}>
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/json", JSON.stringify(it));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className={`flex cursor-grab flex-col overflow-hidden rounded-xl border border-[#26324c] bg-[#141d2e] active:cursor-grabbing ${isProbNot ? "opacity-55" : ""}`}
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
                                onClick={() => thumb(it, "liked")}
                                aria-label={`Watched and liked ${it.title}`}
                                className="rounded-lg border border-[#22D3EE]/50 px-1.5 py-1.5 text-sm hover:bg-[#22D3EE]/10"
                              >
                                👍
                              </button>
                              <button
                                onClick={() => thumb(it, "not_for_me")}
                                aria-label={`Watched, not for me: ${it.title}`}
                                className="rounded-lg border border-[#64748B]/60 px-1.5 py-1.5 text-sm hover:bg-[#64748B]/10"
                              >
                                👎
                              </button>
                            </div>
                            <button
                              onClick={() => probNot(it)}
                              aria-pressed={isProbNot}
                              className="text-[10px] font-semibold text-[#64748b] hover:text-[#e8edf5]"
                            >
                              {isProbNot ? "Prob not ✓ (tap to undo)" : "Prob not watching"}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* RIGHT: watched, thumbed */}
            <div className="space-y-3 md:sticky md:top-40 md:max-h-[calc(100vh-11rem)] md:overflow-y-auto">
              <DropColumn
                label="👍 Liked"
                color={LIKED}
                rows={likedRows}
                highlight={dragOver === "liked"}
                onDragOver={(e) => { e.preventDefault(); setDragOver("liked"); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={onDrop("liked")}
                flip={(id) => take(id, "not_for_me")}
                flipLabel="👎"
                unsort={(id) => remove(id)}
              />
              <DropColumn
                label="👎 Not liked"
                color={NOT_LIKED}
                rows={notLikedRows}
                highlight={dragOver === "not_liked"}
                onDragOver={(e) => { e.preventDefault(); setDragOver("not_liked"); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={onDrop("not_liked")}
                flip={(id) => take(id, "liked")}
                flipLabel="👍"
                unsort={(id) => remove(id)}
              />
              {unratedRows.length > 0 && (
                <section aria-label="Watched, no call yet" className="rounded-xl border border-[#26324c] p-2">
                  <p className="px-1 pb-2 text-xs font-black uppercase tracking-wide text-[#94a3b8]">
                    Watched — no call yet ({unratedRows.length})
                  </p>
                  <ul className="space-y-1.5">
                    {unratedRows.map(({ it, rank }) => (
                      <WatchedRow key={it.id} it={it} rank={rank} unsort={() => remove(it.id)}>
                        <span className="flex gap-1">
                          <button onClick={() => take(it.id, "liked")} aria-label={`Liked ${it.title}`} className="rounded-full border border-[#22D3EE]/50 px-1.5 text-xs hover:bg-[#22D3EE]/10">👍</button>
                          <button onClick={() => take(it.id, "not_for_me")} aria-label={`Not for me: ${it.title}`} className="rounded-full border border-[#64748B]/60 px-1.5 text-xs hover:bg-[#64748B]/10">👎</button>
                        </span>
                      </WatchedRow>
                    ))}
                  </ul>
                </section>
              )}
              <p className="px-1 text-[11px] leading-relaxed text-[#64748b]">
                Thumbs feed your <Link href="/foryou" className="text-[#22D3EE] hover:underline">For You picks</Link>.
                👍 = Liked it, 👎 = Not for me in your <Link href="/library" className="text-[#22D3EE] hover:underline">library</Link>.
              </p>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-[#64748b]">
            Ranked by TMDB user ratings. Tap 👍 or 👎, or drag a poster into a column.
          </p>
        </>
      )}
    </>
  );
}

function DropColumn({
  label,
  color,
  rows,
  highlight,
  onDragOver,
  onDragLeave,
  onDrop,
  flip,
  flipLabel,
  unsort,
}: {
  label: string;
  color: string;
  rows: Array<{ it: SearchResultItem; rank: number }>;
  highlight: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  flip: (id: string) => void;
  flipLabel: string;
  unsort: (id: string) => void;
}) {
  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={`${label} column`}
      className={`min-h-32 rounded-xl border-2 border-dashed p-2 transition-colors ${highlight ? "bg-[#141d2e]" : "bg-transparent"}`}
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
            <WatchedRow key={it.id} it={it} rank={rank} unsort={() => unsort(it.id)}>
              <button
                onClick={() => flip(it.id)}
                aria-label={`Change to ${flipLabel} for ${it.title}`}
                className="rounded-full border border-[#26324c] px-1.5 text-xs hover:bg-[#26324c]/50"
              >
                {flipLabel}
              </button>
            </WatchedRow>
          ))}
        </ul>
      )}
    </section>
  );
}

function WatchedRow({ it, rank, unsort, children }: {
  it: SearchResultItem;
  rank: number;
  unsort: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg bg-[#141d2e] p-1.5">
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
        {children}
      </div>
      <button
        onClick={unsort}
        aria-label={`Unsort ${it.title}`}
        className="shrink-0 rounded-full px-1.5 text-sm text-[#64748b] hover:text-[#e8edf5]"
      >
        ✕
      </button>
    </li>
  );
}
