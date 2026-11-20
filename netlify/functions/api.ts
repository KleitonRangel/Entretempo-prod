import { getScreenDetails, searchScreen } from "../../server/providers/cinemeta.js";
import { getSeasonCovers } from "../../server/providers/tvmaze.js";
import { clientIp, createRateLimiter } from "../../server/rate-limit.js";

const ALLOWED_ORIGINS = new Set([
  "https://entretempo-app.netlify.app",
  "http://localhost:5173",
  "http://localhost:8787",
]);

const limiter = createRateLimiter({ limit: 240, windowMs: 60_000 });

const PLACEHOLDER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <rect width="400" height="600" fill="#1a1a2e"/>
  <circle cx="200" cy="250" r="80" fill="none" stroke="#5b4bb7" stroke-width="3"/>
  <polygon points="180,210 260,250 180,290" fill="#5b4bb7"/>
  <text x="200" y="400" text-anchor="middle" fill="#8a8abf" font-family="sans-serif" font-size="18">Sem imagem</text>
</svg>`;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return { vary: "origin" };
  }

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
}

function baseHeaders(request: Request): Record<string, string> {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...corsHeaders(request),
  };
}

function jsonResponse(
  request: Request,
  data: unknown,
  statusCode = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    ...baseHeaders(request),
    ...extraHeaders,
  });
  return new Response(JSON.stringify(data), { status: statusCode, headers });
}

function svgResponse(request: Request): Response {
  return new Response(PLACEHOLDER_SVG, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      ...baseHeaders(request),
    },
  });
}

function corsOptions(request: Request): Response {
  return new Response("", {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function apiHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const httpMethod = request.method.toUpperCase();
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    query[key] = value;
  }

  // CORS preflight
  if (httpMethod === "OPTIONS") {
    return corsOptions(request);
  }

  // Limite de requisições por IP (melhor esforço por instância).
  const rate = limiter(clientIp(request.headers));
  if (!rate.allowed) {
    return jsonResponse(
      request,
      { error: "Muitas requisições. Aguarde alguns segundos e tente de novo." },
      429,
      { "retry-after": String(rate.retryAfter) },
    );
  }

  if (httpMethod !== "GET") {
    return jsonResponse(request, { error: `Método não suportado: ${httpMethod}` }, 405);
  }

  // Health check
  if (path === "/api/health") {
    return jsonResponse(request, {
      ok: true,
      service: "entretempo",
      time: new Date().toISOString(),
    });
  }

  // Search endpoint
  if (path === "/api/search") {
    const type = query.type ?? "";
    const rawQuery = query.q ?? "";
    const queryText = rawQuery.trim().slice(0, 120);

    if (!["game", "movie", "series"].includes(type)) {
      return jsonResponse(request, { error: "Tipo inválido. Use game, movie ou series." }, 400);
    }

    if (queryText.length < 2) {
      return jsonResponse(
        request,
        { error: "Digite pelo menos 2 caracteres para buscar." },
        400,
      );
    }

    try {
      const results =
        type === "game"
          ? [] // HLTB still blocked, return empty for now
          : await searchScreen(queryText, type === "movie" ? "movie" : "series");

      return jsonResponse(request, { results }, 200, { "cache-control": "public, max-age=300" });
    } catch (error) {
      console.error(`[search:${type}]`, error);
      return jsonResponse(
        request,
        { error: "A busca não respondeu agora. Tente de novo ou cadastre manualmente." },
        502,
      );
    }
  }

  // Details endpoint
  if (path === "/api/details") {
    const type = query.type ?? "";
    const id = (query.id ?? "").trim();

    if (type !== "movie" && type !== "series") {
      return jsonResponse(request, { error: "Tipo inválido. Use movie ou series." }, 400);
    }

    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) {
      return jsonResponse(request, { error: "Identificador inválido." }, 400);
    }

    try {
      const [details, seasonCovers] = await Promise.all([
        getScreenDetails(id, type as "movie" | "series"),
        type === "series" ? getSeasonCovers(id) : Promise.resolve({} as Record<string, string>),
      ]);

      const withCovers = {
        ...details,
        seasonEpisodes: details.seasonEpisodes.map((entry) => ({
          ...entry,
          coverUrl: seasonCovers[String(entry.season)] ?? null,
        })),
      };

      return jsonResponse(request, { details: withCovers }, 200, {
        "cache-control": "public, max-age=3600",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/metadados/i.test(message)) {
        return jsonResponse(
          request,
          {
            error:
              "Esse título não tem episódios cadastrados no IMDb. Confira se escolheu a versão certa (o ano ajuda) ou use a entrada manual.",
          },
          404,
        );
      }
      console.error(`[details:${type}]`, error);
      return jsonResponse(
        request,
        { error: "Não foi possível carregar os detalhes desse título." },
        502,
      );
    }
  }

  // Image proxy endpoint
  if (path === "/api/image") {
    const rawUrl = (query.url ?? "").slice(0, 2048);

    try {
      const urlObj = new URL(rawUrl);
      if (urlObj.protocol !== "https:" && urlObj.protocol !== "http:") {
        return jsonResponse(request, { error: "Endereço de imagem inválido." }, 400);
      }

      const host = urlObj.hostname.toLowerCase();
      const isBlocked =
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host === "0.0.0.0" ||
        host === "::1" ||
        host === "[::1]" ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
        /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host);

      if (isBlocked) {
        return jsonResponse(request, { error: "Esse endereço não pode ser usado." }, 400);
      }

      const response = await fetch(rawUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) return svgResponse(request);

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        return jsonResponse(request, { error: "O endereço não aponta para uma imagem." }, 415);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > 12 * 1024 * 1024) {
        return jsonResponse(request, { error: "Imagem grande demais." }, 413);
      }

      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "cache-control": "public, max-age=604800, immutable",
          ...baseHeaders(request),
        },
      });
    } catch (error) {
      console.warn("[image]", error instanceof Error ? error.message : error);
      return svgResponse(request);
    }
  }

  // Not found
  return jsonResponse(request, { error: `Rota não encontrada: ${path}` }, 404);
}

export default apiHandler;
