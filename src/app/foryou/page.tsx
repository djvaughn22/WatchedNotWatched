import type { Metadata } from "next";
import ForYouPageClient from "./ForYouPageClient";

export const metadata: Metadata = {
  title: "For You",
  description: "Recommendations based on what you watched or read, skipped, saved, and enjoyed.",
};

export default function ForYouPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ForYouPageClient />
      </div>
    </main>
  );
}
