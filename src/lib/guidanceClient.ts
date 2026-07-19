// Client-side beta helpers for the decision card: a per-device daily request
// limit and a "has this visitor seen guidance for this title?" signal for the
// key business metric (title_marked_after_guidance).
//
// HONEST LIMITATION: with no accounts and no database, a browser-only limit
// reduces casual overuse but cannot securely stop deliberate circumvention
// (clearing storage resets it). The server keeps its own instance-level
// daily/budget gates (src/lib/guidance/usage.ts) as the backstop.

export const DEVICE_USAGE_KEY = "wnw.guidance.usage.v1";
export const DEVICE_DAILY_LIMIT = 10; // decision cards per device per day during beta

export interface DeviceUsage {
  day: string; // UTC yyyy-mm-dd
  count: number;
}

export const todayKey = (now: Date = new Date()) => now.toISOString().slice(0, 10);

/** Parse untrusted storage data; anything malformed resets to zero-for-today. */
export function parseDeviceUsage(raw: unknown, today: string): DeviceUsage {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (o.day === today && typeof o.count === "number" && Number.isFinite(o.count) && o.count >= 0) {
      return { day: today, count: Math.floor(o.count) };
    }
  }
  return { day: today, count: 0 };
}

export function underDeviceLimit(usage: DeviceUsage, limit: number = DEVICE_DAILY_LIMIT): boolean {
  return usage.count < limit;
}

export function incrementDeviceUsage(usage: DeviceUsage): DeviceUsage {
  return { day: usage.day, count: usage.count + 1 };
}

// ---- localStorage wiring (browser only) ----------------------------------

export function readDeviceUsage(now: Date = new Date()): DeviceUsage {
  const today = todayKey(now);
  if (typeof window === "undefined") return { day: today, count: 0 };
  try {
    const raw = window.localStorage.getItem(DEVICE_USAGE_KEY);
    return parseDeviceUsage(raw ? JSON.parse(raw) : null, today);
  } catch {
    return { day: today, count: 0 };
  }
}

export function recordDeviceRequest(now: Date = new Date()): DeviceUsage {
  const next = incrementDeviceUsage(readDeviceUsage(now));
  try {
    window.localStorage.setItem(DEVICE_USAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

// ---- guidance-seen signal (session only, for analytics) ------------------

const SEEN_KEY = "wnw.guidance.seen.v1";

export function markGuidanceSeen(titleId: string) {
  if (typeof window === "undefined") return;
  try {
    const set = new Set<string>(JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? "[]"));
    set.add(titleId);
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function wasGuidanceSeen(titleId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]).includes(titleId);
  } catch {
    return false;
  }
}
