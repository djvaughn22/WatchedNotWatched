import Link from "next/link";
import SearchExperience from "./SearchExperience";
import ProfileChips from "./ProfileChips";

const STEPS = [
  { n: "1", title: "Search a title", desc: "Find any movie or show." },
  { n: "2", title: "Review the content", desc: "See guidance and how it fits your household." },
  { n: "3", title: "Choose where to watch", desc: "Jump to a legitimate provider." },
];

export function Homepage() {
  return (
    <main className="min-h-screen bg-[#0b1220] text-[#e8edf5]">
      {/* Hero */}
      <section className="px-4 pt-14 pb-10 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-black tracking-tight text-[#94a3b8]">
            WatchedNotWatched<span className="text-[#22D3EE]">.com</span>
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Watch with confidence.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[#94a3b8]">
            Know what is in a movie or show, choose what fits your household, and find where to watch.
          </p>
          <div className="mx-auto mt-8 max-w-xl text-left">
            <SearchExperience />
          </div>
          <div className="mt-5">
            <Link href="/filter-lab" className="text-sm font-semibold text-[#22D3EE] hover:underline">
              Try the Filter Lab →
            </Link>
          </div>
        </div>
      </section>

      {/* Who is watching */}
      <section className="border-y border-[#26324c] bg-[#0e1626] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#94a3b8]">Who is watching?</h2>
          <ProfileChips />
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-bold">How it works</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#22D3EE] text-lg font-black text-[#06131a]">
                  {s.n}
                </div>
                <h3 className="font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-[#94a3b8]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filter Lab preview */}
      <section className="px-4 pb-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/filter-lab"
            className="block rounded-2xl border border-[#26324c] bg-[#141d2e] p-6 transition-colors hover:border-[#22D3EE]"
          >
            <p className="text-sm font-black uppercase tracking-widest text-[#22D3EE]">See filtering in action</p>
            <h3 className="mt-2 text-xl font-bold">Filter Lab</h3>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#94a3b8]">
              Try a real demonstration of automatic mute and skip controls on supported video. Toggle categories, pick a preset, and watch the player respond.
            </p>
            <span className="mt-3 inline-block text-sm font-semibold text-[#22D3EE]">Open the Filter Lab →</span>
          </Link>
        </div>
      </section>

      {/* Trust boundary */}
      <section className="border-t border-[#26324c] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm leading-relaxed text-[#94a3b8]">
            WatchedNotWatched provides guidance, not guarantees. Availability and content details may change. Automatic filtering currently works only with supported or authorized video.{" "}
            <Link href="/about" className="text-[#22D3EE] hover:underline">How it works & limits</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
