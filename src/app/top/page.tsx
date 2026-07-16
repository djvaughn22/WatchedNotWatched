import type { Metadata } from "next";
import TopClient from "./TopClient";

export const metadata: Metadata = {
  title: "Top 222",
  description:
    "The top 222 movies and shows of all time, of every decade, and of every genre — ranked by ratings. Mark what you've watched and what's next.",
};

export default function TopPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-black text-[#e8edf5]">Top 222</h1>
        <p className="mt-1 mb-4 text-sm text-[#94a3b8]">How many have you seen?</p>
        <TopClient />
      </div>
    </main>
  );
}
