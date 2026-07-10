import type { Metadata } from "next";
import FilterLabClient from "./FilterLabClient";

export const metadata: Metadata = {
  title: "Filter Lab — WatchedNotWatched",
  description:
    "A working demonstration of automatic mute and skip controls on supported video. Toggle filters and watch the player respond.",
};

export default function FilterLabPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <FilterLabClient />
    </main>
  );
}
