interface AttemptRecord {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_TRACKED_CLIENTS = 1_000;
const attempts = new Map<string, AttemptRecord>();

function pruneExpired(now: number): void {
  for (const [key, record] of attempts) {
    if (record.resetAt <= now) {
      attempts.delete(key);
    }
  }

  if (attempts.size > MAX_TRACKED_CLIENTS) {
    const overflow = attempts.size - MAX_TRACKED_CLIENTS;
    for (const key of [...attempts.keys()].slice(0, overflow)) {
      attempts.delete(key);
    }
  }
}

export function checkLoginRateLimit(clientKey: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  pruneExpired(now);
  const record = attempts.get(clientKey);
  if (!record || record.count < MAX_ATTEMPTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
  };
}

export function recordLoginFailure(clientKey: string): void {
  const now = Date.now();
  const current = attempts.get(clientKey);
  if (!current || current.resetAt <= now) {
    attempts.set(clientKey, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
}

export function clearLoginFailures(clientKey: string): void {
  attempts.delete(clientKey);
}
