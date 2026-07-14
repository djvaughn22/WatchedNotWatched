"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SearchExperience from "./SearchExperience";
import { useLibrary } from "@/lib/useLocal";
import { inView, VIEW_LABELS, type LibraryView } from "@/lib/library";
import { DECADES } from "@/lib/media/genres";
import type { SearchResultItem } from "@/lib/media/types";

const SNAPSHOT_VIEWS: LibraryView[] = ["want_to_watch", "watched", "watch_again", "favorites"];

export function Homepage() {
  const { entries, hydrated } = useLibrary();

  return (
    <main className="min-h-screen bg-[#0b1220] text-[#e8edf5]">
      <section className="px-4 pt-12 pb-8 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Remember what you watched.
            <br />
            Find what comes next.
          </h1>
          <div className="mx-auto mt-7 max-w-3xl text-left">
            <SearchExperience autoFocus />
          </div>
        </div>
      </section>

      <section className="border-t border-[#26324c] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#94a3b8]">
            How many have you seen?
          </h2>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Link
              href="/top"
              className="rounded-full border border-[#22D3EE] px-2 py-0.5 text-[10px] font-bold text-[#22D3EE] transition-colors hover:bg-[#22D3EE]/10"
            >
              Top 222 of all time
            </Link>
            <Link
              href="/top?type=series"
              className="rounded-full border border-[#26324c] px-2 py-0.5 text-[10px] font-bold text-[#e8edf5] transition-colors hover:border-[#22D3EE] hover:text-[#22D3EE]"
            >
              Top 222 TV shows
            </Link>
            {DECADES.map((d) => (
              <Link
                key={d.id}
                href={`/top?decade=${d.id}`}
                className="rounded-full border border-[#26324c] px-2 py-0.5 text-[10px] font-bold text-[#e8edf5] transition-colors hover:border-[#22D3EE] hover:text-[#22D3EE]"
              >
                Top 222 of the {d.label}
              </Link>
            ))}
            <Link
              href="/top"
              className="rounded-full border border-[#26324c] px-2 py-0.5 text-[10px] font-bold text-[#e8edf5] transition-colors hover:border-[#22D3EE] hover:text-[#22D3EE]"
            >
              By genre →
            </Link>
          </div>
        </div>
      </section>

      {hydrated && entries.length > 0 && (
        <section className="border-t border-[#26324c] px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#94a3b8]">Your library</h2>
              <Link href="/library" className="text-sm font-semibold text-[#22D3EE] hover:underline">
                Open library →
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SNAPSHOT_VIEWS.map((v) => {
                const count = entries.filter((e) => inView(e, v)).length;
                return (
                  <Link
                    key={v}
                    href={`/library?view=${v}`}
                    className="rounded-full border border-[#26324c] bg-[#141d2e] px-2 py-0.5 text-[10px] font-semibold text-[#94a3b8] transition-colors hover:border-[#22D3EE] hover:text-[#e8edf5]"
                  >
                    <span className="font-black text-[#e8edf5]">{count}</span> {VIEW_LABELS[v]}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {hydrated && entries.length === 0 && (
        <section className="border-t border-[#26324c] px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm text-[#94a3b8]">
              Search a title, tap <strong className="text-[#e8edf5]">Watched</strong> or{" "}
              <strong className="text-[#e8edf5]">Want to Watch</strong>, and keep going. Your library builds itself.
            </p>
          </div>
        </section>
      )}

      <Top22Today />

      <section className="border-t border-[#26324c] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs leading-relaxed text-[#64748b]">
            Saved on this device. Export a backup anytime. No account needed.
          </p>
        </div>
      </section>
    </main>
  );
}

// Today's Top 22 movies and TV shows, straight from /api/top (same board as
// /top, all time). Poster strips scroll sideways; each poster opens its title
// page. Hidden entirely if the lists don't load — the homepage stays clean.
function Top22Today() {
  const [movies, setMovies] = useState<SearchResultItem[]>([]);
  const [shows, setShows] = useState<SearchResultItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const load = (type: "movie" | "series", set: (items: SearchResultItem[]) => void) =>
      fetch(`/api/top?type=${type}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: { items?: SearchResultItem[] }) => set(data.items ?? []))
        .catch(() => {});
    load("movie", setMovies);
    load("series", setShows);
    return () => controller.abort();
  }, []);

  if (movies.length === 0 && shows.length === 0) return null;

  return (
    <section className="border-t border-[#26324c] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-sm font-black uppercase tracking-widest text-[#94a3b8]">
          Top 22 today
        </h2>
        {movies.length > 0 && <PosterStrip label="Movies" href="/top" items={movies} />}
        {shows.length > 0 && <PosterStrip label="TV shows" href="/top?type=series" items={shows} />}
      </div>
    </section>
  );
}

function PosterStrip({ label, href, items }: { label: string; href: string; items: SearchResultItem[] }) {
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-black uppercase tracking-wide text-[#e8edf5]">{label}</h3>
        <Link href={href} className="text-xs font-semibold text-[#22D3EE] hover:underline">
          Open the board →
        </Link>
      </div>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {items.map((it, i) => (
          <li key={it.id} className="w-24 shrink-0">
            <Link
              href={`/title/${it.source}/${it.sourceId}?mediaType=${it.mediaType}`}
              className="relative block aspect-[2/3] overflow-hidden rounded-lg border border-[#26324c] bg-[#141d2e]"
            >
              {it.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.posterUrl} alt={`${it.title} poster`} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] font-semibold text-[#94a3b8]">
                  {it.title}
                </span>
              )}
              <span className="absolute left-1 top-1 rounded bg-[#0b1220]/90 px-1 py-0.5 text-[10px] font-black text-[#e8edf5]">
                #{i + 1}
              </span>
            </Link>
            <p className="mt-1 line-clamp-1 text-[10px] font-semibold text-[#94a3b8]">{it.title}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
