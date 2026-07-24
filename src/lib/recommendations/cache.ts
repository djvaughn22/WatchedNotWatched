// AI-response cache + in-flight deduplication, keyed by a hash of the
// normalized taste profile, mode, and candidate set. Two devices with the
// same taste asking for the same board share one AI call; a double-tap on
// Refresh never bills twice. In-memory, per-instance, small and bounded.

import { createHash } from "node:crypto";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — taste changes slowly
const MAX_ENTRIES = 500;

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** Stable key from anything JSON-serializable (arrays pre-sorted by caller). */
export function recCacheKey(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function getCached<T>(key: string, now = Date.now()): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < now) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function setCached<T>(key: string, value: T, now = Date.now()): void {
  if (cache.size >= MAX_ENTRIES) {
    // Drop the oldest half rather than tracking LRU precisely.
    const keys = [...cache.keys()].slice(0, MAX_ENTRIES / 2);
    for (const k of keys) cache.delete(k);
  }
  cache.set(key, { value, expiresAt: now + TTL_MS });
}

/**
 * Run `work` once per key even under concurrent identical requests; all
 * callers share the same promise. Failures are not cached.
 */
export async function dedupe<T>(key: string, work: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = work().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Test hook. */
export function resetRecCache(): void {
  cache.clear();
  inflight.clear();
}
