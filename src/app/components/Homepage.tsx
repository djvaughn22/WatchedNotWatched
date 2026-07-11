"use client";

import Link from "next/link";
import SearchExperience from "./SearchExperience";
import { useLibrary } from "@/lib/useLocal";
import { inView, VIEW_LABELS, type LibraryView } from "@/lib/library";
import { DECADES } from "@/lib/media/genres";

const SNAPSHOT_VIEWS: LibraryView[] = ["want_to_watch", "watched", "watch_again", "favorites"];

export function Homepage() {
  const { entries, hydrated } = useLibrary();

  return (
    <main className="min-h-screen bg-[#0b1220] text-[#e8edf5]">
      <section className="px-4 pt-12 pb-8 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Remember what you watched.
            <br />
            Find what comes next.
          </h1>
          <div className="mx-auto mt-7 max-w-3xl text-left">
            <SearchExperience autoFocus />
          </div>
        </div>
      </section>

      <section className="border-t border-[#26324c] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#94a3b8]">
            How many have you seen?
          </h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {DECADES.map((d) => (
              <Link
                key={d.id}
                href={`/top?decade=${d.id}`}
                className="rounded-full border border-[#26324c] px-4 py-2 text-sm font-bold text-[#e8edf5] transition-colors hover:border-[#22D3EE] hover:text-[#22D3EE]"
              >
                Top 100 of the {d.label}
              </Link>
            ))}
            <Link
              href="/top"
              className="rounded-full border border-[#26324c] px-4 py-2 text-sm font-bold text-[#e8edf5] transition-colors hover:border-[#22D3EE] hover:text-[#22D3EE]"
            >
              By genre →
            </Link>
          </div>
        </div>
      </section>

      {hydrated && entries.length > 0 && (
        <section className="border-t border-[#26324c] px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#94a3b8]">Your library</h2>
              <Link href="/library" className="text-sm font-semibold text-[#22D3EE] hover:underline">
                Open library →
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SNAPSHOT_VIEWS.map((v) => {
                const count = entries.filter((e) => inView(e, v)).length;
                return (
                  <Link
                    key={v}
                    href={`/library?view=${v}`}
                    className="rounded-xl border border-[#26324c] bg-[#141d2e] p-4 text-center transition-colors hover:border-[#22D3EE]"
                  >
                    <p className="text-2xl font-black text-[#e8edf5]">{count}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#94a3b8]">{VIEW_LABELS[v]}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {hydrated && entries.length === 0 && (
        <section className="border-t border-[#26324c] px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm text-[#94a3b8]">
              Search a title, tap <strong className="text-[#e8edf5]">Watched</strong> or{" "}
              <strong className="text-[#e8edf5]">Want to Watch</strong>, and keep going. Your library builds itself.
            </p>
          </div>
        </section>
      )}

      <section className="border-t border-[#26324c] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs leading-relaxed text-[#64748b]">
            Saved on this device. Export a backup anytime. No account needed.
          </p>
        </div>
      </section>
    </main>
  );
}
