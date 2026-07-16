import type { Metadata } from "next";
import { Suspense } from "react";
import LibraryClient from "./LibraryClient";

export const metadata: Metadata = { title: "My library" };

export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-4 text-2xl font-black text-[#e8edf5]">My library</h1>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-[#141d2e]" />}>
          <LibraryClient />
        </Suspense>
      </div>
    </main>
  );
}
