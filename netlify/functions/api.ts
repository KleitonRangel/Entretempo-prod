import { builder, type HandlerEvent, type HandlerResponse } from "@netlify/functions";
import { getScreenDetails, searchScreen } from "../../server/providers/cinemeta.js";
import { getSeasonCovers } from "../../server/providers/tvmaze.js";

function parseQuery(path: string): Record<string, string> {
  const params: Record<string, string> = {};
  const queryStart = path.indexOf("?");
  if (queryStart === -1) return params;
  const queryString = path.slice(queryStart + 1);
  for (const pair of queryString.split("&")) {
    const [key, value] = pair.split("=");
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || "");
  }
  return params;
}

function jsonResponse(data: unknown, statusCode = 200, extraHeaders: Record<string, string> = {}): HandlerResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(data),
  };
}

async function apiHandler(event: HandlerEvent): Promise<HandlerResponse> {
  const { path, httpMethod } = event;
  const query = parseQuery(path);

  if (httpMethod !== "GET") {
    return jsonResponse({ error: `Método não suportado: ${httpMethod}` }, 405);
  }

  // Health check
  if (path === "/api/health") {
    return jsonResponse({ ok: true, service: "entretempo", time: new Date().toISOString() });
  }

  // Search endpoint
  if (path === "/api/search") {
    const type = query.type ?? "";
    const rawQuery = query.q ?? "";
    const queryText = rawQuery.trim().slice(0, 120);

    if (!["game", "movie", "series"].includes(type)) {
      return jsonResponse({ error: "Tipo inválido. Use game, movie ou series." }, 400);
    }

    if (queryText.length < 2) {
      return jsonResponse({ error: "Digite pelo menos 2 caracteres para buscar." }, 400);
    }

    try {
      const results =
        type === "game"
          ? [] // HLTB still blocked, return empty for now
          : await searchScreen(queryText, type === "movie" ? "movie" : "series");

      return jsonResponse({ results }, 200, { "cache-control": "public, max-age=300" });
    } catch (error) {
      console.error(`[search:${type}]`, error);
      return jsonResponse(
        { error: "A busca não respondeu agora. Tente de novo ou cadastre manualmente." },
        502
      );
    }
  }

  // Details endpoint
  if (path === "/api/details") {
    const type = query.type ?? "";
    const id = (query.id ?? "").trim();

    if (type !== "movie" && type !== "series") {
      return jsonResponse({ error: "Tipo inválido. Use movie ou series." }, 400);
    }

    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) {
      return jsonResponse({ error: "Identificador inválido." }, 400);
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

      return jsonResponse({ details: withCovers }, 200, { "cache-control": "public, max-age=3600" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/metadados/i.test(message)) {
        return jsonResponse(
          {
            error:
              "Esse título não tem episódios cadastrados no IMDb. Confira se escolheu a versão certa (o ano ajuda) ou use a entrada manual.",
          },
          404
        );
      }
      console.error(`[details:${type}]`, error);
      return jsonResponse({ error: "Não foi possível carregar os detalhes desse título." }, 502);
    }
  }

  // Image proxy endpoint
  if (path === "/api/image") {
    const rawUrl = query.url ?? "";
    try {
      const urlObj = new URL(rawUrl);
      if (urlObj.protocol !== "https:" && urlObj.protocol !== "http:") {
        return jsonResponse({ error: "Endereço de imagem inválido." }, 400);
      }

      const blockedHosts = [
        "localhost",
        "0.0.0.0",
        "::1",
      ];
      const isBlocked =
        urlObj.hostname === "localhost" ||
        urlObj.hostname.endsWith(".localhost") ||
        blockedHosts.some((h) => urlObj.hostname.startsWith(h)) ||
        /^127\./.test(urlObj.hostname) ||
        /^10\./.test(urlObj.hostname) ||
        /^192\.168\./.test(urlObj.hostname) ||
        /^169\.254\./.test(urlObj.hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(urlObj.hostname);

      if (isBlocked) {
        return jsonResponse({ error: "Esse endereço não pode ser usado." }, 400);
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

      if (!response.ok) {
        return { statusCode: response.status, headers: {}, body: "" };
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        return { statusCode: 415, headers: {}, body: "" };
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      return {
        statusCode: 200,
        headers: {
          "Content-Type": contentType,
          "cache-control": "public, max-age=604800, immutable",
        },
        body: buffer.toString("base64"),
      };
    } catch (error) {
      console.warn("[image]", error instanceof Error ? error.message : error);
      return jsonResponse({ error: "Falha ao carregar imagem." }, 400);
    }
  }

  // Not found
  return jsonResponse({ error: `Rota não encontrada: ${path}` }, 404);
}

export default builder(apiHandler);
