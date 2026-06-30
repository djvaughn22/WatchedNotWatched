'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TITLES, TITLES_BY_TVMAZE_ID, type Title, type FilterCategory, type FilterEvent } from '@/data/titles';

// ─── Types ───────────────────────────────────────────────────────────────────

const ALL_CATEGORIES: FilterCategory[] = [
  'Profanity', 'Sex / Nudity', 'Gore & Violence', 'Drug Use', 'Scary Scenes',
];
const DEFAULT_FILTERS: Record<FilterCategory, boolean> = {
  'Profanity': true, 'Sex / Nudity': true, 'Gore & Violence': false,
  'Drug Use': false, 'Scary Scenes': false,
};
const CATEGORY_ICONS: Record<FilterCategory, string> = {
  'Profanity': '🤬', 'Sex / Nudity': '🚫', 'Gore & Violence': '💢',
  'Drug Use': '🍶', 'Scary Scenes': '👻',
};
const ACTION_STYLES = {
  mute: { badge: 'bg-violet-600', border: 'border-violet-500/50', bg: 'bg-violet-950/90', icon: '🔇', verb: 'MUTE' },
  skip: { badge: 'bg-rose-600',   border: 'border-rose-500/50',   bg: 'bg-rose-950/90',   icon: '⏭',  verb: 'SKIP' },
} as const;
const RATING_COLOR: Record<string, string> = {
  'TV-MA': 'bg-red-700', 'R': 'bg-red-700',
  'TV-14': 'bg-orange-600', 'PG-13': 'bg-orange-600',
  'TV-PG': 'bg-yellow-600', 'PG': 'bg-yellow-600',
  'G': 'bg-emerald-700', 'TV-G': 'bg-emerald-700',
};

type TitleMeta = {
  poster: string | null;
  genres: string[];
  rating: number | null;
  summary: string | null;
  network: string | null;
  status: string | null;
  runtimeSeconds?: number | null; // from OMDB for movies without local data
};

type SelectedTitle = {
  localData: Title | null;
  tvmazeId: number | null;
  name: string;
  year: number | null;
  mediaType: 'movie' | 'tv';
  runtime: number;
  contentRating: string | null;
  meta: TitleMeta | null;
};

type TVmazeResult = {
  score: number;
  show: {
    id: number; name: string; type: string; genres: string[];
    status: string; runtime: number | null; averageRuntime: number | null;
    premiered: string | null;
    rating: { average: number | null };
    network: { name: string } | null;
    webChannel: { name: string } | null;
    image: { medium: string; original: string } | null;
    summary: string | null;
  };
};

type AlertState = { id: number; event: FilterEvent; remaining: number };
type Step = 'select' | 'filters' | 'ready' | 'countdown' | 'live';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(s: number): string {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function parseMmSs(input: string): number | null {
  const t = input.trim();
  if (/^\d+:\d{1,2}$/.test(t)) { const [m, s] = t.split(':').map(Number); return m * 60 + s; }
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
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
  return (await Notification.requestPermission()) === 'granted';
}
function fireNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.ico', silent: false });
}
async function fetchTVmazeMeta(id: number): Promise<TitleMeta> {
  const res = await fetch(`https://api.tvmaze.com/shows/${id}`);
  const s = await res.json();
  return {
    poster: s.image?.medium ?? null,
    genres: s.genres ?? [],
    rating: s.rating?.average ?? null,
    summary: s.summary ? stripHtml(s.summary) : null,
    network: s.network?.name ?? s.webChannel?.name ?? null,
    status: s.status ?? null,
  };
}

