'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TITLES, type Title, type FilterCategory, type FilterEvent } from '@/data/titles';

const ALL_CATEGORIES: FilterCategory[] = [
  'Profanity',
  'Sex / Nudity',
  'Gore & Violence',
  'Blasphemy',
  'Drugs & Alcohol',
  'Scary Scenes',
];

const DEFAULT_FILTERS: Record<FilterCategory, boolean> = {
  'Profanity': true,
  'Sex / Nudity': true,
  'Gore & Violence': false,
  'Blasphemy': true,
  'Drugs & Alcohol': false,
  'Scary Scenes': false,
};

const ACTION_STYLES: Record<string, { badge: string; border: string; bg: string; icon: string; verb: string }> = {
  mute: {
    badge: 'bg-violet-600',
    border: 'border-violet-500/50',
    bg: 'bg-violet-950/60',
    icon: '🔇',
    verb: 'MUTE',
  },
  skip: {
    badge: 'bg-rose-600',
    border: 'border-rose-500/50',
    bg: 'bg-rose-950/60',
    icon: '⏭',
    verb: 'SKIP',
  },
};

const CATEGORY_ICONS: Record<FilterCategory, string> = {
  'Profanity': '🤬',
  'Sex / Nudity': '🚫',
  'Gore & Violence': '💢',
  'Blasphemy': '⛪',
  'Drugs & Alcohol': '🍶',
  'Scary Scenes': '👻',
};

type AlertState = {
  id: number;
  event: FilterEvent;
  remaining: number; // seconds left
  dismissed: boolean;
};

type Step = 'select' | 'filters' | 'ready' | 'live';

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="relative shrink-0 w-12 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090f]"
      style={{ backgroundColor: on ? '#7c3aed' : '#334155' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: on ? 'translateX(24px)' : 'translateX(0)' }}
      />
      <span className="sr-only">{on ? 'On' : 'Off'}</span>
    </button>
  );
}

function CountdownRing({ total, remaining }: { total: number; remaining: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? remaining / total : 0;
  const dash = circ * pct;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#334155" strokeWidth="4" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dasharray 0.9s linear' }}
      />
      <text x="26" y="31" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
        {Math.ceil(remaining)}
      </text>
    </svg>
  );
}

