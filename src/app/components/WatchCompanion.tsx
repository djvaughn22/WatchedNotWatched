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
    bg: 'bg-violet-950/80',
    icon: '🔇',
    verb: 'MUTE',
  },
  skip: {
    badge: 'bg-rose-600',
    border: 'border-rose-500/50',
    bg: 'bg-rose-950/80',
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
  remaining: number;
  dismissed: boolean;
};

type Step = 'select' | 'filters' | 'ready' | 'live';

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.1;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="relative shrink-0 w-14 h-7 rounded-full transition-colors focus:outline-none"
      style={{ backgroundColor: on ? '#7c3aed' : '#334155' }}
    >
      <span
        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: on ? 'translateX(28px)' : 'translateX(0)' }}
      />
      <span className="sr-only">{on ? 'On' : 'Off'}</span>
    </button>
  );
}

function CountdownRing({ total, remaining }: { total: number; remaining: number }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? remaining / total : 0;
  const dash = circ * pct;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="shrink-0">
      <circle cx="30" cy="30" r={r} fill="none" stroke="#334155" strokeWidth="5" />
      <circle
        cx="30" cy="30" r={r}
        fill="none" stroke="white" strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 30 30)"
        style={{ transition: 'stroke-dasharray 0.9s linear' }}
      />
      <text x="30" y="36" textAnchor="middle" fill="white" fontSize="15" fontWeight="bold">
        {Math.ceil(remaining)}
      </text>
    </svg>
  );
}

function AlertBanner({ alert, onDismiss }: { alert: AlertState; onDismiss: () => void }) {
  const s = ACTION_STYLES[alert.event.action];
  const isSkip = alert.event.action === 'skip';
  return (
    <div className={`flex items-center gap-4 border-2 rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-md ${s.border} ${s.bg}`}>
      <span className={`text-white text-sm font-black px-4 py-2 rounded-full shrink-0 ${s.badge}`}>
        {s.icon} {s.verb}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-base leading-tight">{alert.event.label}</p>
        <p className="text-slate-300 text-sm mt-0.5">
          {isSkip
            ? `Press skip forward ${alert.event.duration}s on your remote`
            : 'Press mute on your remote now'}
        </p>
      </div>
      {!isSkip ? (
        <CountdownRing total={alert.event.duration} remaining={alert.remaining} />
      ) : (
        <div className="text-right shrink-0">
          <span className="text-white font-black text-2xl">+{alert.event.duration}s</span>
          <p className="text-slate-400 text-xs">forward</p>
        </div>
      )}
      <button onClick={onDismiss} className="text-slate-400 hover:text-white text-xl shrink-0 ml-1 p-1" aria-label="Dismiss">✕</button>
    </div>
  );
}

function UpcomingRow({ event, elapsed }: { event: FilterEvent; elapsed: number }) {
  const s = ACTION_STYLES[event.action];
  const secsAway = event.at - elapsed;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <span className={`text-white text-xs font-black px-3 py-1.5 rounded-full shrink-0 ${s.badge}`}>
        {s.icon} {s.verb}
      </span>
      <span className="text-slate-300 text-sm flex-1 min-w-0 truncate">{event.label}</span>
      <span className="text-violet-400 text-sm font-semibold shrink-0">
        {secsAway > 60 ? `in ${fmt(secsAway)}` : secsAway > 0 ? `${Math.ceil(secsAway)}s` : 'now'}
      </span>
    </div>
  );
}

