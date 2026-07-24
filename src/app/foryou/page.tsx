import type { Metadata } from "next";
import ForYouClient from "./ForYouClient";

export const metadata: Metadata = {
  title: "For You",
  description: "Recommendations based on what you watched, skipped, saved, and enjoyed. Your list stays on your device.",
};

export default function ForYouPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-black text-[#e8edf5]">What should I watch next?</h1>
        <p className="mt-1 mb-5 text-sm text-[#94a3b8]">
          Recommendations based on what you watched, skipped, saved, and enjoyed.
        </p>
        <ForYouClient />
      </div>
    </main>
  );
}
