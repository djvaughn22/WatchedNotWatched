import type { Metadata } from "next";

export const metadata: Metadata = { title: "Legal" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-[#e8edf5]">{title}</h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-[#94a3b8]">{children}</div>
    </section>
  );
}

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-[#0b1220]">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-black text-[#e8edf5]">Privacy, Terms &amp; Disclaimer</h1>
        <p className="mt-2 text-sm text-[#94a3b8]">
          These are initial product documents for an in-development app — not a substitute for legal review.
        </p>

        <Section title="Content &amp; Availability Disclaimer">
          <p>Title information, posters, and trailers come from third-party sources and may be incomplete or out of date. Where-to-watch availability changes often and varies by region; a subscription or purchase may be required.</p>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          <p>Third-party trademarks and titles belong to their owners. WatchedNotWatched is not endorsed by or affiliated with any streaming provider. External links open the provider’s own site or app and leave WatchedNotWatched.</p>
        </Section>

        <Section title="Privacy">
          <p>Your library, recent searches, and settings are stored locally on your device. There is no account, and we do not collect streaming-service credentials.</p>
          <p>Searches you run are sent to our server to query a metadata provider; we do not tie them to a personal profile. You can clear recent searches and remove titles at any time. Export your library whenever you want a backup.</p>
        </Section>

        <Section title="Terms">
          <p>WatchedNotWatched is provided “as is” during development. You are responsible for using your own legal access to any streaming service.</p>
        </Section>
      </div>
    </main>
  );
}
