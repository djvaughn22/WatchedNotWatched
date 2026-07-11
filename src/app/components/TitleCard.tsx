"use client";

// Poster-forward title card with one-tap logging. Used by search results and
// similar-title rails. Marking Watched reveals optional My Take / Again chips
// right on the card — rate it in two more taps or just keep going.

import Link from "next/link";
import type { SearchResultItem } from "@/lib/media/types";
import {
  AGAIN_LABELS,
  MY_TAKE_LABELS,
  type Again,
  type LibraryEntry,
  type LibraryStatus,
  type MyTake,
  type TitleRef,
} from "@/lib/library";

const TAKES: MyTake[] = ["loved", "liked", "fine", "not_for_me"];
const AGAINS: Again[] = ["yes", "maybe", "no"];

export function toTitleRef(it: SearchResultItem): TitleRef {
  return {
    id: it.id,
    source: it.source,
    sourceId: it.sourceId,
    mediaType: it.mediaType,
    title: it.title,
    releaseYear: it.releaseYear,
    posterUrl: it.posterUrl,
  };
}

export default function TitleCard({
  item,
  entry,
  onMark,
  onTake,
  onAgain,
}: {
  item: SearchResultItem;
  entry: LibraryEntry | undefined;
  onMark: (ref: TitleRef, status: LibraryStatus) => void;
  onTake: (id: string, take: MyTake | undefined) => void;
  onAgain: (id: string, again: Again | undefined) => void;
}) {
  const status = entry?.status;
  const detailHref = `/title/${item.source}/${item.sourceId}?mediaType=${item.mediaType}`;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#26324c] bg-[#141d2e]">
      <Link href={detailHref} className="relative block aspect-[2/3] bg-[#0b1220]">
        {item.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.posterUrl} alt={`${item.title} poster`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
            <span className="text-3xl" aria-hidden>🎬</span>
            <span className="text-xs font-semibold leading-snug text-[#94a3b8]">{item.title}</span>
          </div>
        )}
        {status && (
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black ${status === "watched" ? "bg-[#22D3EE] text-[#06131a]" : "bg-[#0b1220]/90 text-[#22D3EE] border border-[#22D3EE]"}`}>
            {status === "watched" ? "Watched" : "Want to Watch"}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <Link href={detailHref} className="min-w-0">
          <p className="truncate text-sm font-bold text-[#e8edf5]">{item.title}</p>
          <p className="text-xs text-[#94a3b8]">
            {item.mediaType === "series" ? "TV" : "Movie"}
            {item.releaseYear ? ` · ${item.releaseYear}` : ""}
          </p>
        </Link>

        <div className="mt-auto grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onMark(toTitleRef(item), "want_to_watch")}
            aria-pressed={status === "want_to_watch"}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${
              status === "want_to_watch"
                ? "bg-[#22D3EE] text-[#06131a]"
                : "border border-[#26324c] text-[#94a3b8] hover:border-[#22D3EE] hover:text-[#e8edf5]"
            }`}
          >
            {status === "want_to_watch" ? "On your list ✓" : "Want to Watch"}
          </button>
          <button
            onClick={() => onMark(toTitleRef(item), "watched")}
            aria-pressed={status === "watched"}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${
              status === "watched"
                ? "bg-[#22D3EE] text-[#06131a]"
                : "border border-[#26324c] text-[#94a3b8] hover:border-[#22D3EE] hover:text-[#e8edf5]"
            }`}
          >
            {status === "watched" ? "Watched ✓" : "Watched"}
          </button>
        </div>

        {status === "watched" && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1" role="group" aria-label="My Take">
              {TAKES.map((t) => (
                <button
                  key={t}
                  onClick={() => onTake(item.id, entry?.myTake === t ? undefined : t)}
                  aria-pressed={entry?.myTake === t}
                  className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                    entry?.myTake === t
                      ? "bg-[#e8edf5] text-[#06131a]"
                      : "border border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"
                  }`}
                >
                  {MY_TAKE_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Watch again?">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Again?</span>
              {AGAINS.map((a) => (
                <button
                  key={a}
                  onClick={() => onAgain(item.id, entry?.again === a ? undefined : a)}
                  aria-pressed={entry?.again === a}
                  className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                    entry?.again === a
                      ? "bg-[#e8edf5] text-[#06131a]"
                      : "border border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"
                  }`}
                >
                  {AGAIN_LABELS[a]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
