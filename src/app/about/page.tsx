import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About — WatchedNotWatched" };

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-black text-[#e8edf5]">About WatchedNotWatched</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#94a3b8]">
          WatchedNotWatched was created by Open Mirror LLC to make entertainment decisions clearer before anyone presses Play.
        </p>

        <h2 className="mt-8 text-lg font-bold text-[#e8edf5]">What works now</h2>
        <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-[#94a3b8]">
          <li>· Title search.</li>
          <li>· Content guidance where available, plus the official age rating.</li>
          <li>· Family viewing profiles, saved on your device.</li>
          <li>· Provider availability and honest handoffs to legitimate providers.</li>
          <li>· Official trailers (when a YouTube key is configured).</li>
          <li>· A Filter Lab that performs real mute and skip on supported video.</li>
        </ul>

        <h2 className="mt-8 text-lg font-bold text-[#e8edf5]">Current boundary</h2>
        <p className="mt-2 rounded-2xl border border-[#26324c] bg-[#141d2e] p-4 text-[15px] leading-relaxed text-[#e8edf5]">
          WatchedNotWatched does not currently connect to or alter playback from subscription streaming services.
          Deeper provider integrations require authorized technical and commercial arrangements.
        </p>

        <p className="mt-8 text-sm text-[#94a3b8]">
          See the <Link href="/legal" className="text-[#22D3EE] hover:underline">Privacy, Terms &amp; Content/Availability disclaimer</Link>. Part of{" "}
          <a href="https://openmirrorllc.com" className="text-[#22D3EE] hover:underline">Open Mirror LLC</a>.
        </p>
      </div>
    </main>
  );
}
