import type { Metadata } from "next";
import ForYouClient from "./ForYouClient";

export const metadata: Metadata = {
  title: "For You — WatchedNotWatched",
  description: "Picks based on the titles you thumbed up. Your list stays on your device.",
};

export default function ForYouPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-black text-[#e8edf5]">For You</h1>
        <p className="mt-1 mb-4 text-sm text-[#94a3b8]">Picks based on what you liked.</p>
        <ForYouClient />
      </div>
    </main>
  );
}
