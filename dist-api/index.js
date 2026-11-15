// server/http.ts
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var cache = /* @__PURE__ */ new Map();
var inFlight = /* @__PURE__ */ new Map();
function cached(key, ttlMs, load) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return Promise.resolve(hit.value);
  }
  const running = inFlight.get(key);
  if (running) return running;
  const task = load().then((value) => {
    cache.set(key, { expiresAt: Date.now() + ttlMs, value });
    if (cache.size > 200) {
      const now = Date.now();
      for (const [entryKey, entry] of cache) {
        if (entry.expiresAt <= now) cache.delete(entryKey);
      }
    }
    return value;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}
async function fetchJson(url, init = {}, timeoutMs = 15e3) {
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", USER_AGENT);
  if (!headers.has("accept")) headers.set("accept", "application/json, text/plain, */*");
  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new UpstreamError(response.status, body.slice(0, 300));
  }
  return await response.json();
}
var UpstreamError = class extends Error {
  status;
  body;
  constructor(status, body) {
    super(`Upstream respondeu ${status}`);
    this.name = "UpstreamError";
    this.status = status;
    this.body = body;
  }
};
function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function clampText(value, max = 600) {
  return String(value ?? "").slice(0, max);
}

// server/providers/hltb.ts
var BASE = "https://howlongtobeat.com";
var TOKEN_TTL_MS = 8 * 60 * 1e3;
var SEARCH_TTL_MS = 15 * 60 * 1e3;
var tokenCache = null;
async function getToken(force = false) {
  if (!force && tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }
  const data = await fetchJson(
    `${BASE}/api/search/site/init?t=${Date.now()}`,
    { headers: { referer: `${BASE}/`, origin: BASE } },
    1e4
  );
  if (!data.token) throw new Error("HowLongToBeat n\xE3o retornou um token de busca.");
  tokenCache = { token: data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return data.token;
}
function normalizeImage(image, width = 400) {
  if (!image) return "";
  if (image.startsWith("http")) return image;
  const suffix = image.includes("?") ? "&" : "?";
  return `${BASE}/games/${image}${suffix}width=${width}`;
}
function secondsToMinutes(value) {
  const seconds = toNumber(value);
  if (!seconds || seconds <= 0) return null;
  return Math.round(seconds / 60);
}
function normalizeGame(game) {
  return {
    id: String(game.game_id),
    type: "game",
    title: game.game_name,
    year: game.release_world && game.release_world > 0 ? game.release_world : null,
    coverUrl: normalizeImage(game.game_image),
    thumbUrl: normalizeImage(game.game_image, 200),
    source: "HowLongToBeat",
    externalUrl: `${BASE}/game/${game.game_id}`,
    platforms: game.profile_platform ? game.profile_platform.split(",").map((platform) => platform.trim()).filter(Boolean).slice(0, 5) : [],
    times: {
      main: secondsToMinutes(game.comp_main),
      mainExtra: secondsToMinutes(game.comp_plus),
      completionist: secondsToMinutes(game.comp_100)
    }
  };
}
async function requestSearch(query, token) {
  const body = {
    searchType: "games",
    searchTerms: query.trim().split(/\s+/).filter(Boolean),
    searchPage: 1,
    size: 10,
    searchOptions: {
      games: {
        userId: 0,
        platform: { mode: "include", values: [] },
        sortCategory: "popular",
        rangeCategory: "main",
        rangeTime: { min: 0, max: 0 },
        gameplay: {
          perspective: { mode: "include", values: [] },
          flow: { mode: "include", values: [] },
          genre: { mode: "include", values: [] }
        },
        modifier: ""
      },
      users: { sortCategory: "postcount" },
      lists: { sortCategory: "follows" },
      filter: "",
      sort: 0,
      randomizer: 0
    },
    useCache: true
  };
  return fetchJson(
    `${BASE}/api/search/site`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-token": token,
        origin: BASE,
        referer: `${BASE}/`
      },
      body: JSON.stringify(body)
    },
    15e3
  );
}
async function searchGames(query) {
  const key = `hltb:${query.toLowerCase()}`;
  return cached(key, SEARCH_TTL_MS, async () => {
    let token = await getToken();
    let response;
    try {
      response = await requestSearch(query, token);
    } catch (error) {
      token = await getToken(true);
      response = await requestSearch(query, token);
    }
    return (response.data ?? []).map(normalizeGame).filter((game) => game.title);
  });
}

