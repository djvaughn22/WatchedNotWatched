"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SearchExperience from "./SearchExperience";
import TitleCard from "./TitleCard";
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
  const lib = useLibrary();
  const { entries, hydrated } = lib;

  return (
    <main className="min-h-screen bg-[#0b1220] text-[#e8edf5]">
      {/* One contained column: dividers live inside it, not across the full
          screen, so the page reads as a single card instead of dark bands. */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <section className="pb-8 pt-10 text-center">
          {/* The brand, as the two answers the whole site runs on. */}
          <div className="flex items-center justify-center gap-2">
            <span className="rounded-full border border-[#22D3EE] bg-[#22D3EE]/10 px-3 py-1 text-xs font-black text-[#22D3EE]">
              Watched ✓
            </span>
            <span className="rounded-full border border-[#26324c] px-3 py-1 text-xs font-black text-[#94a3b8]">
              Not watched
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            What to watch next,
            <br />
            based on what you like.
          </h1>
          <p className="mt-3 text-sm text-[#94a3b8]">
            Rate what you&apos;ve seen. The picks below change with every rating.
          </p>
          <div className="mt-6 text-left">
            <SearchExperience autoFocus />
          </div>
        </section>

        <HomePicks lib={lib} />

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

// ---- The picks deck --------------------------------------------------------
// The homepage engine: a hand of titles you haven't decided on yet. With no
// ratings it deals from the Top 222 boards; once you thumb titles up it deals
// from /api/recommend seeded by your 👍s (same engine as For You). Any rating
// — Loved / Liked / Fine / Not for me — or a Prob Not re-deals the hand, so
// the picks visibly react to every opinion. Shuffle re-deals on demand.

type Pick = SearchResultItem & { because?: string };

const HAND_SIZE = 8;
const MAX_SEEDS = 8;

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Alternate movies and shows so a mixed hand never leans all one way. */
function interleave(a: Pick[], b: Pick[]): Pick[] {
  const out: Pick[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}

function HomePicks({ lib }: { lib: ReturnType<typeof useLibrary> }) {
  const { entries, hydrated, entryFor, mark, take, again, remove } = lib;
  const [pool, setPool] = useState<Pick[]>([]);
  const [personal, setPersonal] = useState(false);
  const [hand, setHand] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);

  // Same seed rule as For You: loved (3) beats liked (2), newest first.
  const seeds = useMemo(() => {
    const liked = entries.filter((e) => e.myTake === "loved" || e.myTake === "liked");
    liked.sort((a, b) => (a.myTake === b.myTake ? 0 : a.myTake === "loved" ? -1 : 1));
    return liked
      .slice(0, MAX_SEEDS)
      .map((e) => ({ sourceId: e.sourceId, mediaType: e.mediaType, weight: e.myTake === "loved" ? 3 : 2, title: e.title }));
  }, [entries]);

  // Every opinion re-deals: any My Take change or a Prob Not, but not a plain
  // Watched / Want to Watch tap — those keep the card in place so you can
  // finish rating it.
  const opinionKey = useMemo(
    () =>
      entries
        .filter((e) => e.myTake || e.status === "prob_not")
        .map((e) => `${e.id}:${e.myTake ?? "prob_not"}`)
        .sort()
        .join("|"),
    [entries],
  );

  // Anything already in the library never gets dealt again.
  const deal = (from: Pick[]) => {
    const inLibrary = new Set(entries.map((e) => e.id));
    setHand(shuffled(from.filter((p) => !inLibrary.has(p.id))).slice(0, HAND_SIZE));
  };

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    // `loading` gates only the first skeleton; re-deals keep the old hand up
    // until the new one lands, so it never flips back to true.
    const finish = (items: Pick[], isPersonal: boolean) => {
      setPool(items);
      setPersonal(isPersonal);
      deal(items);
      setLoading(false);
    };

    const loadTop = () => {
      const one = (type: "movie" | "series") =>
        fetch(`/api/top?type=${type}`, { signal: controller.signal })
          .then((r) => r.json())
          .then((data: { items?: Pick[] }) => data.items ?? []);
      Promise.all([one("movie"), one("series")])
        .then(([movies, shows]) => finish(interleave(movies, shows), false))
        .catch(() => setLoading(false));
    };

    if (seeds.length === 0) {
      loadTop();
    } else {
      fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seeds: seeds.map(({ sourceId, mediaType, weight }) => ({ sourceId, mediaType, weight })),
          seedTitles: Object.fromEntries(seeds.map((s) => [s.sourceId, s.title])),
        }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data: { items?: Pick[] }) => {
          if (data.items && data.items.length > 0) finish(data.items, true);
          else loadTop();
        })
        .catch((e) => {
          if (e?.name !== "AbortError") loadTop();
        });
    }
    return () => controller.abort();
    // Re-deal only when an opinion changes, not on every library tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, opinionKey]);

  if (!hydrated) return null;
  if (!loading && pool.length === 0) return null; // keyless prod: stay clean

  return (
    <section className="border-t border-[#26324c] py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">
          {personal ? "Your picks" : "Picks to start with"}
        </h2>
        <div className="flex items-center gap-2">
          {personal && (
            <Link href="/foryou" className="shrink-0 text-xs font-semibold text-[#22D3EE] hover:underline">
              More →
            </Link>
          )}
          <button onClick={() => deal(pool)} className={CHIP_ACCENT}>
            Shuffle ↻
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-[#64748b]">
        {personal
          ? "Built from your 👍s. Rate anything and the deck changes."
          : "From the Top 222 boards. Rate a few and your picks go personal."}
      </p>

      {loading && hand.length === 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: HAND_SIZE }, (_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl border border-[#26324c] bg-[#141d2e]" />
          ))}
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {hand.map((p) => (
            <li key={p.id} className="flex flex-col gap-1">
              <TitleCard
                item={p}
                entry={entryFor(p.id)}
                onMark={mark}
                onClear={remove}
                onTake={take}
                onAgain={again}
              />
              {p.because && <p className="px-1 text-[10px] text-[#64748b]">Because you liked {p.because}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
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
