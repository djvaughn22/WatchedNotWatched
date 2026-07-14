"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SearchExperience from "./SearchExperience";
import { useLibrary } from "@/lib/useLocal";
import { inView, VIEW_LABELS, type LibraryView } from "@/lib/library";
import { DECADES } from "@/lib/media/genres";
import type { SearchResultItem } from "@/lib/media/types";

const SNAPSHOT_VIEWS: LibraryView[] = ["want_to_watch", "watched", "watch_again", "favorites"];

// One shared chip size so every small control on the page matches.
const CHIP = "rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors";
const CHIP_ACCENT = `${CHIP} border-[#22D3EE] text-[#22D3EE] hover:bg-[#22D3EE]/10`;
const CHIP_PLAIN = `${CHIP} border-[#26324c] text-[#cbd5e1] hover:border-[#22D3EE] hover:text-[#22D3EE]`;

function SectionHeader({ title, link, linkLabel }: { title: string; link?: string; linkLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">{title}</h2>
      {link && linkLabel && (
        <Link href={link} className="shrink-0 text-xs font-semibold text-[#22D3EE] hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export function Homepage() {
  const { entries, hydrated } = useLibrary();

  return (
    <main className="min-h-screen bg-[#0b1220] text-[#e8edf5]">
      {/* One contained column: dividers live inside it, not across the full
          screen, so the page reads as a single card instead of dark bands. */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <section className="pb-8 pt-10 text-center">
          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Remember what you watched.
            <br />
            Find what comes next.
          </h1>
          <div className="mt-6 text-left">
            <SearchExperience autoFocus />
          </div>
        </section>

        <section className="border-t border-[#26324c] py-6">
          <SectionHeader title="How many have you seen?" link="/top" linkLabel="Open the board →" />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Link href="/top" className={CHIP_ACCENT}>
              Top 222 of all time
            </Link>
            <Link href="/top?type=series" className={CHIP_PLAIN}>
              Top 222 TV shows
            </Link>
            {DECADES.map((d) => (
              <Link key={d.id} href={`/top?decade=${d.id}`} className={CHIP_PLAIN}>
                {d.label}
              </Link>
            ))}
            <Link href="/top" className={CHIP_PLAIN}>
              By genre →
            </Link>
          </div>
        </section>

        {hydrated && (
          <section className="border-t border-[#26324c] py-6">
            <SectionHeader title="Your library" link="/library" linkLabel="Open library →" />
            {entries.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {SNAPSHOT_VIEWS.map((v) => {
                  const count = entries.filter((e) => inView(e, v)).length;
                  return (
                    <Link key={v} href={`/library?view=${v}`} className={CHIP_PLAIN}>
                      <span className="font-black text-[#e8edf5]">{count}</span> {VIEW_LABELS[v]}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2.5 text-sm text-[#94a3b8]">
                Search a title, tap <strong className="text-[#e8edf5]">Watched</strong> or{" "}
                <strong className="text-[#e8edf5]">Want to Watch</strong>, and keep going. Your library builds itself.
              </p>
            )}
          </section>
        )}

        <Top22Today />

        <p className="border-t border-[#26324c] py-6 text-center text-xs leading-relaxed text-[#64748b]">
          Saved on this device. Export a backup anytime. No account needed.
        </p>
      </div>
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
    <section className="border-t border-[#26324c] py-6">
      {movies.length > 0 && (
        <PosterStrip label="Top 22 movies today" href="/top" items={movies} />
      )}
      {shows.length > 0 && (
        <div className={movies.length > 0 ? "mt-6" : undefined}>
          <PosterStrip label="Top 22 TV shows today" href="/top?type=series" items={shows} />
        </div>
      )}
    </section>
  );
}

function PosterStrip({ label, href, items }: { label: string; href: string; items: SearchResultItem[] }) {
  return (
    <div>
      <SectionHeader title={label} link={href} linkLabel="Open the board →" />
      <ul className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {items.map((it, i) => (
          <li key={it.id} className="w-24 shrink-0 sm:w-28">
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
