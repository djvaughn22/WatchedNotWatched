// WatchedNotWatched — Filter Engine.
// Player-agnostic. Drives mute / skip / warn from a validated manifest against
// any ControllablePlayer. No network, no uploads: session data stays in memory.
import type {
  ControllablePlayer,
  FilterCategory,
  FilterEvent,
  FilterManifest,
} from "./types";

export interface EngineSettings {
  enabledCategories: Set<FilterCategory>;
  disabledEventIds: Set<string>;
  warnLeadSeconds: number;
}

export interface UpcomingNotice {
  event: FilterEvent;
  secondsUntil: number;
}

export interface AppliedRecord {
  event: FilterEvent;
  atSeconds: number;
}

export interface EngineState {
  activeEvents: FilterEvent[]; // enabled events overlapping the playhead now
  upcoming: UpcomingNotice | null;
  counts: { muted: number; skipped: number; warned: number; total: number };
  appliedEventIds: string[]; // unique ids applied this session
  log: AppliedRecord[];
  muting: boolean; // engine currently holding a mute
}

const EPS = 0.3;

export class FilterEngine {
  private player: ControllablePlayer;
  private manifest: FilterManifest;
  private settings: EngineSettings;

  private unsub: (() => void) | null = null;
  private listeners = new Set<(s: EngineState) => void>();

  private priorMuted: boolean | null = null; // player mute state before we took over
  private handledSkipId: string | null = null;
  private activeWarnIds = new Set<string>();

  private counts = { muted: 0, skipped: 0, warned: 0, total: 0 };
  private appliedIds = new Set<string>();
  private log: AppliedRecord[] = [];
  private lastSignature = "";
  private state: EngineState;

  constructor(
    player: ControllablePlayer,
    manifest: FilterManifest,
    settings?: Partial<EngineSettings>,
  ) {
    this.player = player;
    this.manifest = manifest;
    this.settings = {
      enabledCategories: settings?.enabledCategories ?? defaultEnabledCategories(manifest),
      disabledEventIds: settings?.disabledEventIds ?? defaultDisabledIds(manifest),
      warnLeadSeconds: settings?.warnLeadSeconds ?? 3,
    };
    this.state = this.emptyState();
  }

  start() {
    if (this.unsub) return;
    this.unsub = this.player.onTimeUpdate((t) => this.tick(t));
    this.tick(this.player.getCurrentTime());
  }

  stop() {
    this.unsub?.();
    this.unsub = null;
    this.restoreMute();
  }

  subscribe(cb: (s: EngineState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }

  getState(): EngineState {
    return this.state;
  }

  setSettings(next: Partial<EngineSettings>) {
    this.settings = { ...this.settings, ...next };
    this.tick(this.player.getCurrentTime()); // re-evaluate immediately
  }

  resetSession() {
    this.counts = { muted: 0, skipped: 0, warned: 0, total: 0 };
    this.appliedIds.clear();
    this.log = [];
    this.handledSkipId = null;
    this.activeWarnIds.clear();
    this.tick(this.player.getCurrentTime());
  }

  private enabled(e: FilterEvent): boolean {
    return (
      this.settings.enabledCategories.has(e.category) &&
      !this.settings.disabledEventIds.has(e.id) &&
      Number.isFinite(e.startSeconds) &&
      Number.isFinite(e.endSeconds) &&
      e.endSeconds > e.startSeconds
    );
  }

  private restoreMute() {
    if (this.priorMuted !== null) {
      this.player.setMuted(this.priorMuted);
      this.priorMuted = null;
    }
  }

  private tick(t: number) {
    if (!Number.isFinite(t)) return;
    const events = this.manifest.events.filter((e) => this.enabled(e));

    const active = events.filter((e) => t >= e.startSeconds && t < e.endSeconds);

    // ---- SKIP (take the earliest-ending active skip we haven't just handled)
    const skip = active
      .filter((e) => e.action === "skip" && t < e.endSeconds - EPS)
      .sort((a, b) => a.endSeconds - b.endSeconds)[0];
    if (skip && skip.id !== this.handledSkipId) {
      this.handledSkipId = skip.id;
      this.player.seekTo(skip.endSeconds);
      this.record(skip, "skipped", t);
      return; // seek changes time; next tick re-evaluates
    }
    if (!active.some((e) => e.action === "skip")) this.handledSkipId = null;

    // ---- MUTE (hold while any mute event is active; restore on exit)
    const muteActive = active.some((e) => e.action === "mute");
    if (muteActive && this.priorMuted === null) {
      this.priorMuted = this.player.getMuted();
      this.player.setMuted(true);
      const first = active.find((e) => e.action === "mute")!;
      this.record(first, "muted", t);
    } else if (!muteActive && this.priorMuted !== null) {
      this.restoreMute();
    }

    // ---- WARN (count once per entry)
    const warnNow = new Set(active.filter((e) => e.action === "warn").map((e) => e.id));
    for (const e of active) {
      if (e.action === "warn" && !this.activeWarnIds.has(e.id)) this.record(e, "warned", t);
    }
    this.activeWarnIds = warnNow;

    // ---- UPCOMING notice (nearest enabled event starting within lead window)
    const lead = this.settings.warnLeadSeconds;
    const upcomingEvent = events
      .filter((e) => e.startSeconds > t && e.startSeconds - t <= lead)
      .sort((a, b) => a.startSeconds - b.startSeconds)[0];
    const upcoming: UpcomingNotice | null = upcomingEvent
      ? { event: upcomingEvent, secondsUntil: Math.max(0, Math.ceil(upcomingEvent.startSeconds - t)) }
      : null;

    this.state = {
      activeEvents: active,
      upcoming,
      counts: { ...this.counts },
      appliedEventIds: [...this.appliedIds],
      log: [...this.log],
      muting: this.priorMuted !== null,
    };
    this.maybeEmit(upcoming);
  }

  private record(event: FilterEvent, kind: "muted" | "skipped" | "warned", t: number) {
    this.counts[kind] += 1;
    this.counts.total += 1;
    this.appliedIds.add(event.id);
    this.log.push({ event, atSeconds: t });
  }

  private maybeEmit(upcoming: UpcomingNotice | null) {
    const sig =
      this.state.activeEvents.map((e) => e.id).join(",") +
      "|" +
      (upcoming ? `${upcoming.event.id}:${upcoming.secondsUntil}` : "-") +
      "|" +
      `${this.counts.total}` +
      "|" +
      (this.state.muting ? "1" : "0");
    if (sig !== this.lastSignature) {
      this.lastSignature = sig;
      for (const cb of this.listeners) cb(this.state);
    }
  }

  private emptyState(): EngineState {
    return {
      activeEvents: [],
      upcoming: null,
      counts: { muted: 0, skipped: 0, warned: 0, total: 0 },
      appliedEventIds: [],
      log: [],
      muting: false,
    };
  }
}

export function defaultEnabledCategories(manifest: FilterManifest): Set<FilterCategory> {
  return new Set(manifest.events.map((e) => e.category));
}

export function defaultDisabledIds(manifest: FilterManifest): Set<string> {
  return new Set(manifest.events.filter((e) => e.enabledByDefault === false).map((e) => e.id));
}
