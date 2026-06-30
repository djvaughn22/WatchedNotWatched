'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TITLES, TITLES_BY_TMDB_ID, type Title, type FilterCategory, type FilterEvent } from '@/data/titles';
import type { SearchResult } from '@/app/api/search/route';

const ALL_CATEGORIES: FilterCategory[] = [
  'Profanity',
  'Sex / Nudity',
  'Gore & Violence',
  'Drug Use',
  'Scary Scenes',
];

const DEFAULT_FILTERS: Record<FilterCategory, boolean> = {
  'Profanity': true,
  'Sex / Nudity': true,
  'Gore & Violence': false,
  'Drug Use': false,
  'Scary Scenes': false,
};

const CATEGORY_ICONS: Record<FilterCategory, string> = {
  'Profanity': '🤬',
  'Sex / Nudity': '🚫',
  'Gore & Violence': '💢',
  'Drug Use': '🍶',
  'Scary Scenes': '👻',
};

const ACTION_STYLES = {
  mute: { badge: 'bg-violet-600', border: 'border-violet-500/50', bg: 'bg-violet-950/90', icon: '🔇', verb: 'MUTE' },
  skip: { badge: 'bg-rose-600',   border: 'border-rose-500/50',   bg: 'bg-rose-950/90',   icon: '⏭', verb: 'SKIP' },
} as const;

type AlertState = { id: number; event: FilterEvent; remaining: number };
type Step = 'select' | 'filters' | 'ready' | 'countdown' | 'live';

// Represents a selected title — either from local DB or TMDB with no local data
type SelectedTitle = {
  localData: Title | null;
  tmdbId: number | null;
  name: string;
  year: number | null;
  mediaType: 'movie' | 'tv';
  runtime: number; // 0 if unknown
};

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function parseMmSs(input: string): number | null {
  const t = input.trim();
  if (/^\d+:\d{1,2}$/.test(t)) { const [m, s] = t.split(':').map(Number); return m * 60 + s; }
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.1;
  window.speechSynthesis.speak(u);
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}

async function requestNotifPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function fireNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.ico', silent: false });
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle}
      className="relative shrink-0 w-14 h-7 rounded-full transition-colors focus:outline-none"
      style={{ backgroundColor: on ? '#7c3aed' : '#334155' }}>
      <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: on ? 'translateX(28px)' : 'translateX(0)' }} />
    </button>
  );
}

function CountdownRing({ total, remaining }: { total: number; remaining: number }) {
  const r = 24; const circ = 2 * Math.PI * r;
  const dash = circ * Math.max(0, remaining / total);
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="shrink-0">
      <circle cx="30" cy="30" r={r} fill="none" stroke="#334155" strokeWidth="5" />
      <circle cx="30" cy="30" r={r} fill="none" stroke="white" strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 30 30)"
        style={{ transition: 'stroke-dasharray 0.9s linear' }} />
      <text x="30" y="36" textAnchor="middle" fill="white" fontSize="15" fontWeight="bold">{Math.ceil(remaining)}</text>
    </svg>
  );
}

function AlertBanner({ alert, onDismiss }: { alert: AlertState; onDismiss: () => void }) {
  const s = ACTION_STYLES[alert.event.action];
  const isSkip = alert.event.action === 'skip';
  return (
    <div className={`flex items-center gap-4 border-2 rounded-2xl px-5 py-4 shadow-2xl ${s.border} ${s.bg}`}>
      <span className={`text-white text-sm font-black px-4 py-2 rounded-full shrink-0 ${s.badge}`}>{s.icon} {s.verb}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-base leading-tight">{alert.event.label}</p>
        <p className="text-slate-300 text-sm mt-0.5">
          {isSkip ? `Press skip forward ${alert.event.duration}s on your remote` : 'Press mute on your remote now'}
        </p>
      </div>
      {isSkip
        ? <div className="text-right shrink-0"><span className="text-white font-black text-2xl">+{alert.event.duration}s</span><p className="text-slate-400 text-xs">forward</p></div>
        : <CountdownRing total={alert.event.duration} remaining={alert.remaining} />}
      <button onClick={onDismiss} className="text-slate-400 hover:text-white text-xl shrink-0 ml-1 p-1" aria-label="Dismiss">✕</button>
    </div>
  );
}

