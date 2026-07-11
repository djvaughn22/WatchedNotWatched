import type { Metadata } from "next";
import TopClient from "./TopClient";

export const metadata: Metadata = {
  title: "Top 100 — WatchedNotWatched",
  description:
    "The top 100 movies and shows of the ’80s, ’90s, 2000s, 2010s, and 2020s — and of every genre. Mark what you've watched and what's next.",
};

export default function TopPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-black text-[#e8edf5]">Top 100</h1>
        <p className="mt-1 mb-4 text-sm text-[#94a3b8]">How many have you seen?</p>
        <TopClient />
      </div>
    </main>
  );
}