// server/providers/cinemeta.ts
var BASE2 = "https://v3-cinemeta.strem.io";
var SEARCH_TTL_MS2 = 30 * 60 * 1e3;
var DETAILS_TTL_MS = 60 * 60 * 1e3;
function parseYear(value) {
  const match = String(value ?? "").match(/\d{4}/);
  return match ? Number(match[0]) : null;
}
function parseRuntime(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  const text = String(value ?? "").toLowerCase();
  if (!text) return null;
  const hours = text.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const minutes = text.match(/(\d+)\s*m/);
  if (hours || minutes) {
    const total = (hours ? Number(hours[1].replace(",", ".")) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
    return total > 0 ? Math.round(total) : null;
  }
  const numeric = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}
function largePoster(url) {
  if (!url) return "";
  return url.replace(/\/poster\/(small|medium)\//, "/poster/large/");
}
function thumbPoster(url) {
  if (!url) return "";
  return url.replace(/\/poster\/(small|large)\//, "/poster/medium/");
}
function normalizeResult(meta, type) {
  const id = meta.imdb_id || meta.id;
  if (!id || !meta.name) return null;
  return {
    id,
    type,
    title: meta.name,
    year: parseYear(meta.releaseInfo ?? meta.year),
    coverUrl: largePoster(meta.poster),
    thumbUrl: thumbPoster(meta.poster),
    source: "Cinemeta",
    externalUrl: `https://www.imdb.com/title/${id}/`,
    description: clampText(meta.description, 280)
  };
}
async function searchScreen(query, type) {
  const key = `cinemeta:${type}:${query.toLowerCase()}`;
  return cached(key, SEARCH_TTL_MS2, async () => {
    const url = `${BASE2}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
    const data = await fetchJson(url, {}, 15e3);
    return (data.metas ?? []).filter((meta) => !meta.type || meta.type === type).map((meta) => normalizeResult(meta, type)).filter((result) => result !== null).slice(0, 10);
  });
}
async function getScreenDetails(id, type) {
  const key = `cinemeta:details:${type}:${id}`;
  return cached(key, DETAILS_TTL_MS, async () => {
    const url = `${BASE2}/meta/${type}/${encodeURIComponent(id)}.json`;
    const data = await fetchJson(url, {}, 15e3);
    const meta = data.meta;
    if (!meta) throw new Error("Metadados n\xE3o encontrados.");
    const seasons = /* @__PURE__ */ new Set();
    const seasonCounts = /* @__PURE__ */ new Map();
    for (const video of meta.videos ?? []) {
      const season = toNumber(video.season);
      const number = toNumber(video.number);
      if (season !== null && number !== null && season > 0 && number > 0) {
        seasons.add(season);
        seasonCounts.set(season, (seasonCounts.get(season) ?? 0) + 1);
      }
    }
    const seasonEpisodes = [...seasonCounts.entries()].sort((first, second) => first[0] - second[0]).map(([season, episodes]) => ({ season, episodes }));
    const episodeCount = seasonEpisodes.reduce((total, entry) => total + entry.episodes, 0);
    const runtime = parseRuntime(meta.runtime);
    const genres = meta.genres ?? meta.genre ?? [];
    return {
      id,
      type,
      runtime,
      episodeMinutes: type === "series" ? runtime : null,
      episodes: episodeCount > 0 ? episodeCount : null,
      seasons: seasons.size > 0 ? seasons.size : null,
      seasonEpisodes,
      description: clampText(meta.description, 1200),
      genres: genres.slice(0, 4),
      rating: meta.imdbRating ? String(meta.imdbRating) : null
    };
  });
}

// server/providers/tvmaze.ts
var BASE3 = "https://api.tvmaze.com";
var SEASON_TTL_MS = 24 * 60 * 60 * 1e3;
function buildSeasonCoverMap(seasons) {
  const map = {};
  for (const season of seasons) {
    const number = Number(season.number);
    const image = season.image?.original || season.image?.medium;
    if (!Number.isInteger(number) || number <= 0 || !image) continue;
    map[String(number)] = image;
  }
  return map;
}
async function requestJson(url) {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
async function getSeasonCovers(imdbId) {
  if (!imdbId) return {};
  return cached(`tvmaze:seasons:${imdbId}`, SEASON_TTL_MS, async () => {
    const show = await requestJson(
      `${BASE3}/lookup/shows?imdb=${encodeURIComponent(imdbId)}`
    );
    if (!show?.id) return {};
    const seasons = await requestJson(`${BASE3}/shows/${show.id}/seasons`);
    return buildSeasonCoverMap(seasons ?? []);
  });
}

// api/index.js
function isBlockedHost(hostname) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" || host === "::1" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}
async function handleSearch(url) {
  const type = url.searchParams.get("type");
  const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
  if (!["game", "movie", "series"].includes(type)) {
    return new Response(JSON.stringify({ error: "Tipo inv\xE1lido. Use game, movie ou series." }), { status: 400 });
  }
  if (query.length < 2) {
    return new Response(JSON.stringify({ error: "Digite pelo menos 2 caracteres para buscar." }), { status: 400 });
  }
  try {
    const results = type === "game" ? await searchGames(query) : await searchScreen(query, type === "movie" ? "movie" : "series");
    return new Response(JSON.stringify({ results }), {
      headers: { "cache-control": "public, max-age=300", "content-type": "application/json" }
    });
  } catch (error) {
    console.error(`[search:${type}]`, error);
    return new Response(JSON.stringify({ error: "A busca n\xE3o respondeu agora. Tente de novo ou cadastre manualmente." }), { status: 502 });
  }
}
async function handleDetails(url) {
  const type = url.searchParams.get("type");
  const id = (url.searchParams.get("id") || "").trim();
  if (type !== "movie" && type !== "series") {
    return new Response(JSON.stringify({ error: "Tipo inv\xE1lido. Use movie ou series." }), { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) {
    return new Response(JSON.stringify({ error: "Identificador inv\xE1lido." }), { status: 400 });
  }
  try {
    const [details, seasonCovers] = await Promise.all([
      getScreenDetails(id, type),
      type === "series" ? getSeasonCovers(id) : Promise.resolve({})
    ]);
    const withCovers = {
      ...details,
      seasonEpisodes: details.seasonEpisodes.map((entry) => ({
        ...entry,
        coverUrl: seasonCovers[String(entry.season)] || null
      }))
    };
    return new Response(JSON.stringify({ details: withCovers }), {
      headers: { "cache-control": "public, max-age=3600", "content-type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/metadados/i.test(message)) {
      return new Response(JSON.stringify({ error: "Esse t\xEDtulo n\xE3o tem epis\xF3dios cadastrados no IMDb. Confira se escolheu a vers\xE3o certa (o ano ajuda) ou use a entrada manual." }), { status: 404 });
    }
    console.error(`[details:${type}]`, error);
    return new Response(JSON.stringify({ error: "N\xE3o foi poss\xEDvel carregar os detalhes desse t\xEDtulo." }), { status: 502 });
  }
}
async function handleImage(url) {
  const raw = url.searchParams.get("url") || "";
  try {
    const imgUrl = new URL(raw);
    if (imgUrl.protocol !== "https:" && imgUrl.protocol !== "http:") {
      return new Response(JSON.stringify({ error: "Endere\xE7o de imagem inv\xE1lido." }), { status: 400 });
    }
    if (isBlockedHost(imgUrl.hostname)) {
      return new Response(JSON.stringify({ error: "Esse endere\xE7o n\xE3o pode ser usado." }), { status: 400 });
    }
    const upstream = await fetch(imgUrl.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        referer: imgUrl.hostname.includes("howlongtobeat.com") ? "https://howlongtobeat.com/" : imgUrl.origin
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15e3)
    });
    if (!upstream.ok) {
      return new Response(null, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return new Response(null, { status: 415 });
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > 12 * 1024 * 1024) {
      return new Response(null, { status: 413 });
    }
    return new Response(buffer, {
      headers: { "content-type": contentType, "cache-control": "public, max-age=604800, immutable" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/abort/i.test(message)) {
      return new Response(null, { status: 504 });
    }
    console.warn("[image]", error instanceof Error ? error.message : error);
    return new Response(null, { status: 400 });
  }
}
async function handler(request) {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    return new Response(JSON.stringify({ ok: true, service: "entretempo", time: (/* @__PURE__ */ new Date()).toISOString() }), {
      headers: { "content-type": "application/json" }
    });
  }
  if (url.pathname === "/api/search") {
    return handleSearch(url);
  }
  if (url.pathname === "/api/details") {
    return handleDetails(url);
  }
  if (url.pathname === "/api/image") {
    return handleImage(url);
  }
  const path = url.pathname;
  if (!path.startsWith("/api")) {
    return new Response(null, { status: 404 });
  }
  return new Response(JSON.stringify({ error: `Rota n\xE3o encontrada: ${request.method} ${url.pathname}` }), { status: 404 });
}
export {
  handler as default
};
