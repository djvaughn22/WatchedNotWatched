import type { Metadata } from "next";
import SavedClient from "./SavedClient";

export const metadata: Metadata = { title: "Saved — WatchedNotWatched" };

export default function SavedPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-4 text-2xl font-black text-[#e8edf5]">Saved titles</h1>
        <SavedClient />
      </div>
    </main>
  );
}
