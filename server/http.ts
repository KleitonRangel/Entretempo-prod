const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return Promise.resolve(hit.value as T);
  }

  const running = inFlight.get(key);
  if (running) return running as Promise<T>;

  const task = load()
    .then((value) => {
      cache.set(key, { expiresAt: Date.now() + ttlMs, value });
      if (cache.size > 200) {
        const now = Date.now();
        for (const [entryKey, entry] of cache) {
          if (entry.expiresAt <= now) cache.delete(entryKey);
        }
      }
      return value;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, task);
  return task;
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", USER_AGENT);
  if (!headers.has("accept")) headers.set("accept", "application/json, text/plain, */*");

  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new UpstreamError(response.status, body.slice(0, 300));
  }

  return (await response.json()) as T;
}

export class UpstreamError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`Upstream respondeu ${status}`);
    this.name = "UpstreamError";
    this.status = status;
    this.body = body;
  }
}

export function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clampText(value: unknown, max = 600): string {
  return String(value ?? "").slice(0, max);
}
