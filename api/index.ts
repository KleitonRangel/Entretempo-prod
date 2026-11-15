// Vercel Serverless Function — All API handlers using Web fetch-style exports
// Vercel Node runtime requires named HTTP method exports for Response returns

const HLTB_BASE = "https://howlongtobeat.com";
const CINEMETA_SEARCH = "https://api.cinemeta.io/v1/search/";
const CINEMETA_DETAILS = "https://api.cinemeta.io/v1/details/";

let hltbTokenCache: { token: string; expiresAt: number } | null = null;

async function getHltbToken(force?: boolean): Promise<string> {
  const now = Date.now();
  if (!force && hltbTokenCache && hltbTokenCache.expiresAt > now) {
    return hltbTokenCache.token;
  }

  const initRes = await fetch(HLTB_BASE + "/api/search/site/init?t=" + now, {
    headers: { referer: HLTB_BASE + "/", origin: HLTB_BASE },
    signal: AbortSignal.timeout(10000)
  });

  if (!initRes.ok) throw new Error("Failed to get HL TB token");
  const data = await initRes.json();
  if (!data.token) throw new Error("HowLongToBeat did not return a search token.");

  hltbTokenCache = { token: data.token, expiresAt: now + 8 * 60 * 1000 };
  return data.token;
}

async function searchHltbGames(query: string): Promise<any[]> {
  try {
    let token = await getHltbToken(false);

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

    let res = await fetch(HLTB_BASE + "/api/search/site", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-token": token,
        origin: HLTB_BASE,
        referer: HLTB_BASE + "/"
      },
      body: body,
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      token = await getHltbToken(true);
      res = await fetch(HLTB_BASE + "/api/search/site", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-auth-token": token,
          origin: HLTB_BASE,
          referer: HLTB_BASE + "/"
        },
        body: body,
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error("HowLongToBeat search failed");
    }

    return parseHltbResults(await res.json());
  } catch (e) {
    console.error("[hltb]", e);
    return [];
  }
}

function platformSplit(str: string): string[] {
  return str.split(",").map(function(p) { return p.trim(); }).filter(Boolean).slice(0, 5);
}

function secondsToMinutes(value?: number): number | null {
  const seconds = Number(value);
  if (!seconds || seconds <= 0) return null;
  return Math.round(seconds / 60);
}

function parseHltbResults(data: any): any[] {
  if (!data.data || !Array.isArray(data.data)) return [];

  return data.data.map(function(game) {
    const image = game.game_image;
    let coverUrl = "";
    if (image) {
      if (image.startsWith("http")) {
        coverUrl = image;
      } else {
        const suffix = image.includes("?") ? "&" : "?";
        coverUrl = HLTB_BASE + "/games/" + image + suffix + "width=400";
      }
    }

    return {
      id: String(game.game_id),
      type: "game",
      title: game.game_name,
      year: (game.release_world && game.release_world > 0) ? game.release_world : null,
      coverUrl: coverUrl,
      thumbUrl: image ? (image.startsWith("http") ? image + "?width=200" : HLTB_BASE + "/games/" + image + "?width=200") : "",
      source: "HowLongToBeat",
      externalUrl: HLTB_BASE + "/game/" + game.game_id,
      platforms: game.profile_platform ? platformSplit(game.profile_platform) : [],
      times: {
        main: secondsToMinutes(game.comp_main),
        mainExtra: secondsToMinutes(game.comp_plus),
        completionist: secondsToMinutes(game.comp_100)
      }
    };
  }).filter(function(g) { return g.title; });
}

