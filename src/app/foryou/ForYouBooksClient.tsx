"use client";

// ReadNotRead's For You: a simpler, deterministic companion to the movie
// engine's AI-gated pipeline (ForYouClient.tsx, untouched). Open Library has
// no recommendation graph or AI layer here — seeds come from books rated
// loved/liked, related books come from the same author/subjects via
// /api/recommend, and cold start is Open Library's trending list. Same shape
// as the homepage's book picks deck (Shuffle re-deals, More re-generates),
// kept separate so each page can evolve on its own.

import { useEffect, useMemo, useState } from "react";
import { useLibrary } from "@/lib/useLocal";
import { isBook } from "@/lib/library";
import type { SearchResultItem } from "@/lib/media/types";
import TitleCard from "@/app/components/TitleCard";

type Pick = SearchResultItem & { because?: string };

const DECK_SIZE = 8;
const MAX_SEEDS = 8;

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ForYouBooksClient() {
  const { entries, hydrated, entryFor, mark, take, again, remove } = useLibrary();
  const [pool, setPool] = useState<Pick[]>([]);
  const [personal, setPersonal] = useState(false);
  const [deck, setDeck] = useState<Pick[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const bookEntries = useMemo(() => entries.filter((e) => isBook(e.mediaType)), [entries]);

  const seeds = useMemo(() => {
    const liked = bookEntries.filter((e) => e.myTake === "loved" || e.myTake === "liked");
    liked.sort((a, b) => (a.myTake === b.myTake ? 0 : a.myTake === "loved" ? -1 : 1));
    return liked
      .slice(0, MAX_SEEDS)
      .map((e) => ({ sourceId: e.sourceId, mediaType: e.mediaType, weight: e.myTake === "loved" ? 3 : 2, title: e.title }));
  }, [bookEntries]);

  const opinionKey = useMemo(
    () =>
      bookEntries
        .filter((e) => e.myTake || e.status === "prob_not")
        .map((e) => `${e.id}:${e.myTake ?? "prob_not"}`)
        .sort()
        .join("|"),
    [bookEntries],
  );

  const deal = (from: Pick[]) => {
    const inLibrary = new Set(bookEntries.map((e) => e.id));
    setDeck(shuffled(from.filter((p) => !inLibrary.has(p.id))).slice(0, DECK_SIZE));
  };

  const generate = () => {
    if (!hydrated) return;
    const controller = new AbortController();
    setStatus("loading");

    const coldStart = () =>
      fetch("/api/top?kind=book", { signal: controller.signal })
        .then((r) => r.json())
        .then((data: { items?: Pick[] }) => {
          setPool(data.items ?? []);
          setPersonal(false);
          deal(data.items ?? []);
          setStatus("ready");
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setStatus("error");
        });

    if (seeds.length === 0) {
      coldStart();
      return controller;
    }

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
        if (data.items && data.items.length > 0) {
          setPool(data.items);
          setPersonal(true);
          deal(data.items);
          setStatus("ready");
        } else {
          coldStart();
        }
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setStatus("error");
      });
    return controller;
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const controller = generate();
    return () => controller?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, opinionKey]);

  if (!hydrated) return null;

  return (
    <div className="space-y-4">
      {status === "error" && (
        <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5 text-center">
          <p className="text-sm font-bold text-[#e8edf5]">Picks are taking a break.</p>
          <p className="mt-1 text-xs text-[#94a3b8]">Your lists still work, and nothing has been lost.</p>
          <button onClick={generate} className="mt-3 min-h-11 rounded-xl border border-[#26324c] px-4 text-sm font-bold text-[#22D3EE]">
            Try again
          </button>
        </div>
      )}

      {status !== "error" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[#94a3b8]">
              {personal
                ? "Built from your 👍s. Rate anything and the deck changes."
                : "Trending on Open Library right now — not personalized yet. Rate a few books and your picks go personal."}
            </p>
            <button onClick={() => deal(pool)} className="shrink-0 rounded-full border border-[#22D3EE] px-3 py-1.5 text-xs font-bold text-[#22D3EE] hover:bg-[#22D3EE]/10">
              Shuffle ↻
            </button>
          </div>

          {status === "loading" && deck.length === 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: DECK_SIZE }, (_, i) => (
                <div key={i} className="aspect-[2/3] animate-pulse rounded-xl border border-[#26324c] bg-[#141d2e]" />
              ))}
            </div>
          )}

          {deck.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {deck.map((p) => (
                <li key={p.id} className="flex flex-col gap-1">
                  <TitleCard item={p} entry={entryFor(p.id)} onMark={mark} onClear={remove} onTake={take} onAgain={again} />
                  {p.because && <p className="px-1 text-[10px] text-[#64748b]">Because you liked {p.because}</p>}
                </li>
              ))}
            </ul>
          )}

          {status === "ready" && deck.length === 0 && (
            <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5 text-center">
              <p className="text-sm font-bold text-[#e8edf5]">You&apos;ve been through this batch.</p>
              <button onClick={generate} className="mt-3 min-h-11 rounded-xl bg-[#22D3EE] px-4 text-sm font-black text-[#06131a]">
                Give me more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
