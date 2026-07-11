import type { Metadata } from "next";
import WatchClient from "./WatchClient";

export const metadata: Metadata = {
  title: "Watch with Filter — WatchedNotWatched",
  description:
    "Watch supported video with your family's filters applied. Automatic filtering runs only on verified versions of media WatchedNotWatched is allowed to play.",
};

export default async function WatchPage({
  params,
}: {
  params: Promise<{ mediaId: string }>;
}) {
  const { mediaId } = await params;
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <WatchClient mediaId={decodeURIComponent(mediaId)} />
    </main>
  );
}
