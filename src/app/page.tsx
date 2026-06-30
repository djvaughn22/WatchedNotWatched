import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WatchedNotWatched — Watch the story. Skip the trash.",
  description:
    "A clean-viewing layer for shows and movies you already have access to.",
};

const FILTERS = [
  { label: "Profanity", checked: true },
  { label: "Sex / Nudity", checked: true },
  { label: "Gore & Violence", checked: false },
  { label: "Blasphemy", checked: true },
  { label: "Drugs & Alcohol", checked: false },
  { label: "Scary Scenes", checked: false },
];

const TIMELINE = [
  {
    action: "MUTE",
    color: "bg-violet-600",
    trigger: "Profanity detected",
    result: "Audio muted for the word",
  },
  {
    action: "SKIP",
    color: "bg-rose-600",
    trigger: "Sex / nudity cue",
    result: "Scene skipped entirely",
  },
  {
    action: "COVER",
    color: "bg-amber-600",
    trigger: "Gore moment",
    result: "Screen covered, audio continues",
  },
  {
    action: "PAUSE",
    color: "bg-blue-600",
    trigger: "Mature decision scene",
    result: "Playback paused for your choice",
  },
];

const USE_CASES = [
  {
    icon: "🏠",
    title: "Parents",
    desc: "Let your kids watch popular shows without worrying about what comes next. You set the filters. The content follows your rules.",
  },
  {
    icon: "⛪",
    title: "Pastors & Churches",
    desc: "Show clips in sermons or youth groups without the awkward moments. Ministry-safe by default.",
  },
  {
    icon: "🎬",
    title: "Anyone Who Wants Clean",
    desc: "You don't have to explain why. You just want to watch without the trash. That's enough.",
  },
];

