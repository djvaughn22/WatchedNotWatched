import type { Metadata } from "next";
import StudioClient from "./StudioClient";

export const metadata: Metadata = { title: "Filter Studio — WatchedNotWatched", robots: { index: false } };

// Gated: only available when explicitly enabled, or in local development.
// It is intentionally NOT in the public product navigation.
function studioEnabled() {
  return process.env.FEATURE_FILTER_STUDIO === "true" || process.env.NODE_ENV !== "production";
}

export default function StudioPage() {
  if (!studioEnabled()) {
    return (
      <main className="min-h-screen bg-[#0b1220]">
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-xl font-black text-[#e8edf5]">Filter Studio is not enabled</h1>
          <p className="mt-3 text-sm text-[#94a3b8]">
            This authoring tool is off in production. Set <code className="text-[#22D3EE]">FEATURE_FILTER_STUDIO=true</code> to enable it, or run it in local development. See <code>docs/filter-studio.md</code>.
          </p>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <StudioClient />
    </main>
  );
}