async function fetchMovieMeta(title: string, year: number | null): Promise<TitleMeta | null> {
  // Called client-side — OMDB free tier is designed for browser use
  const key = process.env.NEXT_PUBLIC_OMDB_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({ t: title, plot: 'short', apikey: key });
    if (year) params.set('y', String(year));
    const res = await fetch(`https://www.omdbapi.com/?${params}`);
    const d = await res.json();
    if (!d || d.Response === 'False') return null;
    const runtimeMatch = d.Runtime?.match(/(\d+)/);
    return {
      poster: d.Poster && d.Poster !== 'N/A' ? d.Poster : null,
      genres: d.Genre && d.Genre !== 'N/A' ? d.Genre.split(', ') : [],
      rating: d.imdbRating && d.imdbRating !== 'N/A' ? parseFloat(d.imdbRating) : null,
      summary: d.Plot && d.Plot !== 'N/A' ? d.Plot : null,
      network: null,
      status: null,
      runtimeSeconds: runtimeMatch ? Number(runtimeMatch[1]) * 60 : null,
    };
  } catch { return null; }
}
async function searchTVmaze(q: string): Promise<TVmazeResult[]> {
  const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function RatingBadge({ rating }: { rating: string }) {
  const color = RATING_COLOR[rating] ?? 'bg-slate-700';
  return <span className={`${color} text-white text-xs font-black px-2 py-0.5 rounded`}>{rating}</span>;
}

function StarRating({ value }: { value: number }) {
  const stars = Math.round(value / 2);
  return (
    <span className="flex items-center gap-1">
      <span className="text-amber-400">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
      <span className="text-slate-500 text-xs">{value.toFixed(1)}</span>
    </span>
  );
}

function CountdownRing({ total, remaining }: { total: number; remaining: number }) {
  const r = 24, circ = 2 * Math.PI * r, dash = circ * Math.max(0, remaining / total);
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
    <div className={`flex items-center gap-3 border-2 rounded-2xl px-4 py-3 shadow-2xl ${s.border} ${s.bg}`}>
      <span className={`text-white text-sm font-black px-3 py-1.5 rounded-full shrink-0 ${s.badge}`}>{s.icon} {s.verb}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm leading-tight">{alert.event.label}</p>
        <p className="text-slate-300 text-xs mt-0.5">
          {isSkip ? `Press skip +${alert.event.duration}s on your remote` : 'Press mute on your remote now'}
        </p>
      </div>
      {isSkip
        ? <div className="text-right shrink-0"><span className="text-white font-black text-xl">+{alert.event.duration}s</span></div>
        : <CountdownRing total={alert.event.duration} remaining={alert.remaining} />}
      <button onClick={onDismiss} className="text-slate-500 hover:text-white text-lg shrink-0 p-1">✕</button>
    </div>
  );
}

function UpcomingRow({ event, elapsed }: { event: FilterEvent; elapsed: number }) {
  const s = ACTION_STYLES[event.action];
  const away = event.at - elapsed;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className={`text-white text-xs font-black px-2.5 py-1 rounded-full shrink-0 ${s.badge}`}>{s.icon} {s.verb}</span>
      <span className="text-slate-300 text-sm flex-1 min-w-0 truncate">{event.label}</span>
      <span className="text-violet-400 text-sm font-semibold shrink-0">
        {away > 90 ? `in ${fmt(away)}` : away > 0 ? `${Math.ceil(away)}s` : 'now'}
      </span>
    </div>
  );
}