const TRUST_ITEMS = [
  {
    title: "Legal access required",
    desc: "You watch on your own legal subscription. We don't touch the source.",
  },
  {
    title: "Viewer controlled",
    desc: "Every filter is your choice. Nothing happens without your settings.",
  },
  {
    title: "No hosting",
    desc: "We don't store, stream, or redistribute any video content.",
  },
  {
    title: "No edited copies",
    desc: "We never create or distribute a modified version of any film.",
  },
  {
    title: "No redistributed video",
    desc: "Your stream stays between you and your service provider.",
  },
  {
    title: "No DRM bypass",
    desc: "We work with your playback — never around it.",
  },
];

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="bg-[#07090f] text-white min-h-screen font-[var(--font-geist-sans)]">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#07090f]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <span className="font-black text-lg tracking-tight">
            WatchedNotWatched
          </span>
          <a
            href="#early-access"
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors"
          >
            Join Early Access
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-36 pb-28 px-4 sm:px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-block bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-8">
            Early Access · MVP
          </div>
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Watch the story.
            <br />
            <span className="text-violet-400">Skip the trash.</span>
          </h1>
          <p className="text-xl sm:text-2xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            A clean-viewing layer for shows and movies you already have access
            to.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#early-access"
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-lg px-8 py-4 rounded-full transition-colors"
            >
              Join Early Access
            </a>
            <a
              href="#pricing"
              className="border border-white/20 hover:border-white/40 text-white font-semibold text-lg px-8 py-4 rounded-full transition-colors"
            >
              Become a Founding Member
            </a>
          </div>
        </div>
      </section>

      {/* USE CASE CARDS */}
      <section className="py-20 px-4 sm:px-6 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-14">
            Built for people who already know why.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {USE_CASES.map((u) => (
              <div
                key={u.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-8"
              >
                <div className="text-4xl mb-4">{u.icon}</div>
                <h3 className="text-xl font-bold mb-3">{u.title}</h3>
                <p className="text-slate-400 leading-relaxed">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FILTER SETTINGS DEMO */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Your filters. Your rules.
            </h2>
            <p className="text-slate-400 text-lg">
              Toggle exactly what you want to skip. Nothing more, nothing less.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-2.5 mb-6 pb-6 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-500 text-sm ml-2">
                Filter Settings · My Profile
              </span>
            </div>
            <div className="space-y-5">
              {FILTERS.map((f) => (
                <label
                  key={f.label}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="text-base font-medium text-slate-200">
                    {f.label}
                  </span>
                  <div className="relative shrink-0">
                    <input
                      type="checkbox"
                      defaultChecked={f.checked}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 rounded-full bg-slate-700 peer-checked:bg-violet-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-6" />
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AUTOMATIC FILTER TIMELINE */}
      <section className="py-20 px-4 sm:px-6 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Automatic. In the moment.
            </h2>
            <p className="text-slate-400 text-lg">
              No pause. No rewind. No scramble for the remote.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TIMELINE.map((t) => (
              <div
                key={t.action}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 flex gap-4 items-start"
              >
                <span
                  className={`${t.color} text-white text-xs font-black px-3 py-1.5 rounded-full shrink-0 mt-0.5`}
                >
                  {t.action}
                </span>
                <div>
                  <p className="text-slate-400 text-sm mb-1">{t.trigger}</p>
                  <p className="text-white font-semibold">{t.result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-14">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
            {[
              {
                step: "1",
                title: "AI Content Map",
                desc: "Every show and movie is analyzed down to the second — profanity, nudity, gore, blasphemy, and more — mapped with precision.",
              },
              {
                step: "2",
                title: "Your Settings",
                desc: "Set personal, family, or church profiles. Choose what to mute, skip, cover, or flag at whatever sensitivity level fits you.",
              },
              {
                step: "3",
                title: "Timed Actions",
                desc: "Mute fires at the right millisecond. Skip jumps the scene. Cover blacks the screen. Pause waits for you. Every time.",
              },
            ].map((item) => (
              <div key={item.step}>
                <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-black text-xl mx-auto mb-5">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section
        id="pricing"
        className="py-20 px-4 sm:px-6 border-y border-white/5 bg-white/[0.02]"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple pricing.
          </h2>
          <p className="text-slate-400 text-lg mb-14">
            Founding member rates locked in for life.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-left">
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest mb-4">
                Monthly
              </p>
              <p className="text-5xl font-black mb-1">
                $9
                <span className="text-2xl font-semibold text-slate-400">
                  .99
                </span>
              </p>
              <p className="text-slate-500 text-sm mb-8">per month</p>
              <a
                href="#early-access"
                className="block text-center bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-full transition-colors"
              >
                Join Monthly
              </a>
            </div>
            <div className="relative bg-violet-600/20 border border-violet-500/40 rounded-2xl p-8 text-left overflow-hidden">
              <span className="absolute top-4 right-4 bg-violet-500 text-white text-xs font-black px-3 py-1 rounded-full">
                BEST VALUE
              </span>
              <p className="text-violet-300 text-sm font-semibold uppercase tracking-widest mb-4">
                Annual
              </p>
              <p className="text-5xl font-black mb-1">
                $99
                <span className="text-2xl font-semibold text-slate-400">
                  /yr
                </span>
              </p>
              <p className="text-slate-500 text-sm mb-8">
                ≈ $8.25/month · save $20
              </p>
              <a
                href="#early-access"
                className="block text-center bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-full transition-colors"
              >
                Become a Founding Member
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST NOTE */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
            Built on legal ground.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TRUST_ITEMS.map((item) => (
              <div
                key={item.title}
                className="flex gap-4 items-start bg-white/[0.03] border border-white/10 rounded-xl p-5"
              >
                <span className="text-emerald-400 mt-0.5 shrink-0">
                  <CheckIcon />
                </span>
                <div>
                  <p className="font-semibold text-white mb-1">{item.title}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EARLY ACCESS FORM */}
      <section
        id="early-access"
        className="py-28 px-4 sm:px-6 bg-gradient-to-b from-violet-950/30 to-[#07090f] border-t border-white/5"
      >
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black mb-4">
            Get in early.
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Leave your email and we&apos;ll reach out when WatchedNotWatched is
            ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 bg-white/10 border border-white/20 text-white placeholder-slate-500 px-5 py-4 rounded-full outline-none text-base"
            />
            <button
              type="button"
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-4 rounded-full transition-colors whitespace-nowrap"
            >
              Notify Me
            </button>
          </div>
          <p className="text-slate-600 text-sm mt-4">
            No spam. Form is a visual placeholder — no backend yet.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-4 sm:px-6 border-t border-white/5 text-center">
        <p className="font-black text-slate-300 mb-1">WatchedNotWatched</p>
        <p className="text-slate-500 text-sm">Watch the story. Skip the trash.</p>
        <p className="text-slate-700 text-xs mt-4">
          &copy; 2026 WatchedNotWatched. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
