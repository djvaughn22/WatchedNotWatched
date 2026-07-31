import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-black text-[#e8edf5]">About WatchedNotWatched</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#94a3b8]">
          WatchedNotWatched is a personal record of what you have watched and what you want to watch next.
          Search a title, mark it Watched or Want to Watch, add your take, and keep going.
        </p>

        <h2 className="mt-8 text-lg font-bold text-[#e8edf5]">What it does</h2>
        <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-[#94a3b8]">
          <li>· Search movies and TV shows.</li>
          <li>· One-tap Watched / Want to Watch.</li>
          <li>· Your take: Loved it, Liked it, Fine, Not for me — and whether you’d watch it again.</li>
          <li>· A filterable library: Want to Watch, Watched, Watch Again, Favorites.</li>
          <li>· Trailers and similar titles.</li>
          <li>· Links to legitimate streaming providers.</li>
          <li>· Export your library as CSV, JSON, or Markdown.</li>
        </ul>

        <h2 className="mt-8 text-lg font-bold text-[#e8edf5]">Your data</h2>
        <p className="mt-2 rounded-2xl border border-[#26324c] bg-[#141d2e] p-4 text-[15px] leading-relaxed text-[#e8edf5]">
          No account. Your library is saved on this device. Export a backup anytime.
        </p>

        <p className="mt-8 text-sm text-[#94a3b8]">
          See the <Link href="/legal" className="text-[#22D3EE] hover:underline">Privacy, Terms &amp; Disclaimer</Link>. Part of{" "}
          <a href="https://openmirrorllc.com" className="text-[#22D3EE] hover:underline">Open Mirror LLC</a>.
        </p>
      </div>
    </main>
  );
}
