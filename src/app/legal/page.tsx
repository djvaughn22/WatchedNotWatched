import type { Metadata } from "next";

export const metadata: Metadata = { title: "Legal — WatchedNotWatched" };

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
          <p>Content guidance can be incomplete and is informational only. It is not a rating, endorsement, or guarantee. “Not yet reviewed” is never the same as “nothing of concern.”</p>
          <p>Where-to-watch availability changes often and varies by region; a subscription may be required. Third-party trademarks and titles belong to their owners. WatchedNotWatched is not endorsed by or affiliated with the streaming providers listed.</p>
          <p>External links open the provider’s own site or app and leave WatchedNotWatched. Automatic filtering currently applies only to supported or authorized video (see the Filter Lab); it does not apply to subscription streaming playback.</p>
        </Section>

        <Section title="Privacy">
          <p>Profiles, saved titles, recent searches, and Filter Lab sessions are stored locally on your device by default. We do not ask for streaming passwords, children’s personal information, or precise identity-linked viewing histories.</p>
          <p>Searches you run are sent to our server to query a metadata provider; we do not tie them to a personal profile. You can clear recent searches and reset local data at any time.</p>
        </Section>

        <Section title="Terms">
          <p>WatchedNotWatched is provided “as is” during development. You are responsible for using your own legal access to any streaming service. Do not rely on guidance as a guarantee of suitability.</p>
          <p>Broader commercialization (paid subscriptions, deeper provider integrations, an editorial catalog) requires legal review and appropriate licensing, which is not yet in place.</p>
        </Section>
      </div>
    </main>
  );
}
