"use client";

import Link from "next/link";
import { useSaved } from "@/lib/useLocal";

export default function SavedClient() {
  const { saved, remove } = useSaved();

  if (saved.length === 0) {
    return (
      <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-8 text-center">
        <p className="text-[#e8edf5]">Nothing saved yet.</p>
        <p className="mt-1 text-sm text-[#94a3b8]">Save titles from search or a title page to keep them here.</p>
        <Link href="/search" className="mt-4 inline-block rounded-full bg-[#22D3EE] px-4 py-2 text-sm font-bold text-[#06131a]">Search titles</Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-xs text-[#94a3b8]">Saved on this device.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {saved.map((t) => (
          <li key={t.id} className="flex gap-3 rounded-xl border border-[#26324c] bg-[#141d2e] p-3">
            <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-[#0b1220]">
              {t.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.posterUrl} alt="" className="h-full w-full object-cover" />
              ) : <div className="flex h-full w-full items-center justify-center text-2xl">🎬</div>}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-sm font-bold text-[#e8edf5]">{t.title}</p>
              <p className="text-xs text-[#94a3b8]">{t.mediaType === "series" ? "Series" : "Movie"}{t.releaseYear ? ` · ${t.releaseYear}` : ""}</p>
              <div className="mt-auto flex gap-2 pt-2">
                <Link href={`/title/${t.source}/${t.sourceId}?mediaType=${t.mediaType}`} className="rounded-full bg-[#22D3EE] px-3 py-1.5 text-xs font-bold text-[#06131a]">Details</Link>
                <button onClick={() => remove(t.id)} className="rounded-full border border-[#26324c] px-3 py-1.5 text-xs font-semibold text-[#94a3b8]">Remove</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
