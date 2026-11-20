export type RateLimitOptions = {
  /** Máximo de requisições por janela. */
  limit?: number;
  /** Tamanho da janela em milissegundos. */
  windowMs?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Segundos até a próxima requisição ser liberada (0 quando permitida). */
  retryAfter: number;
  remaining: number;
};

type Entry = {
  count: number;
  resetAt: number;
};

/**
 * Limite de requisições em memória (janela fixa). Funciona por instância de
 * função/serverless — suficiente como primeira barreira contra abuso e
 * varredura automatizada. Cache é limpo ao atingir o teto.
 */
export function createRateLimiter({ limit = 60, windowMs = 60_000 }: RateLimitOptions = {}) {
  const hits = new Map<string, Entry>();

  return function check(key: string, now = Date.now()): RateLimitResult {
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 5_000) {
        for (const [entryKey, value] of hits) {
          if (value.resetAt <= now) hits.delete(entryKey);
        }
      }
      return { allowed: true, retryAfter: 0, remaining: limit - 1 };
    }

    if (entry.count >= limit) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
        remaining: 0,
      };
    }

    entry.count += 1;
    return { allowed: true, retryAfter: 0, remaining: limit - entry.count };
  };
}

type HeaderSource = Headers | Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderSource, name: string): string {
  if (headers instanceof Headers) return headers.get(name) ?? "";

  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Extrai o IP do cliente respeitando os cabeçalhos de proxy conhecidos. */
export function clientIp(headers: HeaderSource): string {
  const candidates = [
    readHeader(headers, "x-nf-client-connection-ip"),
    readHeader(headers, "cf-connecting-ip"),
    readHeader(headers, "x-real-ip"),
    readHeader(headers, "x-forwarded-for").split(",")[0]?.trim() ?? "",
  ];

  for (const candidate of candidates) {
    if (candidate) return candidate.slice(0, 64);
  }

  return "unknown";
}
