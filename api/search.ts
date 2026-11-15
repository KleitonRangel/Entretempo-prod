// Vercel Serverless Function — /api/search (GET)
const HLTB_BASE = "https://howlongtobeat.com";
<<<<<<< HEAD
const CINEMETA_SEARCH = "https://v3-cinemeta.strem.io/catalog/";
=======
const CINEMETA_SEARCH = "https://api.cinemeta.io/v1/search/";
>>>>>>> 13cb448 (feat: individual route files with full inline logic for Vercel Node.js)

let hltbToken: { token: string; expiresAt: number } | null = null;

async function getHltbToken(force?: boolean): Promise<string> {
  const now = Date.now();
  if (!force && hltbToken && hltbToken.expiresAt > now) return hltbToken.token;
  const initRes = await fetch(HLTB_BASE + "/api/search/site/init?t=" + now, {
    headers: { referer: HLTB_BASE + "/", origin: HLTB_BASE },
    signal: AbortSignal.timeout(10000)
  });
  if (!initRes.ok) throw new Error("Failed to get HL TB token");
  const data = await initRes.json();
  if (!data.token) throw new Error("HowLongToBeat did not return a search token.");
  hltbToken = { token: data.token, expiresAt: now + 8 * 60 * 1000 };
  return data.token;
}

