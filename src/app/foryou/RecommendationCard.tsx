"use client";

// One recommendation. Mobile-first horizontal card: poster + facts on top,
// "Why this fits you" / "Know before watching" readable inline (no modals),
// content guide behind one disclosure, big-thumb action row at the bottom.

import { useState } from "react";
import Link from "next/link";
import { DISMISS_REASON_LABELS, type DismissReason } from "@/lib/recommendations/feedback";
import { MATCH_LABELS, type RecommendationItem } from "@/lib/recommendations/types";

const MATCH_COLORS: Record<RecommendationItem["matchLevel"], string> = {
  strong: "#22D3EE",
  good: "#60A5FA",
  stretch: "#A78BFA",
};

const REASON_CHIPS: DismissReason[] = [
  "not_for_me",
  "already_seen",
  "too_intense",
  "too_slow",
  "too_childish",
  "too_mature",
  "not_available",
  "wrong_mood",
];

const GUIDE_LABELS: Array<[keyof NonNullable<RecommendationItem["contentGuide"]>, string]> = [
  ["violence", "Violence"],
  ["language", "Language"],
  ["sexualContent", "Sexual content"],
  ["frighteningIntensity", "Frightening or intense"],
  ["substanceUse", "Substance use"],
  ["matureThemes", "Mature themes"],
];

function runtimeLabel(item: RecommendationItem): string | null {
  if (!item.runtimeMinutes) return null;
  const h = Math.floor(item.runtimeMinutes / 60);
  const m = item.runtimeMinutes % 60;
  const t = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return item.mediaType === "series" ? `~${t} episodes` : t;
}

export default function RecommendationCard({
  item,
  onSave,
  onWatched,
  onDismiss,
  onAnother,
}: {
  item: RecommendationItem;
  onSave: (item: RecommendationItem) => void;
  onWatched: (item: RecommendationItem) => void;
  onDismiss: (item: RecommendationItem, reason: DismissReason) => void;
  onAnother: (item: RecommendationItem) => void;
}) {
  const [picking, setPicking] = useState(false);
  const detailHref = `/title/${item.source}/${item.sourceId}?mediaType=${item.mediaType}`;
  const runtime = runtimeLabel(item);

  return (
    <article
      className="overflow-hidden rounded-2xl border border-[#26324c] bg-[#141d2e]"
      aria-label={`Recommendation: ${item.title}`}
    >
      <div className="flex gap-3 p-3">
        <Link href={detailHref} className="block w-24 shrink-0 self-start overflow-hidden rounded-lg bg-[#0b1220] sm:w-28">
          {item.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.posterUrl} alt={`${item.title} poster`} className="aspect-[2/3] w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center text-3xl" aria-hidden>
              🎬
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-black text-[#06131a]"
            style={{ backgroundColor: MATCH_COLORS[item.matchLevel] }}
          >
            {MATCH_LABELS[item.matchLevel]}
          </span>
          <h3 className="mt-1 text-base font-black leading-snug text-[#e8edf5]">
            <Link href={detailHref} className="hover:underline">
              {item.title}
            </Link>
          </h3>
          <p className="text-xs text-[#94a3b8]">
            {item.mediaType === "series" ? "Series" : "Movie"}
            {item.releaseYear ? ` · ${item.releaseYear}` : ""}
            {runtime ? ` · ${runtime}` : ""}
            {item.officialRating ? ` · ${item.officialRating}` : ""}
          </p>
          {item.providers && item.providers.length > 0 && (
            <p className="mt-1 text-xs text-[#94a3b8]">
              Streaming on <span className="text-[#e8edf5]">{item.providers.join(", ")}</span>
            </p>
          )}
          {item.because && <p className="mt-1 text-[11px] text-[#64748b]">Because you liked {item.because}</p>}
        </div>
      </div>

      <div className="space-y-2.5 px-3 pb-3">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#22D3EE]">Why this fits you</h4>
          <p className="mt-0.5 text-sm leading-snug text-[#e8edf5]">{item.whyItFits}</p>
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Know before watching</h4>
          <p className="mt-0.5 text-sm leading-snug text-[#94a3b8]">{item.knowBeforeWatching}</p>
        </div>

        {item.contentGuide && (
          <details className="rounded-lg border border-[#26324c]">
            <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-[#94a3b8]">
              Age &amp; content guide{item.officialRating ? ` · rated ${item.officialRating}` : ""}
            </summary>
            <dl className="space-y-1 px-3 pb-2 text-xs">
              {GUIDE_LABELS.map(([key, label]) => (
                <div key={key} className="flex gap-2">
                  <dt className="w-32 shrink-0 font-bold text-[#64748b]">{label}</dt>
                  <dd className="text-[#94a3b8]">{item.contentGuide![key]}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        {!picking ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSave(item)}
              className="min-h-11 rounded-xl bg-[#60A5FA] px-3 text-sm font-black text-[#06131a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA]"
            >
              + Want to Watch
            </button>
            <button
              onClick={() => onWatched(item)}
              className="min-h-11 rounded-xl bg-[#22D3EE] px-3 text-sm font-black text-[#06131a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
            >
              ✓ Watched
            </button>
            <button
              onClick={() => setPicking(true)}
              className="min-h-11 rounded-xl border border-[#26324c] px-3 text-sm font-bold text-[#94a3b8] hover:text-[#e8edf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#94a3b8]"
            >
              Not for me
            </button>
            <button
              onClick={() => onAnother(item)}
              className="min-h-11 rounded-xl border border-[#26324c] px-3 text-sm font-bold text-[#94a3b8] hover:text-[#e8edf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#94a3b8]"
            >
              Show me another
            </button>
            <Link
              href={detailHref}
              className="col-span-2 flex min-h-11 items-center justify-center rounded-xl border border-[#26324c] px-3 text-sm font-bold text-[#22D3EE] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
            >
              Do I want to watch this? →
            </Link>
          </div>
        ) : (
          <div role="group" aria-label={`Why isn't ${item.title} for you?`}>
            <p className="mb-1.5 text-xs font-bold text-[#94a3b8]">Why not? This tunes your next picks.</p>
            <div className="flex flex-wrap gap-1.5">
              {REASON_CHIPS.map((r) => (
                <button
                  key={r}
                  onClick={() => onDismiss(item, r)}
                  className="min-h-9 rounded-full border border-[#26324c] px-3 text-xs font-bold text-[#94a3b8] hover:text-[#e8edf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#94a3b8]"
                >
                  {DISMISS_REASON_LABELS[r]}
                </button>
              ))}
              <button
                onClick={() => setPicking(false)}
                className="min-h-9 rounded-full px-3 text-xs font-bold text-[#64748b] hover:text-[#e8edf5]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
