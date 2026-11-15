// Vercel Serverless Function - All API handlers inlined
// No external dependencies needed — works on Node.js runtime

const HLTB_BASE = "https://howlongtobeat.com";
const CINEMETA_SEARCH = "https://api.cinemeta.io/v1/search/";
const CINEMETA_DETAILS = "https://api.cinemeta.io/v1/details/";
const TVMAZE_SEARCH = "https://api.tvmaze.com/search/shows?q=";

// ---- Token cache for HowLongToBeat (shared across invocations) ----
let hltbTokenCache = null;

async function getHltbToken(force = false) {
  const now = Date.now();
  if (!force && hltbTokenCache && hltbTokenCache.expiresAt > now) {
    return hltbTokenCache.token;
  }
  
  const initRes = await fetch(`${HLTB_BASE}/api/search/site/init?t=${now}`, {
    headers: { referer: `${HLTB_BASE}/`, origin: HLTB_BASE },
    signal: AbortSignal.timeout(10_000)
  });
  
  if (!initRes.ok) throw new Error("Failed to get HL TB token");
  const data = await initRes.json();
  if (!data.token) throw new Error("HowLongToBeat did not return a search token.");
  
  hltbTokenCache = { token: data.token, expiresAt: now + 8 * 60 * 1000 };
  return data.token;
}

async function searchHltbGames(query) {
  const key = `hltb:${query.toLowerCase()}`;
  
  try {
    let token = await getHltbToken();
    
    const body = JSON.stringify({
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
    });

    const res = await fetch(`${HLTB_BASE}/api/search/site`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-token": token,
        origin: HLTB_BASE,
        referer: `${HLTB_BASE}/`
      },
      body,
      signal: AbortSignal.timeout(15_000)
    });

    if (!res.ok) {
      // Token may have expired — retry with fresh token
      token = await getHltbToken(true);
      const res2 = await fetch(`${HLTB_BASE}/api/search/site`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-auth-token": token,
          origin: HLTB_BASE,
          referer: `${HLTB_BASE}/`
        },
        body,
        signal: AbortSignal.timeout(15_000)
      });
      if (!res2.ok) throw new Error("HowLongToBeat search failed");
      return parseHltbResults(await res2.json());
    }

    return parseHltbResults(await res.json());
  } catch (e) {
    console.error("[hltb]", e);
    return [];
  }
}

function parseHltbResults(data) {
  if (!data.data || !Array.isArray(data.data)) return [];
  
  return data.data.map(game => {
    const image = game.game_image;
    let coverUrl = "";
    if (image) {
      if (image.startsWith("http")) {
        coverUrl = image;
      } else {
        const suffix = image.includes("?") ? "&" : "?";
        coverUrl = `${HLTB_BASE}/games/${image}${suffix}width=400`;
      }
    }
    
    return {
      id: String(game.game_id),
      type: "game",
      title: game.game_name,
      year: (game.release_world && game.release_world > 0) ? game.release_world : null,
      coverUrl,
      thumbUrl: image ? 
        (image.startsWith("http") ? `${image}?width=200` : `${HLTB_BASE}/games/${image}?width=200`) 
        : "",
      source: "HowLongToBeat",
      externalUrl: `${HLTB_BASE}/game/${game.game_id}`,
      platforms: game.profile_platform 
        ? game.profile_platform.split(",").map(p => p.trim()).filter(Boolean).slice(0, 5) 
        : [],
      times: {
        main: secondsToMinutes(game.comp_main),
        mainExtra: secondsToMinutes(game.comp_plus),
        completionist: secondsToMinutes(game.comp_100)
      }
    };
  }).filter(g => g.title);
}

function secondsToMinutes(value) {
  const seconds = Number(value);
  if (!seconds || seconds <= 0) return null;
  return Math.round(seconds / 60);
}

async function searchCinemeta(query, type) {
  try {
    const res = await fetch(`${CINEMETA_SEARCH}${type}?query=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(15_000)
    });
    
    if (!res.ok) throw new Error(`Cinemeta search failed for ${type}`);
    const data = await res.json();
    
    return (data.results || []).map(item => ({
      id: item.imdbId,
      type: type === "movie" ? "movie" : "series",
      title: item.name || item.title || "Unknown",
      year: item.year || null,
      coverUrl: item.poster || "",
      thumbUrl: item.thumb || "",
      source: "Cinemeta",
      externalUrl: `https://www.imdb.com/title/${item.imdbId}/`,
      description: item.plot || ""
    }));
  } catch (e) {
    console.error(`[cinemeta:${type}]`, e);
    return [];
  }
}

