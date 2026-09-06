import type { Metadata } from "next";
import SearchExperience from "../components/SearchExperience";

export const metadata: Metadata = {
  title: "Search",
  description: "Search movies, shows, and books. Mark them Watched, Read, or save them for later.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const { q, kind } = await searchParams;
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="sr-only">Search</h1>
        <SearchExperience autoFocus initialQuery={q ?? ""} initialKind={kind === "book" ? "book" : "watch"} syncUrl />
      </div>
    </main>
  );
}