export function WatchCompanion() {
  const [step, setStep] = useState<Step>('select');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Title | null>(null);
  const [filters, setFilters] = useState<Record<FilterCategory, boolean>>(DEFAULT_FILTERS);
  const [voiceOn, setVoiceOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const startRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const [alerts, setAlerts] = useState<AlertState[]>([]);
  const firedRef = useRef<Set<number>>(new Set());
  const alertIdRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const filteredResults = TITLES.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  const activeEvents: FilterEvent[] = selected
    ? selected.events.filter((e) => filters[e.category])
    : [];

  const upcoming = activeEvents.filter((e) => e.at > elapsed).slice(0, 5);

  // Wake lock — keep screen on while watching
  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      }
    } catch {
      // wake lock not supported or denied — non-fatal
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  // Re-acquire wake lock if tab becomes visible again (iOS releases it on hide)
  useEffect(() => {
    const onVisible = () => { if (running) acquireWakeLock(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [running, acquireWakeLock]);

  // Ticker
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const newElapsed = pausedAtRef.current + (Date.now() - startRef.current) / 1000;
      setElapsed(newElapsed);
      if (selected && newElapsed >= selected.runtime) {
        setRunning(false);
        setDone(true);
        releaseWakeLock();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, selected, releaseWakeLock]);

  // Alert countdown
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setAlerts((prev) =>
        prev
          .map((a) => ({ ...a, remaining: a.remaining - 0.5 }))
          .filter((a) => !a.dismissed && (a.event.action === 'skip' || a.remaining > 0))
      );
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  // Fire events
  useEffect(() => {
    activeEvents.forEach((event) => {
      if (firedRef.current.has(event.at)) return;
      if (elapsed >= event.at && elapsed < event.at + 1.5) {
        firedRef.current.add(event.at);
        const id = alertIdRef.current++;
        setAlerts((prev) => [{ id, event, remaining: event.duration, dismissed: false }, ...prev].slice(0, 4));

        // Voice
        if (voiceOn) {
          if (event.action === 'mute') {
            speak(`Mute now. ${event.label}. ${event.duration} seconds.`);
          } else {
            speak(`Skip forward ${event.duration} seconds. ${event.label}.`);
          }
        }

        // Vibration — long pulse for skip, short double for mute
        if (event.action === 'skip') {
          vibrate([400, 100, 400]);
        } else {
          vibrate([150, 80, 150]);
        }

        const autoDismissMs = event.action === 'skip' ? 9000 : (event.duration + 1.5) * 1000;
        setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== id)), autoDismissMs);
      }
    });
  }, [elapsed, activeEvents, voiceOn]);

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
    acquireWakeLock();
  }, [selected, acquireWakeLock]);

  const handlePause = useCallback(() => {
    if (!running) {
      startRef.current = Date.now();
      setRunning(true);
      acquireWakeLock();
    } else {
      pausedAtRef.current = elapsed;
      setRunning(false);
      releaseWakeLock();
    }
  }, [running, elapsed, acquireWakeLock, releaseWakeLock]);

  const handleReset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setDone(false);
    firedRef.current.clear();
    setAlerts([]);
    pausedAtRef.current = 0;
    releaseWakeLock();
    setStep('ready');
  }, [releaseWakeLock]);

  const dismissAlert = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const activeCount = ALL_CATEGORIES.filter((k) => filters[k]).length;

  return (
    <div className="bg-[#07090f] text-white min-h-screen font-[var(--font-geist-sans)]">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#07090f]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">
          <a href="/" className="font-black text-base tracking-tight">WatchedNotWatched</a>
          <div className="flex items-center gap-3">
            {step === 'live' && (
              <button
                onClick={() => setVoiceOn((v) => !v)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${voiceOn ? 'border-violet-500/50 text-violet-300 bg-violet-900/30' : 'border-white/10 text-slate-500'}`}
                title={voiceOn ? 'Voice on' : 'Voice off'}
              >
                {voiceOn ? '🔊 Voice' : '🔇 Muted'}
              </button>
            )}
            {step !== 'select' && (
              <button
                onClick={() => { setStep('select'); setSelected(null); setRunning(false); setAlerts([]); releaseWakeLock(); }}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                ← Titles
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ALERT OVERLAY */}
      {step === 'live' && alerts.length > 0 && (
        <div className="fixed top-16 left-0 right-0 z-40 px-4 pt-2 flex flex-col gap-2 max-w-2xl mx-auto">
          {alerts.map((a) => (
            <AlertBanner key={a.id} alert={a} onDismiss={() => dismissAlert(a.id)} />
          ))}
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-32">

        {/* ── SELECT ── */}
        {step === 'select' && (
          <div>
            <div className="mb-8 text-center">
              <div className="inline-block bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
                Watch Companion
              </div>
              <h1 className="text-3xl font-black mb-2">What are you watching?</h1>
              <p className="text-slate-400">Open this on your phone. Press play on your TV. We&apos;ll alert you to mute or skip.</p>
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles..."
              className="w-full bg-white/5 border border-white/15 text-white placeholder-slate-600 px-5 py-4 rounded-2xl outline-none focus:border-violet-500/60 text-base transition-colors mb-4"
            />

            <div className="flex flex-col gap-3">
              {filteredResults.map((title) => (
                <button
                  key={title.id}
                  onClick={() => { setSelected(title); setStep('filters'); }}
                  className="flex items-center justify-between bg-white/5 active:bg-white/10 border border-white/10 rounded-2xl px-5 py-5 text-left transition-all"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-base">{title.name}</p>
                    <p className="text-slate-500 text-sm mt-0.5">{title.platform} · {title.events.length} filter events</p>
                  </div>
                  <span className="text-slate-500 text-xl ml-4 shrink-0">›</span>
                </button>
              ))}
              {filteredResults.length === 0 && (
                <p className="text-center text-slate-600 py-10">No titles match &ldquo;{query}&rdquo; yet.</p>
              )}
            </div>
          </div>
        )}

        {/* ── FILTERS ── */}
        {step === 'filters' && selected && (
          <div>
            <div className="mb-6">
              <p className="text-slate-500 text-sm">Watching</p>
              <h1 className="text-2xl font-black mt-0.5">{selected.name}</h1>
              <p className="text-slate-500 text-sm">{selected.platform} · {fmt(selected.runtime)}</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-5">Filter settings</p>
              <div className="space-y-5">
                {ALL_CATEGORIES.map((cat) => {
                  const count = selected.events.filter((e) => e.category === cat).length;
                  return (
                    <div key={cat} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{CATEGORY_ICONS[cat]}</span>
                        <div className="min-w-0">
                          <p className={`text-base font-medium leading-tight ${filters[cat] ? 'text-white' : 'text-slate-500'}`}>{cat}</p>
                          {count > 0 && (
                            <p className="text-xs text-slate-600">{count} event{count !== 1 ? 's' : ''} in this title</p>
                          )}
                        </div>
                      </div>
                      <Toggle on={filters[cat]} onToggle={() => setFilters((p) => ({ ...p, [cat]: !p[cat] }))} label={`Toggle ${cat}`} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 mb-5">
              <p className="text-slate-400 text-sm">
                <span className="text-white font-bold">{activeEvents.length}</span> events · <span className="text-white font-bold">{activeCount}</span> filters on
              </p>
              <span className={`text-xs font-black px-3 py-1.5 rounded-full text-white ${activeEvents.length > 0 ? 'bg-violet-600' : 'bg-slate-700'}`}>
                {activeEvents.length > 0 ? 'READY' : 'ALL CLEAR'}
              </span>
            </div>

            <button onClick={() => setStep('ready')} className="w-full bg-violet-600 active:bg-violet-700 text-white font-bold text-lg px-8 py-5 rounded-full transition-colors">
              Continue →
            </button>
          </div>
        )}

        {/* ── READY ── */}
        {step === 'ready' && selected && (
          <div className="text-center">
            <div className="mb-8">
              <p className="text-slate-500 text-sm">Ready to watch</p>
              <h1 className="text-2xl font-black mt-0.5 mb-1">{selected.name}</h1>
              <p className="text-slate-500 text-sm">{selected.platform} · {activeEvents.length} filter events</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 text-left">
              <ol className="space-y-5">
                {[
                  `Open ${selected.platform} on your TV or device`,
                  `Find "${selected.name}" and get it ready to play`,
                  'Turn up your phone volume — it will speak alerts',
                  'Tap the button below the exact moment you press Play',
                ].map((text, i) => (
                  <li key={i} className="flex gap-4 items-start">
                    <span className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 font-black text-sm flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-slate-300 leading-relaxed pt-1">{text}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Voice toggle on ready screen */}
            <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔊</span>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm">Voice alerts</p>
                  <p className="text-slate-500 text-xs">Phone speaks &quot;Mute now&quot; or &quot;Skip forward&quot;</p>
                </div>
              </div>
              <Toggle on={voiceOn} onToggle={() => setVoiceOn((v) => !v)} label="Toggle voice alerts" />
            </div>

            {activeEvents.length > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-6 text-left">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">First events</p>
                {activeEvents.slice(0, 3).map((e, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                    <span className={`text-white text-xs font-black px-2.5 py-1 rounded-full shrink-0 ${ACTION_STYLES[e.action].badge}`}>
                      {ACTION_STYLES[e.action].icon} {ACTION_STYLES[e.action].verb}
                    </span>
                    <span className="text-slate-400 text-sm flex-1">{e.label}</span>
                    <span className="text-slate-600 text-xs">{fmt(e.at)}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleStart}
              className="w-full bg-violet-600 active:bg-violet-700 text-white font-black text-xl px-8 py-6 rounded-full shadow-xl shadow-violet-900/50"
            >
              Press Play &amp; Start Together
            </button>
            <p className="text-slate-600 text-xs mt-3">Tap this the moment you press play on your TV</p>
          </div>
        )}

        {/* ── LIVE ── */}
        {step === 'live' && selected && (
          <div>
            {/* Timer */}
            <div className="text-center mb-6">
              <p className="text-slate-500 text-sm">{selected.name}</p>
              <div className="text-8xl font-black tabular-nums tracking-tight my-2">
                {fmt(elapsed)}
              </div>
              <p className="text-slate-600 text-sm">of {fmt(selected.runtime)}</p>
              <div className="w-full bg-white/5 rounded-full h-2 mt-4 overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (elapsed / selected.runtime) * 100)}%` }}
                />
              </div>
            </div>

            {done && (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 mb-5 text-center">
                <p className="text-emerald-400 font-bold text-lg">All done!</p>
                <p className="text-slate-400 text-sm mt-1">{activeEvents.length} filter events complete.</p>
              </div>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-5">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Coming up</p>
                {upcoming.map((e, i) => (
                  <UpcomingRow key={i} event={e} elapsed={elapsed} />
                ))}
              </div>
            )}

            {/* Live filters */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 mb-5">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4">Filters</p>
              <div className="space-y-4">
                {ALL_CATEGORIES.map((cat) => {
                  const ahead = selected.events.filter((e) => e.category === cat && e.at > elapsed).length;
                  return (
                    <div key={cat} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span>{CATEGORY_ICONS[cat]}</span>
                        <span className={`text-sm font-medium ${filters[cat] ? 'text-slate-200' : 'text-slate-600'}`}>{cat}</span>
                        {ahead > 0 && filters[cat] && <span className="text-xs text-slate-600">{ahead} ahead</span>}
                      </div>
                      <Toggle on={filters[cat]} onToggle={() => setFilters((p) => ({ ...p, [cat]: !p[cat] }))} label={`Toggle ${cat}`} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM CONTROLS — fixed so always reachable with thumb */}
      {step === 'live' && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#07090f]/95 backdrop-blur-md border-t border-white/5 px-4 py-4 z-30">
          <div className="max-w-2xl mx-auto flex gap-3">
            <button
              onClick={handlePause}
              className={`flex-1 font-bold py-4 rounded-full text-base transition-colors ${
                running ? 'bg-white/10 active:bg-white/20 text-white' : 'bg-violet-600 active:bg-violet-700 text-white'
              }`}
            >
              {running ? '⏸  I Paused My Stream' : '▶  Resume'}
            </button>
            <button
              onClick={handleReset}
              className="bg-white/5 active:bg-white/10 text-slate-400 font-semibold py-4 px-5 rounded-full"
            >
              ↺
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
