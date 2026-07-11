"use client";

// For You: recommendations grown from the user's own thumbs. Seeds = loved
// (weight 3) and liked (weight 2) titles, newest first; the server crosses
// them with TMDB's recommendation graph and returns the titles most similar
// to the user's taste. Anything already in the library is hidden — this
// page is only ever new-to-you.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SearchResultItem } from "@/lib/media/types";
import { useLibrary } from "@/lib/useLocal";
import TitleCard from "@/app/components/TitleCard";

type Pick = SearchResultItem & { because?: string };

export default function ForYouClient() {
  const { entries, entryFor, mark, take, again, remove, hydrated } = useLibrary();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [status, setStatus] = useState<"loading" | "no_seeds" | "error" | "unsupported" | "done">("loading");

  // Loved beats liked, newest first. Capped server-side at 8 seeds.
  const seeds = useMemo(() => {
    if (!hydrated) return [];
    const liked = entries.filter((e) => e.myTake === "loved" || e.myTake === "liked");
    liked.sort((a, b) => (a.myTake === b.myTake ? 0 : a.myTake === "loved" ? -1 : 1));
    return liked.map((e) => ({
      sourceId: e.sourceId,
      mediaType: e.mediaType,
      weight: e.myTake === "loved" ? 3 : 2,
      title: e.title,
    }));
  }, [entries, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (seeds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("no_seeds");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
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
      .then((data: { items?: Pick[]; supported?: boolean }) => {
        if (data.supported === false) {
          setStatus("unsupported");
          return;
        }
        setPicks(data.items ?? []);
        setStatus("done");
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
    // Refetch only when the seed fingerprint changes, not on every library tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, seeds.map((s) => s.sourceId + s.weight).join(",")]);

  // New-to-you only: hide picks already in the library, live as you tap.
  const fresh = picks.filter((p) => !entryFor(p.id) || entryFor(p.id)?.status !== "watched");

  return (
    <>
      {status === "loading" && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl border border-[#26324c] bg-[#141d2e]" />
          ))}
        </div>
      )}

      {status === "no_seeds" && (
        <div className="rounded-xl border border-[#26324c] bg-[#141d2e] p-6 text-center">
          <p className="text-sm font-bold text-[#e8edf5]">Thumb some titles up first.</p>
          <p className="mt-1 text-xs text-[#94a3b8]">
            Mark what you liked on the <Link href="/top" className="text-[#22D3EE] hover:underline">Top 222 board</Link> or
            in <Link href="/search" className="text-[#22D3EE] hover:underline">search</Link> — picks show up here.
          </p>
        </div>
      )}

      {status === "unsupported" && (
        <p className="rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center text-sm text-[#94a3b8]">
          Picks need the movie database connection, which isn’t configured yet.
        </p>
      )}

      {status === "error" && (
        <p className="rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center text-sm text-[#94a3b8]">
          Picks didn’t load. Try again in a moment.
        </p>
      )}

      {status === "done" && fresh.length === 0 && (
        <div className="rounded-xl border border-[#26324c] bg-[#141d2e] p-6 text-center">
          <p className="text-sm font-bold text-[#e8edf5]">You’ve been through all of these.</p>
          <p className="mt-1 text-xs text-[#94a3b8]">
            Thumb up more titles on the <Link href="/top" className="text-[#22D3EE] hover:underline">Top 222 board</Link> for fresh picks.
          </p>
        </div>
      )}

      {status === "done" && fresh.length > 0 && hydrated && (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {fresh.map((p) => (
              <li key={p.id} className="flex flex-col gap-1">
                <TitleCard
                  item={p}
                  entry={entryFor(p.id)}
                  onMark={mark}
                  onClear={remove}
                  onTake={take}
                  onAgain={again}
                />
                {p.because && (
                  <p className="px-1 text-[10px] text-[#64748b]">Because you liked {p.because}</p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-[#64748b]">
            Built from your 👍s and TMDB’s recommendation data. Your library never leaves this device.
          </p>
        </>
      )}
    </>
  );
}