// Poster card for search results
function TitleCard({ poster, name, year, genres, rating, contentRating, hasFilters, network, onClick }: {
  poster: string | null; name: string; year: number | null; genres: string[];
  rating: number | null; contentRating: string | null; hasFilters: boolean;
  network: string | null; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="flex items-stretch gap-0 bg-white/5 active:bg-white/10 border border-white/10 hover:border-violet-500/30 rounded-2xl overflow-hidden text-left transition-all w-full">
      {/* Poster */}
      <div className="w-[72px] shrink-0 bg-white/5 relative">
        {poster
          ? <img src={poster} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full min-h-[100px] flex items-center justify-center text-3xl text-slate-700">🎬</div>}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-between gap-1.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-base leading-tight">{name}</p>
            {hasFilters
              ? <span className="text-xs font-black px-2 py-0.5 rounded-full bg-violet-600 text-white shrink-0 mt-0.5">READY</span>
              : <span className="text-xs text-slate-600 shrink-0 mt-0.5">No filters yet</span>}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            {[year, network].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {contentRating && <RatingBadge rating={contentRating} />}
          {rating && <StarRating value={rating} />}
          {genres.slice(0, 2).map((g) => (
            <span key={g} className="text-xs text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{g}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WatchCompanion() {
  const [step, setStep] = useState<Step>('select');
  const [query, setQuery] = useState('');
  const [tvResults, setTvResults] = useState<TVmazeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedTitle | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [filters, setFilters] = useState<Record<FilterCategory, boolean>>(DEFAULT_FILTERS);
  const [voiceOn, setVoiceOn] = useState(true);
  const [notifsEnabled, setNotifsEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [startOffset, setStartOffset] = useState('');
  const [resyncInput, setResyncInput] = useState('');
  const [resyncOpen, setResyncOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertState[]>([]);
  const [sessionMutes, setSessionMutes] = useState(0);
  const [sessionSkips, setSessionSkips] = useState(0);
  const [lifetimeFiltered, setLifetimeFiltered] = useState(0);
  const startRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const firedRef = useRef<Set<number>>(new Set());
  const alertIdRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localTitle = selected?.localData ?? null;
  const activeEvents: FilterEvent[] = localTitle ? localTitle.events.filter((e) => filters[e.category]) : [];
  const upcoming = activeEvents.filter((e) => e.at > elapsed).slice(0, 5);
  // Use local runtime first, fall back to OMDB runtime for movies without local data
  const runtime = selected?.runtime || selected?.meta?.runtimeSeconds || 0;
  const activeCount = ALL_CATEGORIES.filter((k) => filters[k]).length;

  // Init
  useEffect(() => {
    try { const s = localStorage.getItem('wnw_lifetime_filtered'); if (s) setLifetimeFiltered(Number(s)); } catch {}
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) setNotifPermission('unsupported');
    else setNotifPermission(Notification.permission);
  }, []);

  // Debounced TVmaze search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 2) { setTvResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try { setTvResults(await searchTVmaze(query)); } catch { setTvResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, [query]);

  const localResults = TITLES.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));

  // Wake lock
  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator)
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
    } catch {}
  }, []);
  const releaseWakeLock = useCallback(() => { wakeLockRef.current?.release().catch(() => {}); wakeLockRef.current = null; }, []);
  useEffect(() => {
    const onVisible = () => { if (running) acquireWakeLock(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [running, acquireWakeLock]);

  // Ticker
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const ne = pausedAtRef.current + (Date.now() - startRef.current) / 1000;
      setElapsed(ne);
      if (runtime > 0 && ne >= runtime) { setRunning(false); setDone(true); releaseWakeLock(); }
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
        if (event.action === 'mute') setSessionMutes((n) => n + 1);
        else setSessionSkips((n) => n + 1);
        setLifetimeFiltered((n) => {
          const next = n + 1;
          try { localStorage.setItem('wnw_lifetime_filtered', String(next)); } catch {}
          return next;
        });
        if (voiceOn) speak(event.action === 'mute' ? `Mute now. ${event.label}. ${event.duration} seconds.` : `Skip forward ${event.duration} seconds. ${event.label}.`);
        if (notifsEnabled) fireNotification(event.action === 'mute' ? `🔇 MUTE — ${event.label}` : `⏭ SKIP — ${event.label}`, event.action === 'mute' ? `Mute for ${event.duration} sec` : `Skip +${event.duration}s`);
        vibrate(event.action === 'skip' ? [400, 100, 400] : [150, 80, 150]);
        setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== id)), event.action === 'skip' ? 9000 : (event.duration + 1.5) * 1000);
      }
    });
  }, [elapsed, activeEvents, voiceOn, notifsEnabled]);

  // Select a title — fetch metadata based on type; always degrade gracefully
  const pickTitle = useCallback(async (opts: {
    localData: Title | null; tvmazeId: number | null; name: string;
    year: number | null; mediaType: 'movie' | 'tv'; runtime: number; contentRating: string | null;
  }) => {
    const base: SelectedTitle = { ...opts, meta: null };
    setSelected(base);
    setStep('filters');
    setMetaLoading(true);
    try {
      let meta: TitleMeta | null = null;
      if (opts.tvmazeId) {
        meta = await fetchTVmazeMeta(opts.tvmazeId);
      } else if (opts.mediaType === 'movie') {
        meta = await fetchMovieMeta(opts.name, opts.year);
        // If OMDB returned a runtime and we don't have local data, use it
        if (meta && !opts.localData) {
          // runtime comes from OMDB via MovieMeta — stored separately; enrich SelectedTitle
        }
      }
      if (meta) setSelected((prev) => prev ? { ...prev, meta } : prev);
    } catch {} finally { setMetaLoading(false); }
  }, []);

  const selectLocalTitle = useCallback((t: Title) => {
    pickTitle({ localData: t, tvmazeId: t.tvmazeId ?? null, name: t.name, year: t.year, mediaType: t.mediaType, runtime: t.runtime, contentRating: t.contentRating });
  }, [pickTitle]);

  const selectTVmazeResult = useCallback((r: TVmazeResult) => {
    const localMatch = TITLES_BY_TVMAZE_ID.get(r.show.id) ?? null;
    const year = r.show.premiered ? Number(r.show.premiered.slice(0, 4)) : null;
    const runtimeSecs = (r.show.averageRuntime ?? r.show.runtime ?? 0) * 60;
    const meta: TitleMeta = {
      poster: r.show.image?.medium ?? null,
      genres: r.show.genres ?? [],
      rating: r.show.rating?.average ?? null,
      summary: r.show.summary ? stripHtml(r.show.summary) : null,
      network: r.show.network?.name ?? r.show.webChannel?.name ?? null,
      status: r.show.status ?? null,
    };
    const base: SelectedTitle = {
      localData: localMatch, tvmazeId: r.show.id,
      name: r.show.name, year, mediaType: 'tv',
      runtime: localMatch?.runtime ?? runtimeSecs,
      contentRating: localMatch?.contentRating ?? null,
      meta,
    };
    setSelected(base);
    setStep('filters');
  }, []);

  const beginCountdown = useCallback(() => {
    firedRef.current.clear(); setAlerts([]); setSessionMutes(0); setSessionSkips(0);
    const off = parseMmSs(startOffset) ?? 0;
    setElapsed(off); setDone(false); pausedAtRef.current = off;
    firedRef.current = new Set(activeEvents.filter((e) => e.at < off).map((e) => e.at));
    setStep('countdown'); setCountdown(3);
    let count = 3;
    if (voiceOn) speak('Get ready. 3');
    vibrate(200);
    const tick = setInterval(() => {
      count -= 1; setCountdown(count);
      if (count > 0) { if (voiceOn) speak(String(count)); vibrate(200); }
      else {
        clearInterval(tick);
        if (voiceOn) speak('Press Play!');
        vibrate([300, 100, 300, 100, 300]);
        setTimeout(() => { startRef.current = Date.now(); setRunning(true); setStep('live'); setCountdown(null); acquireWakeLock(); }, 400);
      }
    }, 1000);
  }, [voiceOn, acquireWakeLock, startOffset, activeEvents]);

  const handlePause = useCallback(() => {
    if (!running) { startRef.current = Date.now(); setRunning(true); acquireWakeLock(); }
    else { pausedAtRef.current = elapsed; setRunning(false); releaseWakeLock(); }
  }, [running, elapsed, acquireWakeLock, releaseWakeLock]);

  const handleReset = useCallback(() => {
    setRunning(false); setElapsed(0); setDone(false); firedRef.current.clear();
    setAlerts([]); pausedAtRef.current = 0; releaseWakeLock(); setStep('ready');
  }, [releaseWakeLock]);

  const handleResync = useCallback(() => {
    const secs = parseMmSs(resyncInput);
    if (secs === null) return;
    pausedAtRef.current = secs; startRef.current = Date.now(); setElapsed(secs);
    firedRef.current = new Set(activeEvents.filter((e) => e.at < secs).map((e) => e.at));
    setAlerts([]); setResyncOpen(false); setResyncInput('');
  }, [resyncInput, activeEvents]);

  const handleEnableNotifs = useCallback(async () => {
    const granted = await requestNotifPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    setNotifsEnabled(granted);
  }, []);

  const reset = useCallback(() => {
    setStep('select'); setSelected(null); setRunning(false); setAlerts([]);
    setCountdown(null); setQuery(''); setTvResults([]); setStartOffset(''); releaseWakeLock();
  }, [releaseWakeLock]);

  const poster = selected?.meta?.poster ?? null;
  // Prefer local contentRating (seeded), fall back to OMDB response
  const contentRating = selected?.contentRating ?? null;

  // ─── Render ─────────────────────────────────────────────────────────────────

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
        <div className="fixed top-14 left-0 right-0 z-40 px-4 pt-2 flex flex-col gap-2 max-w-2xl mx-auto">
          {alerts.map((a) => <AlertBanner key={a.id} alert={a} onDismiss={() => setAlerts((p) => p.filter((x) => x.id !== a.id))} />)}
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-32">

        {/* ── SELECT ── */}
        {step === 'select' && (
          <div>
            <div className="mb-7 text-center">
              <div className="inline-block bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
                Watch Companion
              </div>
              <h1 className="text-3xl font-black mb-2">What are you watching?</h1>
              <p className="text-slate-400 text-sm">Open on your phone. Press play on your TV at the same time.</p>
            </div>

            <div className="relative mb-4">
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search shows and movies…"
                className="w-full bg-white/5 border border-white/15 text-white placeholder-slate-600 px-5 py-4 rounded-2xl outline-none focus:border-violet-500/60 text-base transition-colors"
                autoFocus />
              {searching && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
            </div>

            {/* TVmaze live results */}
            {tvResults.length > 0 && (
              <div className="flex flex-col gap-2 mb-5">
                <p className="text-slate-600 text-xs uppercase tracking-wider font-semibold px-1 mb-1">Shows</p>
                {tvResults.slice(0, 6).map((r) => {
                  const hasFilters = TITLES_BY_TVMAZE_ID.has(r.show.id);
                  return (
                    <TitleCard key={r.show.id}
                      poster={r.show.image?.medium ?? null}
                      name={r.show.name}
                      year={r.show.premiered ? Number(r.show.premiered.slice(0, 4)) : null}
                      genres={r.show.genres}
                      rating={r.show.rating?.average ?? null}
                      contentRating={null}
                      hasFilters={hasFilters}
                      network={r.show.network?.name ?? r.show.webChannel?.name ?? null}
                      onClick={() => selectTVmazeResult(r)}
                    />
                  );
                })}
              </div>
            )}

            {/* Local seed titles */}
            <div className="flex flex-col gap-2">
              {(query.length < 2 || localResults.length > 0) && (
                <p className="text-slate-600 text-xs uppercase tracking-wider font-semibold px-1 mb-1">
                  {query.length < 2 ? 'Available with filters' : 'In filter library'}
                </p>
              )}
              {localResults.map((t) => (
                <TitleCard key={t.id}
                  poster={null}
                  name={t.name}
                  year={t.year}
                  genres={[]}
                  rating={null}
                  contentRating={t.contentRating}
                  hasFilters={true}
                  network={t.platform}
                  onClick={() => selectLocalTitle(t)}
                />
              ))}
              {query.length >= 2 && localResults.length === 0 && tvResults.length === 0 && !searching && (
                <p className="text-center text-slate-600 py-8 text-sm">No results for &ldquo;{query}&rdquo;</p>
              )}
            </div>
          </div>
        )}

        {/* ── FILTERS ── */}
        {step === 'filters' && selected && (
          <div>
            {/* Poster hero */}
            <div className="relative rounded-2xl overflow-hidden mb-5 bg-white/5 border border-white/10">
              {poster
                ? <div className="relative h-48">
                    <img src={poster} alt="" className="w-full h-full object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07090f] via-[#07090f]/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <TitleHeaderInfo selected={selected} metaLoading={metaLoading} />
                    </div>
                  </div>
                : <div className="p-5"><TitleHeaderInfo selected={selected} metaLoading={metaLoading} /></div>}
            </div>

            {/* Summary */}
            {selected.meta?.summary && (
              <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-3">{selected.meta.summary}</p>
            )}

            {!localTitle && (
              <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
                <p className="text-amber-400 text-sm font-semibold">No community filters yet.</p>
                <p className="text-slate-500 text-xs mt-0.5">You can still use the sync timer — add timestamps as you watch.</p>
              </div>
            )}

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

            <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 mb-5">
              <p className="text-slate-400 text-sm">
                <span className="text-white font-bold">{activeEvents.length}</span> events · <span className="text-white font-bold">{activeCount}</span> filters on
              </p>
              <span className={`text-xs font-black px-3 py-1.5 rounded-full text-white ${activeEvents.length > 0 ? 'bg-violet-600' : 'bg-slate-700'}`}>
                {activeEvents.length > 0 ? 'READY' : 'ALL CLEAR'}
              </span>
            </div>

            <button onClick={() => setStep('ready')} className="w-full bg-violet-600 active:bg-violet-700 text-white font-bold text-lg px-8 py-5 rounded-full">
              Continue →
            </button>
          </div>
        )}

        {/* ── READY ── */}
        {step === 'ready' && selected && (
          <div>
            {/* Compact title card */}
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
              {poster && <img src={poster} alt="" className="w-12 h-16 object-cover rounded-lg shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-base leading-tight">{selected.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {selected.contentRating && <RatingBadge rating={selected.contentRating} />}
                  {selected.meta?.genres?.slice(0, 2).map((g) => (
                    <span key={g} className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{g}</span>
                  ))}
                </div>
                <p className="text-slate-500 text-xs mt-1">{activeEvents.length} filter events active</p>
              </div>
            </div>

            {/* Start offset */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
              <p className="text-slate-400 text-sm font-semibold mb-3">Starting from</p>
              <div className="flex gap-2">
                <button onClick={() => setStartOffset('')}
                  className={`flex-1 py-3 rounded-full font-semibold text-sm ${startOffset === '' ? 'bg-violet-600 text-white' : 'bg-white/10 text-slate-400'}`}>
                  Beginning
                </button>
                <input type="text" value={startOffset} onChange={(e) => setStartOffset(e.target.value)}
                  placeholder="Resume at e.g. 45:30"
                  className={`flex-1 py-3 px-4 rounded-full text-sm text-center outline-none ${startOffset ? 'bg-violet-600/20 border border-violet-500/50 text-white' : 'bg-white/10 border border-white/10 text-slate-400 placeholder-slate-600'}`} />
              </div>
            </div>

            {/* Alerts */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Alerts</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span>🔊</span>
                    <div>
                      <p className="text-white text-sm font-semibold">Voice</p>
                      <p className="text-slate-600 text-xs">Phone speaks mute/skip cues</p>
                    </div>
                  </div>
                  <Toggle on={voiceOn} onToggle={() => setVoiceOn((v) => !v)} label="Voice" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span>🔔</span>
                    <div>
                      <p className="text-white text-sm font-semibold">Notifications</p>
                      <p className="text-slate-600 text-xs">OS banner — desktop & Android</p>
                    </div>
                  </div>
                  {notifPermission === 'unsupported' ? <span className="text-slate-600 text-xs">Not supported</span>
                    : notifPermission === 'granted' ? <Toggle on={notifsEnabled} onToggle={() => setNotifsEnabled((v) => !v)} label="Notifs" />
                    : notifPermission === 'denied' ? <span className="text-slate-600 text-xs">Blocked</span>
                    : <button onClick={handleEnableNotifs} className="text-xs bg-violet-600/20 border border-violet-500/30 text-violet-300 px-3 py-1.5 rounded-full">Enable</button>}
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-5">
              <ol className="space-y-3">
                {[
                  `Open your streaming app and find "${selected.name}"`,
                  startOffset ? `Seek to ${startOffset} in the streaming app` : 'Position to the very beginning',
                  'Turn up phone volume for voice alerts',
                  'Tap below — phone counts 3…2…1… then says "Press Play"',
                ].map((text, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-slate-300 text-sm leading-relaxed">{text}</p>
                  </li>
                ))}
              </ol>
            </div>

            <button onClick={beginCountdown}
              className="w-full bg-violet-600 active:bg-violet-700 text-white font-black text-xl px-8 py-6 rounded-full shadow-xl shadow-violet-900/50">
              Start Countdown →
            </button>
            <p className="text-slate-600 text-xs mt-3 text-center">Hit your remote the moment your phone says "Press Play"</p>
          </div>
        )}

        {/* ── COUNTDOWN ── */}
        {step === 'countdown' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <p className="text-slate-400 text-lg mb-6">Get your remote ready…</p>
            <div className="text-[160px] font-black leading-none tabular-nums text-violet-400">{countdown === 0 ? '▶' : countdown}</div>
            <p className="text-white text-2xl font-bold mt-6">{countdown === 0 ? 'PRESS PLAY NOW!' : countdown === 1 ? 'Almost…' : 'Get ready'}</p>
          </div>
        )}

        {/* ── LIVE ── */}
        {step === 'live' && selected && (
          <div>
            {/* Timer + poster */}
            <div className="flex items-center gap-4 mb-2">
              {poster && <img src={poster} alt="" className="w-14 h-20 object-cover rounded-xl shrink-0 opacity-80" />}
              <div className="flex-1 min-w-0">
                <p className="text-slate-500 text-xs truncate">{selected.name}</p>
                <div className="text-6xl font-black tabular-nums leading-tight">{fmt(elapsed)}</div>
                {runtime > 0 && <p className="text-slate-600 text-xs">of {fmt(runtime)}</p>}
              </div>
            </div>

            {runtime > 0 && (
              <div className="w-full bg-white/5 rounded-full h-1.5 mb-3 overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (elapsed / runtime) * 100)}%` }} />
              </div>
            )}

            {/* Session counter */}
            {(sessionMutes + sessionSkips) > 0 && (
              <div className="flex items-center justify-center gap-3 mb-5">
                {sessionMutes > 0 && (
                  <div className="flex items-center gap-1.5 bg-violet-600/20 border border-violet-500/30 rounded-full px-4 py-1.5">
                    <span className="text-sm">🔇</span>
                    <span className="text-violet-300 font-black text-sm">{sessionMutes}</span>
                    <span className="text-violet-500 text-xs">muted</span>
                  </div>
                )}
                {sessionSkips > 0 && (
                  <div className="flex items-center gap-1.5 bg-rose-600/20 border border-rose-500/30 rounded-full px-4 py-1.5">
                    <span className="text-sm">⏭</span>
                    <span className="text-rose-300 font-black text-sm">{sessionSkips}</span>
                    <span className="text-rose-500 text-xs">skipped</span>
                  </div>
                )}
              </div>
            )}

            {done && (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 mb-5 text-center">
                <p className="text-emerald-400 font-bold text-lg">All done! 🎉</p>
                <p className="text-slate-400 text-sm mt-1">{sessionMutes + sessionSkips} scenes filtered this session</p>
                <p className="text-slate-600 text-xs mt-1">{lifetimeFiltered} total all time</p>
              </div>
            )}

            {upcoming.length > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Coming up</p>
                {upcoming.map((e, i) => <UpcomingRow key={i} event={e} elapsed={elapsed} />)}
              </div>
            )}

            {/* Re-sync */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm font-semibold">Off sync?</p>
                  <p className="text-slate-600 text-xs">Type the timestamp on your streaming app</p>
                </div>
                <button onClick={() => setResyncOpen((v) => !v)}
                  className="text-violet-400 text-sm font-semibold px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-900/20">Re-sync</button>
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
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 mb-4">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Filters</p>
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
              className={`flex-1 font-bold py-4 rounded-full text-base ${running ? 'bg-white/10 active:bg-white/20 text-white' : 'bg-violet-600 active:bg-violet-700 text-white'}`}>
              {running ? '⏸  I Paused My Stream' : '▶  Resume'}
            </button>
            <button onClick={handleReset} className="bg-white/5 active:bg-white/10 text-slate-400 font-semibold py-4 px-5 rounded-full">↺</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Small helper component to avoid repetition in filter screen
function TitleHeaderInfo({ selected, metaLoading }: { selected: SelectedTitle; metaLoading: boolean }) {
  return (
    <div>
      <h1 className="text-2xl font-black leading-tight">{selected.name}</h1>
      <div className="flex items-center gap-2 flex-wrap mt-2">
        {selected.year && <span className="text-slate-400 text-sm">{selected.year}</span>}
        {selected.contentRating && <RatingBadge rating={selected.contentRating} />}
        {selected.meta?.rating && <StarRating value={selected.meta.rating} />}
        {selected.meta?.network && <span className="text-slate-500 text-sm">{selected.meta.network}</span>}
        {selected.meta?.status && <span className="text-xs text-slate-600 bg-white/10 px-2 py-0.5 rounded-full">{selected.meta.status}</span>}
        {metaLoading && <span className="text-xs text-slate-600 animate-pulse">Loading…</span>}
      </div>
      {selected.meta?.genres && selected.meta.genres.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {selected.meta.genres.map((g) => (
            <span key={g} className="text-xs text-slate-400 bg-white/10 border border-white/10 px-2.5 py-0.5 rounded-full">{g}</span>
          ))}
        </div>
      )}
    </div>
  );
}
