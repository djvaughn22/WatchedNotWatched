import type { Metadata } from "next";
import ProfilesClient from "./ProfilesClient";

export const metadata: Metadata = { title: "Profiles — WatchedNotWatched" };

export default function ProfilesPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-4 text-2xl font-black text-[#e8edf5]">Family viewing profiles</h1>
        <ProfilesClient />
      </div>
    </main>
  );
}
