"use client";

import { useEffect, useState } from "react";
import type { MediaTitle, ProviderAvailability, SearchResultItem, TrailerReference } from "@/lib/media/types";
import { buildHandoff, PROVIDERS } from "@/lib/providers";
import { useLibrary } from "@/lib/useLocal";
import {
  AGAIN_LABELS,
  MY_TAKE_LABELS,
  type Again,
  type MyTake,
  type TitleRef,
} from "@/lib/library";
import TitleCard from "@/app/components/TitleCard";
import TriageButtons from "@/app/components/TriageButtons";
import DecisionCard from "@/app/components/DecisionCard";

const TAKES: MyTake[] = ["loved", "liked", "fine", "not_for_me"];
const AGAINS: Again[] = ["yes", "maybe", "no"];

const MONETIZATION_LABELS: Record<string, string> = {
  sub: "Included with subscription",
  free: "Free",
  ads: "Free with ads",
  rent: "Rent",
  buy: "Buy",
  unknown: "Availability unknown",
};
const MONETIZATION_ORDER = ["sub", "free", "ads", "rent", "buy", "unknown"];

function groupProviders(availability: ProviderAvailability[]): Array<[string, ProviderAvailability[]]> {
  const groups = new Map<string, ProviderAvailability[]>();
  for (const a of availability) {
    const key = a.monetization ?? "unknown";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return MONETIZATION_ORDER.filter((k) => groups.has(k)).map((k) => [k, groups.get(k)!]);
}

export default function TitleDetailClient({ source, id, mediaType }: { source: string; id: string; mediaType: string }) {
  const [title, setTitle] = useState<MediaTitle | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [fallbackTrailer, setFallbackTrailer] = useState<{ trailer: TrailerReference | null; searchUrl: string } | null>(null);
  const [similar, setSimilar] = useState<{ items: SearchResultItem[]; supported: boolean } | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const { entryFor, mark, take, again, remove, hydrated } = useLibrary();

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    fetch(`/api/title?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}&mediaType=${encodeURIComponent(mediaType)}`)
      .then((r) => r.json())
      .then((data: MediaTitle | null) => {
        if (!alive) return;
        if (!data) { setStatus("error"); return; }
        setTitle(data);
        setStatus("done");
        if (!data.trailer) {
          fetch(`/api/trailer?title=${encodeURIComponent(data.title)}&year=${data.releaseYear ?? ""}`)
            .then((r) => r.json())
            .then((t) => alive && setFallbackTrailer(t))
            .catch(() => {});
        }
        fetch(`/api/similar?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}&mediaType=${encodeURIComponent(data.mediaType)}`)
          .then((r) => r.json())
          .then((s) => alive && setSimilar(s))
          .catch(() => {});
      })
      .catch(() => alive && setStatus("error"));
    return () => { alive = false; };
  }, [source, id, mediaType]);

  if (status === "loading") return <div className="mx-auto max-w-3xl px-4 py-10"><div className="h-64 animate-pulse rounded-2xl bg-[#141d2e]" /></div>;
  if (status === "error" || !title) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-[#e8edf5]">We couldn’t load that title.</p>
        <a href="/search" className="mt-4 inline-block rounded-full bg-[#22D3EE] px-4 py-2 text-sm font-bold text-[#06131a]">Back to search</a>
      </div>
    );
  }

  const entry = hydrated ? entryFor(title.id) : undefined;
  const ref: TitleRef = {
    id: title.id,
    source,
    sourceId: id,
    mediaType: title.mediaType,
    title: title.title,
    releaseYear: title.releaseYear,
    posterUrl: title.posterUrl,
    genres: title.genres,
  };

  const trailer = title.trailer ?? fallbackTrailer?.trailer ?? null;
  const trailerSearchUrl =
    fallbackTrailer?.searchUrl ??
    `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title.title} ${title.releaseYear ?? ""} trailer`.trim())}`;

  const share = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/title/${source}/${id}?mediaType=${title.mediaType}` : "";
    try {
      if (navigator.share) { await navigator.share({ title: title.title, url }); return; }
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied");
      setTimeout(() => setShareMsg(""), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Identity + actions */}
      <div className="flex gap-4">
        <div className="h-48 w-32 shrink-0 overflow-hidden rounded-lg border border-[#26324c] bg-[#0b1220] sm:h-60 sm:w-40">
          {title.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={title.posterUrl} alt={`${title.title} poster`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
              <span className="text-2xl" aria-hidden>🎬</span>
              <span className="text-[10px] font-semibold text-[#64748b]">No poster</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-[#e8edf5] sm:text-3xl">{title.title}</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            {title.mediaType === "series" ? "TV" : "Movie"}
            {title.releaseYear ? ` · ${title.releaseYear}` : ""}
            {title.runtimeMinutes ? ` · ${title.runtimeMinutes} min` : ""}
            {title.officialRating ? ` · ${title.officialRating}` : ""}
          </p>
          {title.genres && title.genres.length > 0 && (
            <p className="mt-1 text-xs text-[#64748b]">{title.genres.join(" · ")}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TriageButtons titleRef={ref} entry={entry} onMark={mark} onClear={remove} size="lg" />
            <button onClick={share} className="rounded-lg border border-[#26324c] px-4 py-2.5 text-sm font-semibold text-[#94a3b8] hover:text-[#e8edf5]">
              {shareMsg || "Share"}
            </button>
          </div>

          {entry?.status === "watched" && (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="My Take">
                <span className="text-xs font-bold uppercase tracking-wide text-[#64748b]">My Take</span>
                {TAKES.map((t) => (
                  <button
                    key={t}
                    onClick={() => take(title.id, entry?.myTake === t ? undefined : t)}
                    aria-pressed={entry?.myTake === t}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${entry?.myTake === t ? "bg-[#e8edf5] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"}`}
                  >
                    {MY_TAKE_LABELS[t]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Watch again?">
                <span className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Again?</span>
                {AGAINS.map((a) => (
                  <button
                    key={a}
                    onClick={() => again(title.id, entry?.again === a ? undefined : a)}
                    aria-pressed={entry?.again === a}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${entry?.again === a ? "bg-[#e8edf5] text-[#06131a]" : "border border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"}`}
                  >
                    {AGAIN_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {title.synopsis && (
        <p className="mt-6 text-sm leading-relaxed text-[#94a3b8]">{title.synopsis}</p>
      )}

      {/* Do I Want to Watch This? — the decision card */}
      <DecisionCard source={source} id={id} title={title} />

      {/* Where to watch */}
      <section className="mt-6 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
        <h2 className="text-sm font-bold text-[#e8edf5]">Where to watch</h2>
        {title.availability && title.availability.length > 0 ? (
          <>
            {groupProviders(title.availability).map(([monetization, providers]) => (
              <div key={monetization} className="mt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">{MONETIZATION_LABELS[monetization]}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {providers.map((a, i) => {
                    const known = a.providerId && PROVIDERS[a.providerId];
                    const handoff = known ? buildHandoff({ providerId: a.providerId, title: title.title, watchOptionsUrl: title.watchOptionsUrl }) : null;
                    if (handoff?.url) {
                      return (
                        <a key={i} href={handoff.url} target="_blank" rel="noopener noreferrer"
                          className="rounded-full border border-[#26324c] px-3 py-1.5 text-sm font-semibold text-[#e8edf5] hover:border-[#22D3EE]">
                          {a.providerName} ↗
                        </a>
                      );
                    }
                    return <span key={i} className="rounded-full border border-[#26324c] px-3 py-1.5 text-sm text-[#94a3b8]">{a.providerName}</span>;
                  })}
                </div>
              </div>
            ))}
            {title.watchOptionsUrl && (
              <a href={title.watchOptionsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#22D3EE] hover:underline">
                All watch options →
              </a>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-[#94a3b8]">No availability data for this title right now. Search the major providers:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["netflix", "prime", "disney", "max", "hulu", "appletv", "paramount", "peacock", "tubi"].map((pid) => {
                const h = buildHandoff({ providerId: pid, title: title.title });
                return (
                  <a key={pid} href={h.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#26324c] px-3 py-1.5 text-sm font-semibold text-[#e8edf5] hover:border-[#22D3EE]">
                    {h.label}
                  </a>
                );
              })}
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-[#64748b]">
          {title.updatedAt ? `Checked ${new Date(title.updatedAt).toLocaleDateString()}. ` : ""}
          Availability changes and varies by region; a subscription or purchase may be required. WatchedNotWatched opens the provider — it does not connect your account.
        </p>
      </section>

      {/* Trailer */}
      <section className="mt-6 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
        <h2 className="text-sm font-bold text-[#e8edf5]">Trailer</h2>
        {trailer ? (
          <>
            <div className="relative mt-3 aspect-video overflow-hidden rounded-lg bg-black">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${trailer.youtubeId}`}
                title={trailer.title}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="mt-2 text-xs text-[#64748b]">
              {trailer.official ? "Official trailer" : "Trailer"} · via YouTube
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[#94a3b8]">
            No trailer loaded.{" "}
            <a href={trailerSearchUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#22D3EE] hover:underline">Search on YouTube →</a>
          </p>
        )}
      </section>

      {/* Similar titles */}
      {similar && similar.supported && similar.items.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-bold text-[#e8edf5]">Similar titles</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {similar.items.slice(0, 8).map((it) => (
              <li key={it.id}>
                <TitleCard item={it} entry={hydrated ? entryFor(it.id) : undefined} onMark={mark} onClear={remove} onTake={take} onAgain={again} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sources */}
      {title.attribution && title.attribution.length > 0 && (
        <section className="mt-8 border-t border-[#26324c] pt-4">
          <ul className="space-y-1">
            {title.attribution.map((a, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-[#64748b]">
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#94a3b8]">{a.text}</a>
                ) : (
                  a.text
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
