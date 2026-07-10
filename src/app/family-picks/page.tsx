import type { Metadata } from "next";
import Link from "next/link";
import { SAMPLE_CATALOG } from "@/data/catalog";

export const metadata: Metadata = { title: "Family Picks — WatchedNotWatched" };

// Honest Family Picks: we do not have a curated editorial guidance catalog yet,
// so we do NOT show fabricated recommendation carousels. What we can show
// truthfully today is a small public-domain starting set + search shortcuts.
const STARTERS = [
  { label: "Family movie night", q: "family" },
  { label: "Comedy", q: "comedy" },
  { label: "Adventure", q: "adventure" },
  { label: "True stories", q: "based on a true story" },
];

export default function FamilyPicksPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-black text-[#e8edf5]">Family Picks</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#94a3b8]">
          A curated, reviewed catalog is on the way. Until then, here are honest starting points — search shortcuts and a small public-domain set — not a fabricated “everything is safe” list.
        </p>

        <h2 className="mt-8 text-sm font-black uppercase tracking-widest text-[#94a3b8]">Start a search</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <Link key={s.q} href={`/search?q=${encodeURIComponent(s.q)}`} className="rounded-full border border-[#26324c] px-4 py-2 text-sm font-semibold text-[#e8edf5] hover:border-[#22D3EE]">
              {s.label}
            </Link>
          ))}
        </div>

        <h2 className="mt-8 text-sm font-black uppercase tracking-widest text-[#94a3b8]">Public-domain films (sample)</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {SAMPLE_CATALOG.map((t) => (
            <li key={t.id}>
              <Link href={`/title/sample/${t.sourceId}?mediaType=movie`} className="block rounded-xl border border-[#26324c] bg-[#141d2e] p-4 hover:border-[#22D3EE]">
                <p className="text-sm font-bold text-[#e8edf5]">{t.title}</p>
                <p className="text-xs text-[#94a3b8]">Movie · {t.releaseYear} · Sample record</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
