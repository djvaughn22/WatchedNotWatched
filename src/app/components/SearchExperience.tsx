"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchResult, SearchResultItem } from "@/lib/media/types";
import { useSaved } from "@/lib/useLocal";

const RECENT_KEY = "wnw.recent.v1";

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

export default function SearchExperience({ autoFocus = false }: { autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [dataStatus, setDataStatus] = useState<SearchResult["dataStatus"]>("live");
  const [recent, setRecent] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const { isSaved, toggle } = useSaved();

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setRecent(readRecent()), []);

  const runSearch = useCallback((q: string) => {
    abortRef.current?.abort();
    if (q.trim().length < 2) {
      setItems([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<SearchResult>)
      .then((data) => {
        setItems(data.items ?? []);
        setDataStatus(data.dataStatus);
        setStatus("done");
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setStatus("error");
      });
  }, []);

  // Debounce.
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const commitRecent = (q: string) => {
    const next = [q, ...readRecent().filter((x) => x !== q)].slice(0, 6);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const clearRecent = () => {
    setRecent([]);
    try {
      window.localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <div className="relative">
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => query.trim().length >= 2 && commitRecent(query.trim())}
          placeholder="Search a movie or show…"
          aria-label="Search a movie or show"
          className="w-full rounded-full border border-[#26324c] bg-[#141d2e] px-5 py-3.5 text-base text-[#e8edf5] outline-none placeholder:text-[#64748b] focus:border-[#22D3EE]"
        />
      </div>

      {recent.length > 0 && status === "idle" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#94a3b8]">Recent:</span>
          {recent.map((r) => (
            <button key={r} onClick={() => setQuery(r)} className="rounded-full border border-[#26324c] px-3 py-1 text-xs text-[#94a3b8] hover:text-[#e8edf5]">
              {r}
            </button>
          ))}
          <button onClick={clearRecent} className="text-xs text-[#64748b] underline">Clear</button>
        </div>
      )}

      {dataStatus === "sample" && status === "done" && items.length > 0 && (
        <p className="mt-3 rounded-lg border border-[#26324c] bg-[#141d2e] px-3 py-2 text-xs text-[#94a3b8]">
          Showing <strong className="text-[#e8edf5]">sample records</strong> — the movie database is temporarily unavailable.
        </p>
      )}

      <div className="mt-5">
        {status === "loading" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-[#26324c] bg-[#141d2e]" />
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center">
            <p className="text-sm text-[#e8edf5]">Search didn’t load.</p>
            <button onClick={() => runSearch(query)} className="mt-3 rounded-full bg-[#22D3EE] px-4 py-2 text-sm font-bold text-[#06131a]">Retry</button>
          </div>
        )}

        {status === "done" && items.length === 0 && query.trim().length >= 2 && (
          dataStatus === "sample" ? (
            <div className="rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center">
              <p className="text-sm font-semibold text-[#e8edf5]">The movie database is temporarily unavailable.</p>
              <p className="mt-1 text-sm text-[#94a3b8]">Showing sample titles for now — try again in a moment, or see <a href="/family-picks" className="text-[#22D3EE] hover:underline">Family Picks</a>.</p>
            </div>
          ) : (
            <p className="rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center text-sm text-[#94a3b8]">No results for “{query.trim()}”.</p>
          )
        )}

        {items.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((it) => {
              const saved = isSaved(it.id);
              return (
                <li key={it.id} className="flex gap-3 rounded-xl border border-[#26324c] bg-[#141d2e] p-3">
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-[#0b1220]">
                    {it.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">🎬</div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-sm font-bold text-[#e8edf5]">{it.title}</p>
                    <p className="text-xs text-[#94a3b8]">
                      {it.mediaType === "series" ? "Series" : "Movie"}{it.releaseYear ? ` · ${it.releaseYear}` : ""}{it.officialRating ? ` · ${it.officialRating}` : ""}
                    </p>
                    <div className="mt-auto flex gap-2 pt-2">
                      <Link
                        href={`/title/${it.source}/${it.sourceId}?mediaType=${it.mediaType}`}
                        className="rounded-full bg-[#22D3EE] px-3 py-1.5 text-xs font-bold text-[#06131a]"
                      >
                        Details
                      </Link>
                      <button
                        onClick={() => toggle({ id: it.id, source: it.source, sourceId: it.sourceId, mediaType: it.mediaType, title: it.title, releaseYear: it.releaseYear, posterUrl: it.posterUrl })}
                        aria-pressed={saved}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${saved ? "border-[#22D3EE] text-[#22D3EE]" : "border-[#26324c] text-[#94a3b8] hover:text-[#e8edf5]"}`}
                      >
                        {saved ? "Saved ✓" : "Save"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