async function searchCinemeta(query: string, type: string): Promise<any[]> {
  try {
    const res = await fetch(CINEMETA_SEARCH + type + "?query=" + encodeURIComponent(query), {
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) throw new Error("Cinemeta search failed for " + type);
    const data = await res.json();

    return (data.results || []).map(function(item) {
      return {
        id: item.imdbId,
        type: type === "movie" ? "movie" : "series",
        title: item.name || item.title || "Unknown",
        year: item.year || null,
        coverUrl: item.poster || "",
        thumbUrl: item.thumb || "",
        source: "Cinemeta",
        externalUrl: "https://www.imdb.com/title/" + item.imdbId + "/",
        description: item.plot || ""
      };
    });
  } catch (e) {
    console.error("[cinemeta:" + type + "]", e);
    return [];
  }
}

async function getScreenDetails(id: string, type: string): Promise<any> {
  try {
    const res = await fetch(CINEMETA_DETAILS + type + "/" + id, {
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) throw new Error("Cinemeta details failed for " + type + " " + id);
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
      seasonEpisodes: (item.seasons || []).map(function(season, idx) {
        return {
          season: idx + 1,
          episodes: season.episodeCount || 0,
          year: season.airYear || null
        };
      })
    };
  } catch (e) {
    console.error("[cinemeta-details:" + type + "]", e);
    return { title: "Unknown", year: null, genres: [], plot: "", rating: null, poster: "", backdrop: "", seasonEpisodes: [] };
  }
}

async function getTvmazeSeasonCovers(id: string): Promise<Record<string, string>> {
  try {
    const res = await fetch("https://api.tvmaze.com/shows/" + encodeURIComponent(id) + "/episodes", {
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) return {};
    const episodes = await res.json();

    const covers: Record<string, string> = {};
    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
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

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" || host === "::1") return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

function json(data: any, cache?: string): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cache) headers["cache-control"] = cache;
  return new Response(JSON.stringify(data), { headers });
}

export function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Health check
  if (url.pathname === "/api/health") {
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    }));
  }

  // Search endpoint
  if (url.pathname === "/api/search") {
    const type = url.searchParams.get("type");
    const query = (url.searchParams.get("q") || "").trim().slice(0, 120);

    if (!["game", "movie", "series"].includes(type!)) {
      return Promise.resolve(json({ error: "Tipo inválido." }, null));
    }
    if (query.length < 2) {
      return Promise.resolve(json({ error: "Digite pelo menos 2 caracteres." }, null));
    }

    const searchPromise = type === "game"
      ? searchHltbGames(query)
      : searchCinemeta(query, type);

    return searchPromise.then(function(results) {
      return json({ results }, "public, max-age=300");
    }).catch(function(e) {
      console.error("[search:" + type + "]", e);
      return json({ error: "Falha na busca." }, null);
    });
  }

  // Details endpoint
  if (url.pathname === "/api/details") {
    const type = url.searchParams.get("type");
    const id = (url.searchParams.get("id") || "").trim();

    if (type !== "movie" && type !== "series") {
      return Promise.resolve(json({ error: "Tipo inválido." }, null));
    }
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) {
      return Promise.resolve(json({ error: "ID inválido." }, null));
    }

    const detailsPromise = getScreenDetails(id, type);
    const seasonCoversPromise = type === "series" ? getTvmazeSeasonCovers(id) : Promise.resolve({});

    return Promise.all([detailsPromise, seasonCoversPromise]).then(function(_result) {
      const details = _result[0];
      const seasonCovers = _result[1];

      const modifiedEpisodes = details.seasonEpisodes.map(function(e: any) {
        return Object.assign({}, e, { coverUrl: seasonCovers[String(e.season)] || null });
      });

      const merged = Object.assign({}, details, { seasonEpisodes: modifiedEpisodes });

      return json(merged, "public, max-age=3600");
    }).catch(function(e) {
      console.error("[details:" + type + "]", e);
      return json({ error: "Falha ao carregar detalhes." }, null);
    });
  }

  // Image proxy endpoint
  if (url.pathname === "/api/image") {
    const raw = url.searchParams.get("url") || "";

    try {
      var imgUrl = new URL(raw);

      if (imgUrl.protocol !== "https:" && imgUrl.protocol !== "http:") {
        return Promise.resolve(new Response(null, { status: 400 }));
      }

      const host = imgUrl.hostname.toLowerCase();
      if (!isBlockedHost(host)) {
        var upstream = fetch(imgUrl.toString(), {
          headers: {
            "user-agent": "Chrome/131.0",
            accept: "image/*"
          },
          redirect: "follow",
          signal: AbortSignal.timeout(15000)
        });

        return upstream.then(function(resp) {
          if (!resp.ok) return new Response(null, { status: 502 });
          const ct = resp.headers.get("content-type") || "";
          if (!ct.startsWith("image/")) return new Response(null, { status: 415 });
          return resp.arrayBuffer().then(function(buf: ArrayBuffer) {
            return new Response(new Uint8Array(buf), {
              headers: {
                "content-type": ct,
                "cache-control": "public, max-age=604800"
              }
            });
          });
        }).catch(function(e) {
          console.warn("[image]", e);
          return new Response(null, { status: 500 });
        });
      } else {
        return Promise.resolve(new Response(null, { status: 400 }));
      }
    } catch (e) {
      console.warn("[image]", e);
      return Promise.resolve(new Response(null, { status: 500 }));
    }
  }

  return Promise.resolve(new Response(null, { status: 404 }));
}
