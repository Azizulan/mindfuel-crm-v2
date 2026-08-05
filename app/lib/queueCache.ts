// ─── Today's Queue result cache ──────────────────────────────────────────────
//
// Building the queue means scanning every eligible customer and scoring them.
// That work is identical for the same agent within a short window, and only a
// handful of agents work on any given day — so we hold the built queue in
// process memory instead of rebuilding it on every page mount.
//
// This is deliberately an in-memory cache, not Redis: the working set is a few
// entries of a few hundred KB, and a cold serverless instance simply rebuilds.
// The cost of a miss is exactly the old behaviour, so a cold start is never
// worse than before.
//
// Invalidated explicitly whenever a write could change the ordering (logging a
// follow-up, editing queue-focus settings, a data sync).

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();

/** Drop every entry whose TTL has passed. Keeps the map from growing. */
function sweep(now: number) {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

export function getCached<T>(key: string): T | null {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached(key: string, value: unknown, ttlMs: number = DEFAULT_TTL_MS): void {
  const now = Date.now();
  sweep(now);
  store.set(key, { value, expiresAt: now + ttlMs });
}

/**
 * Invalidate cached queues. Pass no argument to clear everything (settings
 * changed, bulk sync); pass a prefix to clear one namespace.
 */
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Namespaced key for a built queue. */
export function queueKey(agentId: string, size: number, day: string): string {
  return `queue:${day}:${agentId}:${size}`;
}

/** Today's date in the CRM timezone, as a cache-busting day stamp. */
export function todayStamp(now: Date = new Date()): string {
  const tz = process.env.CRM_TIMEZONE || 'Asia/Dhaka';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