async function getScreenDetails(id, type) {
  try {
    const res = await fetch(`${CINEMETA_DETAILS}${type}/${id}`, {
      signal: AbortSignal.timeout(15_000)
    });
    
    if (!res.ok) throw new Error(`Cinemeta details failed for ${type} ${id}`);
    const data = await res.json();
    
    const item = data.result || {};
    return {
      title: item.name || item.title || "Unknown",
      year: item.year || null,
      genres: item.genres || [],
      plot: item.plot || "",
      rating: item.imdbRating ? parseFloat(item.imdbRating) : null,
      poster: item.poster || "",
      backdrop: item.backdrop || "",
      seasonEpisodes: (item.seasons || []).map((season, idx) => ({
        season: idx + 1,
        episodes: season.episodeCount || 0,
        year: season.airYear || null
      }))
    };
  } catch (e) {
    console.error(`[cinemeta-details:${type}]`, e);
    return { title: "Unknown", year: null, genres: [], plot: "", rating: null, poster: "", backdrop: "", seasonEpisodes: [] };
  }
}

async function getTvmazeSeasonCovers(id) {
  try {
    const res = await fetch(`https://api.tvmaze.com/showes/${encodeURIComponent(id)}/episodes`, {
      signal: AbortSignal.timeout(15_000)
    });
    
    if (!res.ok) return {};
    const episodes = await res.json();
    
    const covers = {};
    for (const ep of episodes) {
      const season = String(ep.season);
      if (!covers[season] && ep.image) {
        covers[season] = ep.image.medium || ep.image.original;
      }
    }
    
    return covers;
  } catch (e) {
    console.warn("[tvmaze]", e);
    return {};
  }
}

// ---- Main handler ----
export default async function handler(request) {
  const url = new URL(request.url);
  
  if (url.pathname === "/api/health") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    });
  }

  // /api/search?type=game&q=gta | type=movie&query=something | type=series
  if (url.pathname === "/api/search") {
    const type = url.searchParams.get("type");
    const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
    
    if (!["game", "movie", "series"].includes(type)) {
      return new Response(JSON.stringify({ error: "Tipo inválido." }), { status: 400 });
    }
    if (query.length < 2) {
      return new Response(JSON.stringify({ error: "Digite pelo menos 2 caracteres." }), { status: 400 });
    }

    try {
      const results = type === "game" 
        ? await searchHltbGames(query) 
        : await searchCinemeta(query, type);
      
      return new Response(JSON.stringify({ results }), {
        headers: { 
          "cache-control": "public, max-age=300", 
          "content-type": "application/json" 
        }
      });
    } catch (e) {
      console.error(`[search:${type}]`, e);
      return new Response(JSON.stringify({ error: "Falha na busca." }), { status: 502 });
    }
  }

  // /api/details?type=movie&id=tt1234 | type=series&id=something
  if (url.pathname === "/api/details") {
    const type = url.searchParams.get("type");
    const id = (url.searchParams.get("id") || "").trim();
    
    if (type !== "movie" && type !== "series") {
      return new Response(JSON.stringify({ error: "Tipo inválido." }), { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) {
      return new Response(JSON.stringify({ error: "ID inválido." }), { status: 400 });
    }

    try {
      const [details, seasonCovers] = await Promise.all([
        getScreenDetails(id, type),
        type === "series" ? getTvmazeSeasonCovers(id) : Promise.resolve({})
      ]);
      
      return new Response(JSON.stringify({ 
        details: { 
          ...details, 
          seasonEpisodes: details.seasonEpisodes.map(e => ({ 
            ...e, 
            coverUrl: seasonCovers[String(e.season)] || null 
          })) 
        } 
      }), {
        headers: { 
          "cache-control": "public, max-age=3600", 
          "content-type": "application/json" 
        }
      });
    } catch (e) {
      console.error(`[details:${type}]`, e);
      return new Response(JSON.stringify({ error: "Falha ao carregar detalhes." }), { status: 502 });
    }
  }

  // /api/image?url=https://example.com/image.jpg
  if (url.pathname === "/api/image") {
    const raw = url.searchParams.get("url") || "";
    
    try {
      const imgUrl = new URL(raw);
      
      if (imgUrl.protocol !== "https:" && imgUrl.protocol !== "http:") {
        return new Response(null, { status: 400 });
      }

      const host = imgUrl.hostname.toLowerCase();
      if (host === "localhost" || /^127\./.test(host) || /^10\/.test(host) || /^192\.168\/.test(host)) {
        return new Response(null, { status: 400 });
      }

      const upstream = await fetch(imgUrl.toString(), {
        headers: { 
          "user-agent": "Chrome/131.0", 
          accept: "image/*" 
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000)
      });

      if (!upstream.ok) return new Response(null, { status: 502 });

      const ct = upstream.headers.get("content-type") || "";
      if (!ct.startsWith("image/")) return new Response(null, { status: 415 });

      const buf = await upstream.arrayBuffer();
      
      return new Response(new Uint8Array(buf), {
        headers: { 
          "content-type": ct, 
          "cache-control": "public, max-age=604800" 
        }
      });
    } catch (e) {
      console.warn("[image]", e);
      return new Response(null, { status: 500 });
    }
  }

  return new Response(null, { status: 404 });
}
