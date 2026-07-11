import type { Metadata } from "next";
import TitleDetailClient from "./TitleDetailClient";

export const metadata: Metadata = {
  title: "Title details — WatchedNotWatched",
};

export default async function TitlePage({
  params,
  searchParams,
}: {
  params: Promise<{ source: string; id: string }>;
  searchParams: Promise<{ mediaType?: string }>;
}) {
  const { source, id } = await params;
  const { mediaType } = await searchParams;
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <TitleDetailClient source={source} id={id} mediaType={mediaType || "movie"} />
    </main>
  );
}
