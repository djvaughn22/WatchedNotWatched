import type { Metadata } from "next";
import SearchExperience from "../components/SearchExperience";

export const metadata: Metadata = {
  title: "Search — WatchedNotWatched",
  description: "Search a movie or show, mark it Watched or Want to Watch, and keep going.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="sr-only">Search</h1>
        <SearchExperience autoFocus initialQuery={q ?? ""} syncUrl />
      </div>
    </main>
  );
}