function UpcomingRow({ event, elapsed }: { event: FilterEvent; elapsed: number }) {
  const s = ACTION_STYLES[event.action];
  const secsAway = event.at - elapsed;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <span className={`text-white text-xs font-black px-3 py-1.5 rounded-full shrink-0 ${s.badge}`}>{s.icon} {s.verb}</span>
      <span className="text-slate-300 text-sm flex-1 min-w-0 truncate">{event.label}</span>
      <span className="text-violet-400 text-sm font-semibold shrink-0">
        {secsAway > 90 ? `in ${fmt(secsAway)}` : secsAway > 0 ? `${Math.ceil(secsAway)}s` : 'now'}
      </span>
    </div>
  );
}

export function WatchCompanion() {
  const [step, setStep] = useState<Step>('select');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [tmdbAvailable, setTmdbAvailable] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<SelectedTitle | null>(null);
  const [filters, setFilters] = useState<Record<FilterCategory, boolean>>(DEFAULT_FILTERS);
  const [voiceOn, setVoiceOn] = useState(true);
  const [notifsEnabled, setNotifsEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [startOffset, setStartOffset] = useState(''); // MM:SS to start from
  const [resyncInput, setResyncInput] = useState('');
  const [resyncOpen, setResyncOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertState[]>([]);
  const startRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const firedRef = useRef<Set<number>>(new Set());
  const alertIdRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localTitle = selected?.localData ?? null;
  const activeEvents: FilterEvent[] = localTitle
    ? localTitle.events.filter((e) => filters[e.category])
    : [];
  const upcoming = activeEvents.filter((e) => e.at > elapsed).slice(0, 5);
  const runtime = localTitle?.runtime ?? 0;

  // Check notification support on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifPermission('unsupported');
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Probe TMDB availability once
  useEffect(() => {
    fetch('/api/search?q=test')
      .then((r) => r.json())
      .then((d) => setTmdbAvailable(!d?.error))
      .catch(() => setTmdbAvailable(false));
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 2) { setSearchResults([]); return; }

    if (!tmdbAvailable) {
      // Fall back to local search
      setSearchResults([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data: SearchResult[] = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, [query, tmdbAvailable]);

  const localResults = TITLES.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));

  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      }
    } catch { /* non-fatal */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

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
      if (runtime > 0 && newElapsed >= runtime) { setRunning(false); setDone(true); releaseWakeLock(); }
    }, 250);
    return () => clearInterval(id);
  }, [running, runtime, releaseWakeLock]);

  // Alert countdown
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setAlerts((prev) => prev.map((a) => ({ ...a, remaining: a.remaining - 0.5 })).filter((a) => a.event.action === 'skip' || a.remaining > 0));
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
        setAlerts((prev) => [{ id, event, remaining: event.duration }, ...prev].slice(0, 4));

        if (voiceOn) {
          speak(event.action === 'mute'
            ? `Mute now. ${event.label}. ${event.duration} seconds.`
            : `Skip forward ${event.duration} seconds. ${event.label}.`);
        }
        if (notifsEnabled) {
          fireNotification(
            event.action === 'mute' ? `🔇 MUTE — ${event.label}` : `⏭ SKIP — ${event.label}`,
            event.action === 'mute' ? `Mute for ${event.duration} seconds` : `Skip forward ${event.duration} seconds`
          );
        }
        vibrate(event.action === 'skip' ? [400, 100, 400] : [150, 80, 150]);

        const dismiss = event.action === 'skip' ? 9000 : (event.duration + 1.5) * 1000;
        setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== id)), dismiss);
      }
    });
  }, [elapsed, activeEvents, voiceOn, notifsEnabled]);

  const selectTitle = useCallback((result: SearchResult) => {
    const local = TITLES_BY_TMDB_ID.get(result.tmdbId) ?? null;
    setSelected({
      localData: local,
      tmdbId: result.tmdbId,
      name: result.name,
      year: result.year,
      mediaType: result.mediaType,
      runtime: local?.runtime ?? 0,
    });
    setStep('filters');
  }, []);

  const selectLocalTitle = useCallback((t: Title) => {
    setSelected({ localData: t, tmdbId: t.tmdbId, name: t.name, year: t.year, mediaType: t.mediaType, runtime: t.runtime });
    setStep('filters');
  }, []);

  const beginCountdown = useCallback(() => {
    firedRef.current.clear();
    setAlerts([]);
    const offsetSecs = parseMmSs(startOffset) ?? 0;
    setElapsed(offsetSecs);
    setDone(false);
    pausedAtRef.current = offsetSecs;
    // Pre-mark events that already passed the offset as fired
    firedRef.current = new Set(activeEvents.filter((e) => e.at < offsetSecs).map((e) => e.at));
    setStep('countdown');
    setCountdown(3);

    let count = 3;
    if (voiceOn) speak('Get ready. 3');
    vibrate(200);

    const tick = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count > 0) {
        if (voiceOn) speak(String(count));
        vibrate(200);
      } else {
        clearInterval(tick);
        if (voiceOn) speak('Press Play!');
        vibrate([300, 100, 300, 100, 300]);
        setTimeout(() => {
          startRef.current = Date.now();
          setRunning(true);
          setStep('live');
          setCountdown(null);
          acquireWakeLock();
        }, 400);
      }
    }, 1000);
  }, [voiceOn, acquireWakeLock, startOffset, activeEvents]);

  const handlePause = useCallback(() => {
    if (!running) { startRef.current = Date.now(); setRunning(true); acquireWakeLock(); }
    else { pausedAtRef.current = elapsed; setRunning(false); releaseWakeLock(); }
  }, [running, elapsed, acquireWakeLock, releaseWakeLock]);

  const handleReset = useCallback(() => {
    setRunning(false); setElapsed(0); setDone(false);
    firedRef.current.clear(); setAlerts([]); pausedAtRef.current = 0;
    releaseWakeLock(); setStep('ready');
  }, [releaseWakeLock]);

  const handleResync = useCallback(() => {
    const secs = parseMmSs(resyncInput);
    if (secs === null) return;
    pausedAtRef.current = secs;
    startRef.current = Date.now();
    setElapsed(secs);
    firedRef.current = new Set(activeEvents.filter((e) => e.at < secs).map((e) => e.at));
    setAlerts([]);
    setResyncOpen(false);
    setResyncInput('');
  }, [resyncInput, activeEvents]);

  const handleEnableNotifs = useCallback(async () => {
    const granted = await requestNotifPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    setNotifsEnabled(granted);
  }, []);

  const reset = useCallback(() => {
    setStep('select'); setSelected(null); setRunning(false);
    setAlerts([]); setCountdown(null); setQuery(''); setSearchResults([]);
    setStartOffset(''); releaseWakeLock();
  }, [releaseWakeLock]);

  const activeCount = ALL_CATEGORIES.filter((k) => filters[k]).length;

  return (
    <div className="bg-[#07090f] text-white min-h-screen font-[var(--font-geist-sans)]">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#07090f]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">
          <a href="/" className="font-black text-base tracking-tight">WatchedNotWatched</a>
          <div className="flex items-center gap-3">
            {step === 'live' && (
              <button onClick={() => setVoiceOn((v) => !v)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${voiceOn ? 'border-violet-500/50 text-violet-300 bg-violet-900/30' : 'border-white/10 text-slate-500'}`}>
                {voiceOn ? '🔊' : '🔇'}
              </button>
            )}
            {step !== 'select' && step !== 'countdown' && (
              <button onClick={reset} className="text-slate-400 hover:text-white text-sm transition-colors">← Titles</button>
            )}
          </div>
        </div>
      </nav>

      {/* ALERT OVERLAY */}
      {step === 'live' && alerts.length > 0 && (
        <div className="fixed top-16 left-0 right-0 z-40 px-4 pt-2 flex flex-col gap-2 max-w-2xl mx-auto">
          {alerts.map((a) => (
            <AlertBanner key={a.id} alert={a} onDismiss={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))} />
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
              <p className="text-slate-400 text-base">Search any show or movie. Open this on your phone while you watch on TV.</p>
            </div>

            <div className="relative mb-4">
              <input
                type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder={tmdbAvailable ? 'Search millions of titles…' : 'Search titles…'}
                className="w-full bg-white/5 border border-white/15 text-white placeholder-slate-600 px-5 py-4 rounded-2xl outline-none focus:border-violet-500/60 text-base transition-colors"
                autoFocus
              />
              {searching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* TMDB results */}
            {tmdbAvailable && searchResults.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {searchResults.map((r) => {
                  const hasFilters = TITLES_BY_TMDB_ID.has(r.tmdbId);
                  return (
                    <button key={r.tmdbId} onClick={() => selectTitle(r)}
                      className="flex items-center gap-4 bg-white/5 active:bg-white/10 border border-white/10 rounded-2xl px-5 py-4 text-left transition-all">
                      {r.poster
                        ? <img src={r.poster} alt="" className="w-10 h-14 object-cover rounded-lg shrink-0" />
                        : <div className="w-10 h-14 bg-white/10 rounded-lg shrink-0 flex items-center justify-center text-slate-600 text-lg">{r.mediaType === 'tv' ? '📺' : '🎬'}</div>}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-base leading-tight">{r.name}</p>
                        <p className="text-slate-500 text-sm mt-0.5">{r.year} · {r.mediaType === 'tv' ? 'Series' : 'Movie'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {hasFilters
                          ? <span className="text-xs font-black px-2.5 py-1 rounded-full bg-violet-600 text-white">FILTERS READY</span>
                          : <span className="text-xs text-slate-600">No filters yet</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Local fallback / featured titles */}
            {(!tmdbAvailable || query.length < 2) && (
              <>
                {query.length < 2 && <p className="text-slate-600 text-xs uppercase tracking-wider font-semibold mb-3 px-1">Featured titles with filters</p>}
                <div className="flex flex-col gap-2">
                  {localResults.map((t) => (
                    <button key={t.id} onClick={() => selectLocalTitle(t)}
                      className="flex items-center justify-between bg-white/5 active:bg-white/10 border border-white/10 rounded-2xl px-5 py-4 text-left">
                      <div className="min-w-0">
                        <p className="font-bold text-base">{t.name}</p>
                        <p className="text-slate-500 text-sm mt-0.5">{t.platform} · {t.events.length} filter events</p>
                      </div>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-violet-600 text-white shrink-0 ml-3">READY</span>
                    </button>
                  ))}
                  {query.length >= 2 && localResults.length === 0 && !tmdbAvailable && (
                    <p className="text-center text-slate-600 py-8">No local matches for &ldquo;{query}&rdquo;.</p>
                  )}
                </div>
              </>
            )}

            {!tmdbAvailable && tmdbAvailable !== null && (
              <p className="text-center text-slate-700 text-xs mt-6">
                Full search unavailable — add a free TMDB API key to unlock millions of titles.
              </p>
            )}
          </div>
        )}

        {/* ── FILTERS ── */}
        {step === 'filters' && selected && (
          <div>
            <div className="mb-6">
              <p className="text-slate-500 text-sm">Watching</p>
              <h1 className="text-2xl font-black mt-0.5">{selected.name}</h1>
              {selected.year && <p className="text-slate-500 text-sm">{selected.year} · {selected.mediaType === 'tv' ? 'Series' : 'Movie'}</p>}
              {!localTitle && (
                <div className="mt-3 bg-amber-950/30 border border-amber-500/20 rounded-xl px-4 py-3">
                  <p className="text-amber-400 text-sm font-semibold">No community filters yet for this title.</p>
                  <p className="text-slate-500 text-xs mt-0.5">You can still use the timer and re-sync — add your own timestamps as you watch.</p>
                </div>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-5">What to filter</p>
              <div className="space-y-5">
                {ALL_CATEGORIES.map((cat) => {
                  const count = localTitle?.events.filter((e) => e.category === cat).length ?? 0;
                  return (
                    <div key={cat} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{CATEGORY_ICONS[cat]}</span>
                        <div>
                          <p className={`text-base font-medium ${filters[cat] ? 'text-white' : 'text-slate-500'}`}>{cat}</p>
                          {count > 0 && <p className="text-xs text-slate-600">{count} event{count !== 1 ? 's' : ''}</p>}
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
            <div className="mb-6">
              <p className="text-slate-500 text-sm">Ready to watch</p>
              <h1 className="text-2xl font-black mt-0.5 mb-1">{selected.name}</h1>
              {localTitle && <p className="text-slate-500 text-sm">{activeEvents.length} filter events active</p>}
            </div>

            {/* Start position */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 text-left">
              <p className="text-slate-400 text-sm font-semibold mb-3">Starting from</p>
              <div className="flex gap-3">
                <button onClick={() => setStartOffset('')}
                  className={`flex-1 py-3 rounded-full font-semibold text-sm transition-colors ${startOffset === '' ? 'bg-violet-600 text-white' : 'bg-white/10 text-slate-400'}`}>
                  Beginning (0:00)
                </button>
                <div className="flex-1 relative">
                  <input type="text" value={startOffset} onChange={(e) => setStartOffset(e.target.value)}
                    placeholder="e.g. 45:30"
                    className={`w-full py-3 px-4 rounded-full text-sm text-center outline-none transition-colors ${startOffset ? 'bg-violet-600/20 border border-violet-500/50 text-white' : 'bg-white/10 border border-white/10 text-slate-400 placeholder-slate-600'}`} />
                </div>
              </div>
              <p className="text-slate-600 text-xs mt-2">Resuming mid-movie? Enter the timestamp showing on your streaming app.</p>
            </div>

            {/* Alerts toggle */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-5 text-left">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">Alert methods</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span>🔊</span>
                    <div>
                      <p className="text-white text-sm font-semibold">Voice</p>
                      <p className="text-slate-500 text-xs">Phone speaks mute/skip cues out loud</p>
                    </div>
                  </div>
                  <Toggle on={voiceOn} onToggle={() => setVoiceOn((v) => !v)} label="Voice alerts" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span>🔔</span>
                    <div>
                      <p className="text-white text-sm font-semibold">Notifications</p>
                      <p className="text-slate-500 text-xs">OS banner — works on desktop &amp; Android</p>
                    </div>
                  </div>
                  {notifPermission === 'unsupported' ? (
                    <span className="text-slate-600 text-xs">Not supported</span>
                  ) : notifPermission === 'granted' ? (
                    <Toggle on={notifsEnabled} onToggle={() => setNotifsEnabled((v) => !v)} label="Notifications" />
                  ) : notifPermission === 'denied' ? (
                    <span className="text-slate-600 text-xs">Blocked in browser</span>
                  ) : (
                    <button onClick={handleEnableNotifs} className="text-xs bg-violet-600/20 border border-violet-500/30 text-violet-300 px-3 py-1.5 rounded-full">
                      Enable
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-6 text-left">
              <ol className="space-y-4">
                {[
                  `Open your streaming app and find "${selected.name}"`,
                  startOffset ? `Seek to ${startOffset} in the streaming app` : 'Position to the very start — before the movie begins',
                  'Turn up your phone volume for voice alerts',
                  'Tap below — your phone will count 3…2…1… then say "Press Play"',
                ].map((text, i) => (
                  <li key={i} className="flex gap-4 items-start">
                    <span className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 font-black text-sm flex items-center justify-center shrink-0">{i + 1}</span>
                    <p className="text-slate-300 text-sm leading-relaxed pt-0.5">{text}</p>
                  </li>
                ))}
              </ol>
            </div>

            <button onClick={beginCountdown}
              className="w-full bg-violet-600 active:bg-violet-700 text-white font-black text-xl px-8 py-6 rounded-full shadow-xl shadow-violet-900/50">
              Start Countdown →
            </button>
            <p className="text-slate-600 text-xs mt-3">Phone counts 3…2…1… hit your remote on "Press Play"</p>
          </div>
        )}

        {/* ── COUNTDOWN ── */}
        {step === 'countdown' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <p className="text-slate-400 text-lg mb-6">Get your remote ready…</p>
            <div className="text-[160px] font-black leading-none tabular-nums text-violet-400">
              {countdown === 0 ? '▶' : countdown}
            </div>
            <p className="text-white text-2xl font-bold mt-6">
              {countdown === 0 ? 'PRESS PLAY NOW!' : countdown === 1 ? 'Almost…' : 'Get ready'}
            </p>
          </div>
        )}

        {/* ── LIVE ── */}
        {step === 'live' && selected && (
          <div>
            <div className="text-center mb-6">
              <p className="text-slate-500 text-sm truncate">{selected.name}</p>
              <div className="text-8xl font-black tabular-nums tracking-tight my-2">{fmt(elapsed)}</div>
              {runtime > 0 && <p className="text-slate-600 text-sm">of {fmt(runtime)}</p>}
              {runtime > 0 && (
                <div className="w-full bg-white/5 rounded-full h-2 mt-4 overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (elapsed / runtime) * 100)}%` }} />
                </div>
              )}
            </div>

            {done && (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 mb-5 text-center">
                <p className="text-emerald-400 font-bold text-lg">All done!</p>
                <p className="text-slate-400 text-sm mt-1">{activeEvents.length} filter events complete.</p>
              </div>
            )}

            {!localTitle && (
              <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl px-5 py-4 mb-5">
                <p className="text-amber-400 text-sm font-semibold">No community filters for this title yet.</p>
                <p className="text-slate-500 text-xs mt-0.5">Timer is running — use Re-sync to stay accurate.</p>
              </div>
            )}

            {upcoming.length > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-5">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Coming up</p>
                {upcoming.map((e, i) => <UpcomingRow key={i} event={e} elapsed={elapsed} />)}
              </div>
            )}

            {/* Re-sync */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm font-semibold">Off sync?</p>
                  <p className="text-slate-600 text-xs">Type the timestamp on your streaming app</p>
                </div>
                <button onClick={() => setResyncOpen((v) => !v)}
                  className="text-violet-400 text-sm font-semibold px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-900/20">
                  Re-sync
                </button>
              </div>
              {resyncOpen && (
                <div className="flex gap-2 mt-3">
                  <input type="text" value={resyncInput} onChange={(e) => setResyncInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleResync()}
                    placeholder="e.g. 12:34"
                    className="flex-1 bg-white/10 border border-white/20 text-white placeholder-slate-600 px-4 py-3 rounded-full outline-none focus:border-violet-500/60 text-base"
                    autoFocus />
                  <button onClick={handleResync} className="bg-violet-600 active:bg-violet-700 text-white font-bold px-5 py-3 rounded-full">Set</button>
                </div>
              )}
            </div>

            {/* Live filters */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 mb-5">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4">Filters</p>
              <div className="space-y-4">
                {ALL_CATEGORIES.map((cat) => {
                  const ahead = localTitle?.events.filter((e) => e.category === cat && e.at > elapsed).length ?? 0;
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

      {/* BOTTOM CONTROLS */}
      {step === 'live' && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#07090f]/95 backdrop-blur-md border-t border-white/5 px-4 py-4 z-30">
          <div className="max-w-2xl mx-auto flex gap-3">
            <button onClick={handlePause}
              className={`flex-1 font-bold py-4 rounded-full text-base transition-colors ${running ? 'bg-white/10 active:bg-white/20 text-white' : 'bg-violet-600 active:bg-violet-700 text-white'}`}>
              {running ? '⏸  I Paused My Stream' : '▶  Resume'}
            </button>
            <button onClick={handleReset} className="bg-white/5 active:bg-white/10 text-slate-400 font-semibold py-4 px-5 rounded-full">↺</button>
          </div>
        </div>
      )}
    </div>
  );
}
