// Per-device + per-IP daily counters for AI generations. In-memory and
// per-server-instance — honest about what that means: on serverless, each
// warm instance counts separately, so this bounds cost per instance rather
// than being a precise global meter. The entitlement gate and the daily
// limit together keep worst-case spend small; a durable store can replace
// `counters` later without changing callers.

interface Counter {
  day: string; // YYYY-MM-DD (UTC)
  count: number;
}

const counters = new Map<string, Counter>();
const MAX_KEYS = 5000; // bound memory on long-lived instances

function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function bump(key: string, limit: number, now: Date): boolean {
  const day = today(now);
  const c = counters.get(key);
  if (!c || c.day !== day) {
    if (counters.size >= MAX_KEYS) counters.clear();
    counters.set(key, { day, count: 1 });
    return true;
  }
  if (c.count >= limit) return false;
  c.count += 1;
  return true;
}

/**
 * Consume one AI generation for this device (and IP as a backstop against
 * device-id churn). Returns false when either bucket is exhausted.
 * IP buckets get 4x the device limit so shared networks aren't starved.
 */
export function consumeAIGeneration(
  deviceId: string,
  ip: string,
  dailyLimit: number,
  now: Date = new Date(),
): boolean {
  const deviceOk = bump(`d:${deviceId}`, dailyLimit, now);
  if (!deviceOk) return false;
  if (ip && !bump(`ip:${ip}`, dailyLimit * 4, now)) return false;
  return true;
}

/** Test hook. */
export function resetRateLimits(): void {
  counters.clear();
}
