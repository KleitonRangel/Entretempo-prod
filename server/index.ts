import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getScreenDetails, searchScreen } from "./providers/cinemeta.js";
import { searchGames, warmUpHowLongToBeat } from "./providers/hltb.js";
import { getSeasonCovers } from "./providers/tvmaze.js";

const app = express();
const port = Number(process.env.API_PORT || 8787);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

app.disable("x-powered-by");

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "entretempo", time: new Date().toISOString() });
});

app.get("/api/search", async (request, response) => {
  const type = String(request.query.type ?? "");
  const query = String(request.query.q ?? "").trim().slice(0, 120);

  if (!["game", "movie", "series"].includes(type)) {
    response.status(400).json({ error: "Tipo inválido. Use game, movie ou series." });
    return;
  }

  if (query.length < 2) {
    response.status(400).json({ error: "Digite pelo menos 2 caracteres para buscar." });
    return;
  }

  try {
    const results =
      type === "game"
        ? await searchGames(query)
        : await searchScreen(query, type === "movie" ? "movie" : "series");

    response.setHeader("cache-control", "public, max-age=300");
    response.json({ results });
  } catch (error) {
    console.error(`[search:${type}]`, error);
    response.status(502).json({
      error: "A busca não respondeu agora. Tente de novo ou cadastre manualmente.",
    });
  }
});

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

type CachedImage = {
  buffer: Buffer;
  contentType: string;
  expiresAt: number;
};

const IMAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IMAGE_CACHE_MAX_BYTES = 64 * 1024 * 1024;
const imageCache = new Map<string, CachedImage>();
const imageInFlight = new Map<string, Promise<CachedImage>>();
let imageCacheBytes = 0;

class ImageResponseError extends Error {
  status: number;

  constructor(status: number) {
    super(`Imagem indisponível (${status})`);
    this.status = status;
  }
}

function evictImages(): void {
  while (imageCacheBytes > IMAGE_CACHE_MAX_BYTES) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = imageCache.get(oldestKey);
    imageCache.delete(oldestKey);
    if (oldest) imageCacheBytes -= oldest.buffer.byteLength;
  }
}

async function fetchImage(url: URL): Promise<CachedImage> {
  const upstream = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      referer: url.hostname.includes("howlongtobeat.com") ? "https://howlongtobeat.com/" : url.origin,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!upstream.ok) throw new ImageResponseError(502);

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) throw new ImageResponseError(415);

  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.byteLength > 12 * 1024 * 1024) throw new ImageResponseError(413);

  return { buffer, contentType, expiresAt: Date.now() + IMAGE_TTL_MS };
}

async function getImage(url: URL): Promise<CachedImage> {
  const key = url.toString();
  const cached = imageCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    // Reinsere no fim para manter o mais usado por último no LRU.
    imageCache.delete(key);
    imageCache.set(key, cached);
    return cached;
  }

  if (cached) {
    imageCache.delete(key);
    imageCacheBytes -= cached.buffer.byteLength;
  }

  const pending = imageInFlight.get(key);
  if (pending) return pending;

  const task = fetchImage(url)
    .then((entry) => {
      imageCache.set(key, entry);
      imageCacheBytes += entry.buffer.byteLength;
      evictImages();
      return entry;
    })
    .finally(() => imageInFlight.delete(key));

  imageInFlight.set(key, task);
  return task;
}

app.get("/api/image", async (request, response) => {
  const raw = String(request.query.url ?? "");

  try {
    const url = new URL(raw);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      response.status(400).json({ error: "Endereço de imagem inválido." });
      return;
    }

    if (isBlockedHost(url.hostname)) {
      response.status(400).json({ error: "Esse endereço não pode ser usado." });
      return;
    }

    const image = await getImage(url);

    response.setHeader("content-type", image.contentType);
    response.setHeader("cache-control", "public, max-age=604800, immutable");
    response.send(image.buffer);
  } catch (error) {
    if (error instanceof ImageResponseError) {
      response.status(error.status).end();
      return;
    }
    console.warn("[image]", error instanceof Error ? error.message : error);
    response.status(400).end();
  }
});

app.get("/api/details", async (request, response) => {
  const type = String(request.query.type ?? "");
  const id = String(request.query.id ?? "").trim();

  if (type !== "movie" && type !== "series") {
    response.status(400).json({ error: "Tipo inválido. Use movie ou series." });
    return;
  }

  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) {
    response.status(400).json({ error: "Identificador inválido." });
    return;
  }

  try {
    const [details, seasonCovers] = await Promise.all([
      getScreenDetails(id, type),
      type === "series" ? getSeasonCovers(id) : Promise.resolve({} as Record<string, string>),
    ]);

    const withCovers = {
      ...details,
      seasonEpisodes: details.seasonEpisodes.map((entry) => ({
        ...entry,
        coverUrl: seasonCovers[String(entry.season)] ?? null,
      })),
    };

    response.setHeader("cache-control", "public, max-age=3600");
    response.json({ details: withCovers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    // Título sem metadados no Cinemeta: não é falha do servidor.
    if (/metadados/i.test(message)) {
      response.status(404).json({
        error:
          "Esse título não tem episódios cadastrados no IMDb. Confira se escolheu a versão certa (o ano ajuda) ou use a entrada manual.",
      });
      return;
    }

    console.error(`[details:${type}]`, error);
    response.status(502).json({ error: "Não foi possível carregar os detalhes desse título." });
  }
});

const dist = path.join(root, "dist");

if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((request, response, next) => {
    if (request.path.startsWith("/api")) {
      next();
      return;
    }
    response.sendFile(path.join(dist, "index.html"));
  });
}

app.use((request, response) => {
  response.status(404).json({ error: `Rota não encontrada: ${request.method} ${request.path}` });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Entretempo API em http://localhost:${port}`);
  warmUpHowLongToBeat();
  // Mantém o token do HLTB quente enquanto o servidor estiver rodando.
  setInterval(warmUpHowLongToBeat, 6 * 60 * 1000).unref();
});
