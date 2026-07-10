"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/filter/types";
import { evaluateCompatibility } from "@/lib/compatibility";
import { LEVEL_LABELS, isReviewed } from "@/lib/guidance";
import type { MediaTitle, TrailerReference } from "@/lib/media/types";
import { buildHandoff, PROVIDERS } from "@/lib/providers";
import { useProfiles, useSaved } from "@/lib/useLocal";

const DATA_STATUS_LABEL: Record<string, string> = {
  live: "Live metadata",
  cached: "Cached metadata",
  editorial: "Editorially reviewed",
  sample: "Sample record",
  unavailable: "Unavailable",
};

export default function TitleDetailClient({ source, id, mediaType }: { source: string; id: string; mediaType: string }) {
  const [title, setTitle] = useState<MediaTitle | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [trailer, setTrailer] = useState<{ trailer: TrailerReference | null; searchUrl: string } | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const { active } = useProfiles();
  const { isSaved, toggle } = useSaved();

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
        fetch(`/api/trailer?title=${encodeURIComponent(data.title)}&year=${data.releaseYear ?? ""}`)
          .then((r) => r.json())
          .then((t) => alive && setTrailer(t))
          .catch(() => {});
      })
      .catch(() => alive && setStatus("error"));
    return () => { alive = false; };
  }, [source, id, mediaType]);

  const compat = useMemo(
    () => (title?.guidance && active ? evaluateCompatibility(title.guidance, active) : null),
    [title, active],
  );

  if (status === "loading") return <div className="mx-auto max-w-3xl px-4 py-10"><div className="h-64 animate-pulse rounded-2xl bg-[#141d2e]" /></div>;
  if (status === "error" || !title) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-[#e8edf5]">We couldn’t load that title.</p>
        <a href="/search" className="mt-4 inline-block rounded-full bg-[#22D3EE] px-4 py-2 text-sm font-bold text-[#06131a]">Back to search</a>
      </div>
    );
  }

  const saved = isSaved(title.id);
  const reviewedCats = (title.guidance?.categories ?? []).filter((c) => isReviewed(c.level) && c.level !== "none-noted");

  const share = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/title/${source}/${id}?mediaType=${mediaType}` : "";
    try {
      if (navigator.share) { await navigator.share({ title: title.title, url }); return; }
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied");
      setTimeout(() => setShareMsg(""), 1500);
    } catch { /* ignore */ }
  };

  const verdictColor =
    compat?.verdict === "good-match" ? "border-[#22D3EE] text-[#22D3EE]"
    : compat?.verdict === "outside-profile" ? "border-[#94a3b8] text-[#e8edf5]"
    : "border-[#26324c] text-[#e8edf5]";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* 1. Identity */}
      <div className="flex gap-4">
        <div className="h-40 w-28 shrink-0 overflow-hidden rounded-lg bg-[#141d2e]">
          {title.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={title.posterUrl} alt="" className="h-full w-full object-cover" />
          ) : <div className="flex h-full w-full items-center justify-center text-3xl">🎬</div>}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-[#e8edf5]">{title.title}</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            {title.mediaType === "series" ? "Series" : "Movie"}{title.releaseYear ? ` · ${title.releaseYear}` : ""}{title.runtimeMinutes ? ` · ${title.runtimeMinutes} min` : ""}{title.officialRating ? ` · ${title.officialRating}` : ""}
          </p>
          <p className="mt-1 inline-block rounded-full border border-[#26324c] px-2 py-0.5 text-[11px] text-[#94a3b8]">
            {DATA_STATUS_LABEL[title.dataStatus] ?? title.dataStatus}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => toggle({ id: title.id, source, sourceId: id, mediaType, title: title.title, releaseYear: title.releaseYear, posterUrl: title.posterUrl })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${saved ? "border-[#22D3EE] text-[#22D3EE]" : "border-[#26324c] text-[#94a3b8]"}`}>
              {saved ? "Saved ✓" : "Save"}
            </button>
            <button onClick={share} className="rounded-full border border-[#26324c] px-3 py-1.5 text-xs font-semibold text-[#94a3b8]">
              {shareMsg || "Share"}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Compatibility */}
      {compat && active && (
        <section className={`mt-6 rounded-2xl border bg-[#141d2e] p-5 ${verdictColor}`}>
          <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">{active.name} profile</p>
          <p className="mt-1 text-lg font-black">{compat.headline}</p>
          <ul className="mt-2 space-y-1 text-sm text-[#e8edf5]">
            {compat.reasons.map((r, i) => <li key={i}>· {r}</li>)}
          </ul>
        </section>
      )}

      {/* 3/4. Guidance */}
      <section className="mt-6 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
        <h2 className="text-sm font-bold text-[#e8edf5]">Content guidance</h2>
        {reviewedCats.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {reviewedCats.map((c) => (
              <span key={c.category} className="rounded-full border border-[#26324c] px-3 py-1 text-xs text-[#e8edf5]">
                {LEVEL_LABELS[c.level]} {CATEGORY_LABELS[c.category].toLowerCase()}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm leading-relaxed text-[#94a3b8]">
          {title.guidance?.overallNote ?? "Detailed guidance is not available for this title."}
          {title.officialRating ? ` Official rating: ${title.officialRating}. An official age rating is not the same as detailed WatchedNotWatched guidance.` : ""}
        </p>
      </section>

      {/* 6. Where to watch */}
      <section className="mt-6 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
        <h2 className="text-sm font-bold text-[#e8edf5]">Where to watch</h2>
        {title.availability && title.availability.length > 0 ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {title.availability.map((a, i) => {
                const known = a.providerId && PROVIDERS[a.providerId];
                const handoff = known ? buildHandoff({ providerId: a.providerId, title: title.title, watchOptionsUrl: title.watchOptionsUrl }) : null;
                if (handoff?.url) {
                  return (
                    <a key={i} href={handoff.url} target="_blank" rel="noopener noreferrer"
                      className="rounded-full border border-[#26324c] px-3 py-1.5 text-sm font-semibold text-[#e8edf5] hover:border-[#22D3EE]">
                      {handoff.label}{a.monetization ? ` · ${a.monetization}` : ""}
                    </a>
                  );
                }
                return <span key={i} className="rounded-full border border-[#26324c] px-3 py-1.5 text-sm text-[#94a3b8]">{a.providerName}{a.monetization ? ` · ${a.monetization}` : ""}</span>;
              })}
            </div>
            {title.watchOptionsUrl && (
              <a href={title.watchOptionsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#22D3EE] hover:underline">View all watch options →</a>
            )}
            <p className="mt-2 text-xs text-[#94a3b8]">Availability and subscriptions vary by region and provider. WatchedNotWatched opens the provider — it does not connect your account.</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[#94a3b8]">No provider availability found for your region{title.dataStatus === "sample" ? " (sample record)" : ""}.</p>
        )}
      </section>

      {/* 7. Trailer */}
      <section className="mt-6 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
        <h2 className="text-sm font-bold text-[#e8edf5]">Trailer</h2>
        {trailer?.trailer ? (
          <>
            <div className="relative mt-3 aspect-video overflow-hidden rounded-lg bg-black">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${trailer.trailer.youtubeId}`}
                title={trailer.trailer.title}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="mt-2 text-xs text-[#94a3b8]">
              {trailer.trailer.official ? "Official trailer" : "Trailer result"}{trailer.trailer.channelTitle ? ` · ${trailer.trailer.channelTitle}` : ""} · via YouTube
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[#94a3b8]">
            No trailer loaded.{" "}
            {trailer?.searchUrl && <a href={trailer.searchUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#22D3EE] hover:underline">Search on YouTube →</a>}
          </p>
        )}
      </section>

      {/* 9. Attribution */}
      {title.attribution && title.attribution.length > 0 && (
        <p className="mt-6 text-[11px] leading-relaxed text-[#64748b]">
          {title.attribution.map((a) => a.text).join(" ")}
        </p>
      )}
    </div>
  );
}
