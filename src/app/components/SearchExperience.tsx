"use client";

// The rapid-log loop: type a few letters → poster grid → one tap → next.
// A session tally keeps score; the box is always ready for the next title.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchResult, SearchResultItem } from "@/lib/media/types";
import { useLibrary } from "@/lib/useLocal";
import type { LibraryStatus, TitleRef } from "@/lib/library";
import TitleCard from "./TitleCard";

const RECENT_KEY = "wnw.recent.v1";
const TALLY_KEY = "wnw.tally.v1"; // per-browser-session logging count

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

function readTally(): number {
  try {
    return Number(window.sessionStorage.getItem(TALLY_KEY)) || 0;
  } catch {
    return 0;
  }
}

export default function SearchExperience({
  autoFocus = false,
  initialQuery = "",
  syncUrl = false,
}: {
  autoFocus?: boolean;
  /** Seed the box from a ?q= deep link. */
  initialQuery?: string;
  /** Keep ?q= in the address bar so searches are shareable. */
  syncUrl?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [recent, setRecent] = useState<string[]>([]);
  const [tally, setTally] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { entryFor, mark, take, again, hydrated } = useLibrary();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readRecent());
    setTally(readTally());
  }, []);

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
        setStatus("done");
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setStatus("error");
      });
  }, []);

  // Debounce.
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  // Keep ?q= shareable without triggering a navigation.
  useEffect(() => {
    if (!syncUrl || typeof window === "undefined") return;
    const q = query.trim();
    const url = q.length >= 2 ? `?q=${encodeURIComponent(q)}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [query, syncUrl]);

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

  const bumpTally = () => {
    setTally((t) => {
      const next = t + 1;
      try {
        window.sessionStorage.setItem(TALLY_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleMark = (ref: TitleRef, s: LibraryStatus) => {
    const wasNew = !entryFor(ref.id) || entryFor(ref.id)?.status !== s;
    mark(ref, s);
    if (wasNew) bumpTally();
    if (query.trim().length >= 2) commitRecent(query.trim());
  };

  const nextTitle = () => {
    setQuery("");
    setItems([]);
    setStatus("idle");
    inputRef.current?.focus();
  };

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a movie or show…"
          aria-label="Search a movie or show"
          className="w-full rounded-full border border-[#26324c] bg-[#141d2e] px-5 py-3.5 text-base text-[#e8edf5] outline-none placeholder:text-[#64748b] focus:border-[#22D3EE]"
        />
        {query.length > 0 && (
          <button
            onClick={nextTitle}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-sm font-bold text-[#64748b] hover:text-[#e8edf5]"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tally > 0 && (
          <span className="rounded-full border border-[#22D3EE] px-3 py-1 text-xs font-bold text-[#22D3EE]">
            {tally} logged this session
          </span>
        )}
        {recent.length > 0 && status === "idle" && (
          <>
            <span className="text-xs text-[#94a3b8]">Recent:</span>
            {recent.map((r) => (
              <button key={r} onClick={() => setQuery(r)} className="rounded-full border border-[#26324c] px-3 py-1 text-xs text-[#94a3b8] hover:text-[#e8edf5]">
                {r}
              </button>
            ))}
            <button onClick={clearRecent} className="text-xs text-[#64748b] underline">Clear</button>
          </>
        )}
      </div>

      <div className="mt-4">
        {status === "loading" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[2/4] animate-pulse rounded-xl border border-[#26324c] bg-[#141d2e]" />
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
          <p className="rounded-xl border border-[#26324c] bg-[#141d2e] p-5 text-center text-sm text-[#94a3b8]">
            No results for “{query.trim()}”. Check the spelling or try a shorter version of the name.
          </p>
        )}

        {status === "done" && items.length > 0 && hydrated && (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((it) => (
                <li key={it.id}>
                  <TitleCard item={it} entry={entryFor(it.id)} onMark={handleMark} onTake={take} onAgain={again} />
                </li>
              ))}
            </ul>
            <div className="mt-4 text-center">
              <button onClick={nextTitle} className="rounded-full bg-[#22D3EE] px-5 py-2.5 text-sm font-bold text-[#06131a]">
                Next title →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