function AlertBanner({ alert, onDismiss }: { alert: AlertState; onDismiss: () => void }) {
  const s = ACTION_STYLES[alert.event.action];
  const isSkip = alert.event.action === 'skip';
  return (
    <div
      className={`flex items-center gap-4 border rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-md ${s.border} ${s.bg} animate-in slide-in-from-top-2 duration-300`}
    >
      <span className={`text-white text-xs font-black px-3 py-1.5 rounded-full shrink-0 ${s.badge}`}>
        {s.icon} {s.verb}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight">{alert.event.label}</p>
        <p className="text-slate-400 text-xs mt-0.5">
          {isSkip
            ? `Skip forward ${alert.event.duration} sec on your streaming app`
            : `Mute your streaming app now`}
        </p>
      </div>
      {!isSkip && (
        <CountdownRing total={alert.event.duration} remaining={alert.remaining} />
      )}
      {isSkip && (
        <div className="text-slate-400 text-xs text-right shrink-0">
          <span className="text-white font-bold text-base">+{alert.event.duration}s</span>
          <br />forward
        </div>
      )}
      <button
        onClick={onDismiss}
        className="text-slate-500 hover:text-white transition-colors shrink-0 ml-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

function UpcomingRow({ event, elapsed }: { event: FilterEvent; elapsed: number }) {
  const s = ACTION_STYLES[event.action];
  const secsAway = event.at - elapsed;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className={`text-white text-xs font-black px-2.5 py-1 rounded-full shrink-0 ${s.badge}`}>
        {s.verb}
      </span>
      <span className="text-slate-300 text-sm flex-1 min-w-0 truncate">{event.label}</span>
      <span className="text-slate-500 text-xs shrink-0">{fmt(event.at)}</span>
      <span className="text-violet-400 text-xs font-semibold shrink-0 w-14 text-right">
        {secsAway > 0 ? `in ${fmt(secsAway)}` : 'now'}
      </span>
    </div>
  );
}

export function WatchCompanion() {
  const [step, setStep] = useState<Step>('select');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Title | null>(null);
  const [filters, setFilters] = useState<Record<FilterCategory, boolean>>(DEFAULT_FILTERS);

  // Timer state
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const startRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  // Alerts
  const [alerts, setAlerts] = useState<AlertState[]>([]);
  const firedRef = useRef<Set<number>>(new Set());
  const alertIdRef = useRef(0);

  const filteredResults = TITLES.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  const activeEvents: FilterEvent[] = selected
    ? selected.events.filter((e) => filters[e.category])
    : [];

  const upcoming = activeEvents
    .filter((e) => e.at > elapsed)
    .slice(0, 6);

  // Ticker
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const now = Date.now();
      const newElapsed = pausedAtRef.current + (now - startRef.current) / 1000;
      setElapsed(newElapsed);

      if (selected && newElapsed >= selected.runtime) {
        setRunning(false);
        setDone(true);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, selected]);

  // Alert ticker — count down remaining durations
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setAlerts((prev) =>
        prev
          .map((a) => ({ ...a, remaining: a.remaining - 0.5 }))
          .filter((a) => a.dismissed === false && (a.event.action === 'skip' || a.remaining > 0))
      );
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  // Fire events at the right timestamps
  useEffect(() => {
    activeEvents.forEach((event) => {
      const key = event.at;
      if (firedRef.current.has(key)) return;
      if (elapsed >= event.at && elapsed < event.at + 1.5) {
        firedRef.current.add(key);
        const id = alertIdRef.current++;
        const newAlert: AlertState = {
          id,
          event,
          remaining: event.duration,
          dismissed: false,
        };
        setAlerts((prev) => [newAlert, ...prev].slice(0, 5));
        // Auto-dismiss skips after 8s, mutes after duration
        const autoDismissMs = event.action === 'skip' ? 8000 : (event.duration + 1) * 1000;
        setTimeout(() => {
          setAlerts((prev) => prev.filter((a) => a.id !== id));
        }, autoDismissMs);
      }
    });
  }, [elapsed, activeEvents]);

  const handleStart = useCallback(() => {
    if (!selected) return;
    firedRef.current.clear();
    setAlerts([]);
    setElapsed(0);
    setDone(false);
    pausedAtRef.current = 0;
    startRef.current = Date.now();
    setRunning(true);
    setStep('live');
  }, [selected]);

  const handlePause = useCallback(() => {
    if (!running) {
      startRef.current = Date.now();
      setRunning(true);
    } else {
      pausedAtRef.current = elapsed;
      setRunning(false);
    }
  }, [running, elapsed]);

  const handleReset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setDone(false);
    firedRef.current.clear();
    setAlerts([]);
    pausedAtRef.current = 0;
    setStep('ready');
  }, []);

  const dismissAlert = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const activeCount = ALL_CATEGORIES.filter((k) => filters[k]).length;

  return (
    <div className="bg-[#07090f] text-white min-h-screen font-[var(--font-geist-sans)]">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#07090f]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-16">
          <a href="/" className="font-black text-lg tracking-tight hover:text-violet-400 transition-colors">
            WatchedNotWatched
          </a>
          {step !== 'select' && (
            <button
              onClick={() => { setStep('select'); setSelected(null); setRunning(false); setAlerts([]); }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              ← Choose title
            </button>
          )}
        </div>
      </nav>

      {/* ALERTS — fixed overlay at top */}
      {step === 'live' && alerts.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-40 flex flex-col gap-2">
          {alerts.map((a) => (
            <AlertBanner key={a.id} alert={a} onDismiss={() => dismissAlert(a.id)} />
          ))}
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 pt-28 pb-20">

        {/* ── STEP 1: TITLE SELECT ── */}
        {step === 'select' && (
          <div>
            <div className="mb-10 text-center">
              <div className="inline-block bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
                Watch Companion · Prototype
              </div>
              <h1 className="text-4xl font-black mb-3">What are you watching?</h1>
              <p className="text-slate-400 text-lg">
                Pick a title. Set your filters. Open it on your streaming service. We&apos;ll guide you through.
              </p>
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles..."
              className="w-full bg-white/5 border border-white/15 text-white placeholder-slate-600 px-5 py-4 rounded-2xl outline-none focus:border-violet-500/60 text-base transition-colors mb-4"
              autoFocus
            />

            <div className="flex flex-col gap-3">
              {filteredResults.map((title) => (
                <button
                  key={title.id}
                  onClick={() => { setSelected(title); setStep('filters'); }}
                  className="flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/40 rounded-2xl px-6 py-5 text-left transition-all group"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-base group-hover:text-violet-300 transition-colors">{title.name}</p>
                    <p className="text-slate-500 text-sm mt-0.5">{title.year} · {title.type} · {title.platform}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-slate-500 text-xs">{title.events.length} filter events</span>
                    <span className="text-slate-500 group-hover:text-violet-400 transition-colors text-lg">→</span>
                  </div>
                </button>
              ))}
              {filteredResults.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                  No titles match &ldquo;{query}&rdquo; yet.<br />
                  <span className="text-sm mt-1 block">More titles coming as users contribute.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: FILTERS ── */}
        {step === 'filters' && selected && (
          <div>
            <div className="mb-8">
              <p className="text-slate-500 text-sm mb-1">Watching</p>
              <h1 className="text-2xl font-black mb-1">{selected.name}</h1>
              <p className="text-slate-500 text-sm">{selected.platform} · {fmt(selected.runtime)}</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-5">
              <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-white/10">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-500 text-sm ml-2">Filter Settings</span>
              </div>
              <div className="space-y-5">
                {ALL_CATEGORIES.map((cat) => {
                  const countForCat = selected.events.filter((e) => e.category === cat).length;
                  return (
                    <div key={cat} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
                        <div>
                          <span className={`text-base font-medium transition-colors duration-200 ${filters[cat] ? 'text-slate-200' : 'text-slate-500'}`}>
                            {cat}
                          </span>
                          {countForCat > 0 && (
                            <span className="ml-2 text-xs text-slate-600">
                              {countForCat} event{countForCat !== 1 ? 's' : ''} in this title
                            </span>
                          )}
                        </div>
                      </div>
                      <Toggle
                        on={filters[cat]}
                        onToggle={() => setFilters((p) => ({ ...p, [cat]: !p[cat] }))}
                        label={`Toggle ${cat} filter`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  <span className="text-white font-semibold">{activeEvents.length}</span> filter events will be active
                </p>
                <p className="text-xs text-slate-600 mt-0.5">{activeCount} filter categor{activeCount !== 1 ? 'ies' : 'y'} on</p>
              </div>
              <span className={`text-xs font-black px-3 py-1.5 rounded-full text-white ${activeEvents.length > 0 ? 'bg-violet-600' : 'bg-slate-700'}`}>
                {activeEvents.length > 0 ? 'FILTERS READY' : 'ALL ALLOWED'}
              </span>
            </div>

            <button
              onClick={() => setStep('ready')}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-lg px-8 py-4 rounded-full transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 3: READY TO SYNC ── */}
        {step === 'ready' && selected && (
          <div className="text-center">
            <div className="mb-10">
              <p className="text-slate-500 text-sm mb-1">Ready to watch</p>
              <h1 className="text-3xl font-black mb-2">{selected.name}</h1>
              <p className="text-slate-500 text-sm">{selected.platform} · {activeEvents.length} filter events active</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8 text-left">
              <h2 className="text-lg font-bold mb-6 text-center">Follow these steps:</h2>
              <ol className="space-y-5">
                {[
                  { n: '1', text: `Open ${selected.platform} on your device and find "${selected.name}"` },
                  { n: '2', text: 'Position it side-by-side with this window, or keep this tab visible on a second screen' },
                  { n: '3', text: 'When you\'re ready to press Play on your streaming app, tap the button below at the exact same moment' },
                ].map((item) => (
                  <li key={item.n} className="flex gap-4 items-start">
                    <span className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                      {item.n}
                    </span>
                    <p className="text-slate-300 leading-relaxed pt-1">{item.text}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Preview upcoming events */}
            {activeEvents.length > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-8 text-left">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">First few events</p>
                {activeEvents.slice(0, 4).map((e, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <span className={`text-white text-xs font-black px-2.5 py-1 rounded-full shrink-0 ${ACTION_STYLES[e.action].badge}`}>
                      {ACTION_STYLES[e.action].verb}
                    </span>
                    <span className="text-slate-400 text-sm flex-1">{e.label}</span>
                    <span className="text-slate-600 text-xs">{fmt(e.at)}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleStart}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-black text-xl px-8 py-5 rounded-full transition-colors shadow-lg shadow-violet-900/40"
            >
              Press Play & Start Together
            </button>
            <p className="text-slate-600 text-xs mt-4">
              Tap this the same moment you press play on your streaming app
            </p>
          </div>
        )}

        {/* ── STEP 4: LIVE ── */}
        {step === 'live' && selected && (
          <div>
            {/* Timer header */}
            <div className="text-center mb-8">
              <p className="text-slate-500 text-sm mb-1">{selected.name}</p>
              <div className="text-7xl font-black tabular-nums tracking-tight mb-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmt(elapsed)}
              </div>
              <p className="text-slate-600 text-sm">of {fmt(selected.runtime)}</p>

              {/* Progress bar */}
              <div className="w-full bg-white/5 rounded-full h-1.5 mt-4 overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (elapsed / selected.runtime) * 100)}%` }}
                />
              </div>
            </div>

            {done && (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6 mb-6 text-center">
                <p className="text-emerald-400 font-bold text-lg">Title complete!</p>
                <p className="text-slate-400 text-sm mt-1">All {activeEvents.length} filter events handled.</p>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3 mb-8">
              <button
                onClick={handlePause}
                className={`flex-1 font-bold py-4 rounded-full transition-colors text-base ${
                  running
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
              >
                {running ? '⏸ I Paused My Stream' : '▶ Resume'}
              </button>
              <button
                onClick={handleReset}
                className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-semibold py-4 px-6 rounded-full transition-colors"
              >
                Restart
              </button>
            </div>

            {/* Upcoming events */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Upcoming · {upcoming.length} event{upcoming.length !== 1 ? 's' : ''}
              </p>
              {upcoming.length === 0 ? (
                <p className="text-slate-600 text-sm py-2">No more events for active filters.</p>
              ) : (
                upcoming.map((e, i) => (
                  <UpcomingRow key={i} event={e} elapsed={elapsed} />
                ))
              )}
            </div>

            {/* Filter toggles mid-watch */}
            <div className="mt-5 bg-white/[0.02] border border-white/10 rounded-2xl p-5">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4">
                Live filter controls
              </p>
              <div className="space-y-4">
                {ALL_CATEGORIES.map((cat) => {
                  const ahead = selected.events.filter(
                    (e) => e.category === cat && e.at > elapsed
                  ).length;
                  return (
                    <div key={cat} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{CATEGORY_ICONS[cat]}</span>
                        <span className={`text-sm font-medium ${filters[cat] ? 'text-slate-200' : 'text-slate-600'}`}>
                          {cat}
                        </span>
                        {ahead > 0 && filters[cat] && (
                          <span className="text-xs text-slate-600">{ahead} ahead</span>
                        )}
                      </div>
                      <Toggle
                        on={filters[cat]}
                        onToggle={() => setFilters((p) => ({ ...p, [cat]: !p[cat] }))}
                        label={`Toggle ${cat}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