async function getHltbGames(query: string): Promise<any[]> {
  try {
    let tkn = await getHltbToken(false);
    const body = JSON.stringify({
      searchType: "games", searchTerms: query.trim().split(/\s+/).filter(Boolean),
      searchPage: 1, size: 10,
      searchOptions: {
        games: { userId: 0, platform: { mode: "include", values: [] }, sortCategory: "popular",
          rangeCategory: "main", rangeTime: { min: 0, max: 0 },
          gameplay: { perspective: { mode: "include", values: [] }, flow: { mode: "include", values: [] }, genre: { mode: "include", values: [] } },
          modifier: "" }, users: { sortCategory: "postcount" }, lists: { sortCategory: "follows" },
        filter: "", sort: 0, randomizer: 0
      }, useCache: true
    });
    let res = await fetch(HLTB_BASE + "/api/search/site", {
      method: "POST", headers: { "content-type": "application/json", "x-auth-token": tkn, origin: HLTB_BASE, referer: HLTB_BASE + "/" }, body, signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) { tkn = await getHltbToken(true); res = await fetch(HLTB_BASE + "/api/search/site", { method: "POST", headers: { "content-type": "application/json", "x-auth-token": tkn, origin: HLTB_BASE, referer: HLTB_BASE + "/" }, body, signal: AbortSignal.timeout(15000) }); if (!res.ok) throw new Error("HowLongToBeat search failed"); }
    return parseHltbResults(await res.json());
  } catch (e) { console.error("[hltb]", e); return []; }
}

function parseHltbResults(data: any): any[] {
  if (!data.data || !Array.isArray(data.data)) return [];
<<<<<<< HEAD
  return data.data.map(function(game: any) {
    const image = game.game_image; let coverUrl = "";
    if (image) { if (image.startsWith("http")) { coverUrl = image; } else { const suffix = image.includes("?") ? "&" : "?"; coverUrl = HLTB_BASE + "/games/" + image + suffix + "width=400"; } }
    return { id: String(game.game_id), type: "game", title: game.game_name, year: (game.release_world && game.release_world > 0) ? game.release_world : null, coverUrl, thumbUrl: image ? (image.startsWith("http") ? image + "?width=200" : HLTB_BASE + "/games/" + image + "?width=200") : "", source: "HowLongToBeat", externalUrl: HLTB_BASE + "/game/" + game.game_id, platforms: game.profile_platform ? game.profile_platform.split(",").map(function(p: string) { return p.trim(); }).filter(Boolean).slice(0, 5) : [], times: { main: secMin(game.comp_main), mainExtra: secMin(game.comp_plus), completionist: secMin(game.comp_100) } };
  }).filter(function(g: any) { return g.title; });
=======
  return data.data.map(function(game) {
    const image = game.game_image; let coverUrl = "";
    if (image) { if (image.startsWith("http")) { coverUrl = image; } else { const suffix = image.includes("?") ? "&" : "?"; coverUrl = HLTB_BASE + "/games/" + image + suffix + "width=400"; } }
    return { id: String(game.game_id), type: "game", title: game.game_name, year: (game.release_world && game.release_world > 0) ? game.release_world : null, coverUrl, thumbUrl: image ? (image.startsWith("http") ? image + "?width=200" : HLTB_BASE + "/games/" + image + "?width=200") : "", source: "HowLongToBeat", externalUrl: HLTB_BASE + "/game/" + game.game_id, platforms: game.profile_platform ? game.profile_platform.split(",").map(function(p) { return p.trim(); }).filter(Boolean).slice(0, 5) : [], times: { main: secMin(game.comp_main), mainExtra: secMin(game.comp_plus), completionist: secMin(game.comp_100) } };
  }).filter(function(g) { return g.title; });
>>>>>>> 13cb448 (feat: individual route files with full inline logic for Vercel Node.js)
}

function secMin(value?: number): number | null { const s = Number(value); if (!s || s <= 0) return null; return Math.round(s / 60); }

<<<<<<< HEAD
async function getCinemetaResults(query: string, typeFilter: "movie" | "series"): Promise<any[]> {
  try {
    const res = await fetch(CINEMETA_SEARCH + typeFilter + "/top/search=" + encodeURIComponent(query) + ".json", {
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error("Cinemeta search failed");
    const data = await res.json();
    
    return (data.metas || []).filter(function(m: any) { return m.id && m.name; }).slice(0, 10).map(function(item: any) {
      const posterUrl = item.poster || "";
      const thumbUrl = posterUrl.replace("/poster/small/", "/poster/medium/") || "";
      // Extract year from releaseInfo (e.g. "2010" or "2008–2013")
      let year: number | null = null;
      if (item.releaseInfo) {
        const match = item.releaseInfo.match(/^(\d{4})/);
        if (match) year = parseInt(match[1]);
      }
      
      return {
        id: item.id || "",
        type: item.type === "series" ? "series" : "movie",
        title: item.name || "Unknown",
        year: year,
        coverUrl: posterUrl,
        thumbUrl: thumbUrl,
        source: "Cinemeta",
        externalUrl: "https://www.imdb.com/title/" + (item.id || "") + "/",
        description: "" // Will be filled by /api/details
      };
    });
  } catch (e) { console.error("[cinemeta-search:" + typeFilter + "]", e); return []; }
=======
async function getCinemetaResults(query: string, type: string): Promise<any[]> {
  try {
    const res = await fetch(CINEMETA_SEARCH + type + "?query=" + encodeURIComponent(query), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error("Cinemeta search failed for " + type);
    const data = await res.json();
    return (data.results || []).map(function(item) {
      return { id: item.imdbId, type: type === "movie" ? "movie" : "series", title: item.name || item.title || "Unknown", year: item.year || null, coverUrl: item.poster || "", thumbUrl: item.thumb || "", source: "Cinemeta", externalUrl: "https://www.imdb.com/title/" + item.imdbId + "/", description: item.plot || "" };
    });
  } catch (e) { console.error("[cinemeta:" + type + "]", e); return []; }
>>>>>>> 13cb448 (feat: individual route files with full inline logic for Vercel Node.js)
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
  if (!["game", "movie", "series"].includes(type!)) { return new Response(JSON.stringify({ error: "Tipo inválido." }), { headers: { 'content-type': 'application/json' } }); }
  if (query.length < 2) { return new Response(JSON.stringify({ error: "Digite pelo menos 2 caracteres." }), { headers: { 'content-type': 'application/json' } }); }
<<<<<<< HEAD
  
  let searchPromise: Promise<any[]>;
  if (type === "game") {
    searchPromise = getHltbGames(query);
  } else if (type === "movie" || type === "series") {
    // Use Cinemeta for movie/series search — no API key needed
    searchPromise = getCinemetaResults(query, type! as "movie" | "series");
  } else {
    searchPromise = Promise.resolve([]);
  }
  
=======
  const searchPromise = type === "game" ? getHltbGames(query) : getCinemetaResults(query, type);
>>>>>>> 13cb448 (feat: individual route files with full inline logic for Vercel Node.js)
  return searchPromise.then(function(results) {
    return new Response(JSON.stringify({ results }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
  }).catch(function(e) { console.error("[search:" + type + "]", e); return new Response(JSON.stringify({ error: "Falha na busca." }), { headers: { 'content-type': 'application/json' }, status: 502 }); });
}
