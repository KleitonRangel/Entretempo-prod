<<<<<<< HEAD
// Vercel Serverless Function — /api/details (GET) v2
const CINEMETA_META = "https://v3-cinemeta.strem.io/meta/";

async function getSeriesDetails(id: string): Promise<any> {
  try {
    const res = await fetch(CINEMETA_META + "series/" + encodeURIComponent(id) + ".json", {
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data.meta || {};
    
    // Parse runtime to minutes (e.g. "49 min" → 49)
    let episodeMinutes: number | null = null;
    const rtMatch = meta.runtime?.match(/(\d+)\s*min/);
    if (rtMatch) episodeMinutes = parseInt(rtMatch[1]);

    // Parse seasons/episodes from videos array
    const videos = Array.isArray(meta.videos) ? meta.videos : [];
    let totalEpisodes = 0;
    const seasonMap: Record<number, number> = {};
    
    for (const v of videos) {
      if (!v.season || v.season === 0) continue; // Skip specials/episodic entries at season 0
      if (!seasonMap[v.season]) seasonMap[v.season] = 0;
      seasonMap[v.season]++;
    }

    totalEpisodes = Object.values(seasonMap).reduce(function(sum, count) { return sum + count; }, 0);
    
    // Build seasonEpisodes array sorted by season number
    const seasonsSorted = Object.keys(seasonMap).map(Number).sort(function(a, b) { return a - b; });
    const totalSeasons = seasonsSorted.length > 0 ? seasonsSorted.length : null;

    const seasonEpisodes = seasonsSorted.map(function(s: number) {
      return {
        season: s,
        episodes: seasonMap[s],
        coverUrl: null, // Cinemeta doesn't provide per-episode images in the meta response
      };
    });

    const totalSeasonsNum = totalSeasons ?? 0;

    return {
      id: meta.id || id,
      type: "series",
      title: meta.name || "Unknown",
      year: parseYear(meta.year),
      description: (meta.description || "").trim(),
      genres: Array.isArray(meta.genres) ? meta.genres : [],
      rating: meta.imdbRating ? String(meta.imdbRating) : null,
      runtime: episodeMinutes, // For series, avg minutes per episode
      episodeMinutes: episodeMinutes,
      episodes: totalEpisodes || null,
      seasons: totalSeasonsNum > 0 ? totalSeasonsNum : (meta.year ? null : 0),
      seasonEpisodes: seasonEpisodes,
    };
  } catch (e) { console.error("[cinemeta-series-details]", e); return null; }
}

async function getMovieDetails(id: string): Promise<any> {
  try {
    const res = await fetch(CINEMETA_META + "movie/" + encodeURIComponent(id) + ".json", {
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data.meta || {};

    // Parse runtime to minutes (e.g. "148 min" → 148)
    let runtimeMinutes: number | null = null;
    const rtMatch = meta.runtime?.match(/(\d+)\s*min/);
    if (rtMatch) runtimeMinutes = parseInt(rtMatch[1]);

    return {
      id: meta.id || id,
      type: "movie",
      title: meta.name || "Unknown",
      year: parseYear(meta.year),
      description: (meta.description || "").trim(),
      genres: Array.isArray(meta.genres) ? meta.genres : [],
      rating: meta.imdbRating ? String(meta.imdbRating) : null,
      runtime: runtimeMinutes,
      episodeMinutes: null, // Movies don't have episodes
      episodes: null,
      seasons: null,
      seasonEpisodes: [],
    };
  } catch (e) { console.error("[cinemeta-movie-details]", e); return null; }
}

function parseYear(yearStr?: string | null): number | null {
  if (!yearStr || typeof yearStr !== "string") return null;
  const match = yearStr.match(/^\d{4}/);
  return match ? parseInt(match[0]) : null;
=======
// Vercel Serverless Function — /api/details (GET)
const CINEMETA_META = "https://v3-cinemeta.strem.io/meta/";

async function getSeriesDetails(id: string): Promise<any> {
  try {
<<<<<<< HEAD
    const data = await getTitleDetailsByIMDBId(id);
    
    // Parse runtime to minutes
    let runtimeMinutes: number | null = null;
    if (data.runtime && typeof data.runtime === "object" && "seconds" in data.runtime) {
      runtimeMinutes = Math.round((data.runtime as any).seconds / 60);
    }

    return {
      id: id,
      type: type,
      title: data.name || "Unknown",
      year: data.titleYear || null,
      description: (data.plot && typeof data.plot === "string") ? data.plot.trim() : "",
      genres: Array.isArray(data.genres) 
        ? data.genres.map(function(g: string) { return g.charAt(0).toUpperCase() + g.slice(1); })
        : [],
      rating: data.mainRate && typeof data.mainRate === "object" && "rate" in data.mainRate 
        ? (data.mainRate as any).rate 
        : null,
      runtime: runtimeMinutes,
      episodeMinutes: runtimeMinutes, // For series, avg minutes per episode
      posterUrl: data.posterImage && typeof data.posterImage === "object" && "url" in data.posterImage
        ? (data.posterImage as any).url
        : "",
    };
  } catch (e) {
    console.error("[movier-details:" + type + "]", e);
    return null;
  }
}

async function getTvmazeSeasons(id: string): Promise<any> {
  try {
<<<<<<< HEAD
    const res = await fetch("https://api.tvmaze.com/shows/" + encodeURIComponent(id) + "/episodes", { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return {};
    const episodes = await res.json();
    const covers: Record<string, string> = {};
    for (let i = 0; i < episodes.length; i++) { const ep = episodes[i]; const season = String(ep.season); if (!covers[season] && ep.image) { covers[season] = ep.image.medium || ep.image.original; } }
    return covers;
  } catch (e) { console.warn("[tvmaze]", e); return {}; }
>>>>>>> 13cb448 (feat: individual route files with full inline logic for Vercel Node.js)
=======
    const res = await fetch("https://api.tvmaze.com/shows/" + encodeURIComponent(id), {
=======
    const res = await fetch(CINEMETA_META + "series/" + encodeURIComponent(id) + ".json", {
>>>>>>> 28ecebe (feat: usar Cinemeta API para busca e detalhes (sem chaves de API))
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data.meta || {};
    
    // Parse runtime to minutes (e.g. "49 min" → 49)
    let episodeMinutes: number | null = null;
    const rtMatch = meta.runtime?.match(/(\d+)\s*min/);
    if (rtMatch) episodeMinutes = parseInt(rtMatch[1]);

    // Parse seasons/episodes from videos array
    const videos = Array.isArray(meta.videos) ? meta.videos : [];
    let totalEpisodes = 0;
    const seasonMap: Record<number, number> = {};
    
    for (const v of videos) {
      if (!v.season || v.season === 0) continue; // Skip specials/episodic entries at season 0
      if (!seasonMap[v.season]) seasonMap[v.season] = 0;
      seasonMap[v.season]++;
    }

    totalEpisodes = Object.values(seasonMap).reduce(function(sum, count) { return sum + count; }, 0);
    
    // Build seasonEpisodes array sorted by season number
    const seasonsSorted = Object.keys(seasonMap).map(Number).sort(function(a, b) { return a - b; });
    const totalSeasons = seasonsSorted.length > 0 ? seasonsSorted.length : null;

    const seasonEpisodes = seasonsSorted.map(function(s: number) {
      // Get cover URL from first episode of that season
      const ep = videos.find(function(v) { return v.season === s; });
      return {
        season: s,
        episodes: seasonMap[s],
        coverUrl: null, // Cinemeta doesn't provide per-episode images in the meta response
      };
    });

    return {
      id: meta.id || id,
      type: "series",
      title: meta.name || "Unknown",
      year: parseYear(meta.year),
      description: (meta.description || "").trim(),
      genres: Array.isArray(meta.genres) ? meta.genres : [],
      rating: meta.imdbRating ? String(meta.imdbRating) : null,
      runtime: episodeMinutes, // For series, avg minutes per episode
      episodeMinutes: episodeMinutes,
      episodes: totalEpisodes || null,
      seasons: totalSeasons !== undefined && totalSeasons > 0 ? totalSeasons : (meta.year ? null : 0),
      seasonEpisodes: seasonEpisodes,
    };
<<<<<<< HEAD
  } catch (e) { console.warn("[tvmaze]", e); return null; }
>>>>>>> a3eac72 (Replace Cinemeta with FreeApi.Pro + movier API)
=======
  } catch (e) { console.error("[cinemeta-series-details]", e); return null; }
}

async function getMovieDetails(id: string): Promise<any> {
  try {
    const res = await fetch(CINEMETA_META + "movie/" + encodeURIComponent(id) + ".json", {
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data.meta || {};

    // Parse runtime to minutes (e.g. "148 min" → 148)
    let runtimeMinutes: number | null = null;
    const rtMatch = meta.runtime?.match(/(\d+)\s*min/);
    if (rtMatch) runtimeMinutes = parseInt(rtMatch[1]);

    return {
      id: meta.id || id,
      type: "movie",
      title: meta.name || "Unknown",
      year: parseYear(meta.year),
      description: (meta.description || "").trim(),
      genres: Array.isArray(meta.genres) ? meta.genres : [],
      rating: meta.imdbRating ? String(meta.imdbRating) : null,
      runtime: runtimeMinutes,
      episodeMinutes: null, // Movies don't have episodes
      episodes: null,
      seasons: null,
      seasonEpisodes: [],
    };
  } catch (e) { console.error("[cinemeta-movie-details]", e); return null; }
}

function parseYear(yearStr?: string | null): number | null {
  if (!yearStr || typeof yearStr !== "string") return null;
  const match = yearStr.match(/^\d{4}/);
  return match ? parseInt(match[0]) : null;
>>>>>>> 28ecebe (feat: usar Cinemeta API para busca e detalhes (sem chaves de API))
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = (url.searchParams.get("id") || "").trim();
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> a3eac72 (Replace Cinemeta with FreeApi.Pro + movier API)
  
  if (type !== "movie" && type !== "series") {
    return new Response(JSON.stringify({ error: "Tipo inválido." }), { headers: { 'content-type': 'application/json' } });
  }
  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) {
    return new Response(JSON.stringify({ error: "ID inválido." }), { headers: { 'content-type': 'application/json' } });
  }

<<<<<<< HEAD
<<<<<<< HEAD
  const detailsPromise = type === "series" ? getSeriesDetails(id) : getMovieDetails(id);

  return detailsPromise.then(function(details) {
    if (!details) {
      return new Response(JSON.stringify({ error: "Detalhes não encontrados." }), { headers: { 'content-type': 'application/json' }, status: 404 });
    }

    const response = {
      id: details.id || id,
      type: details.type || type,
      title: details.title || "Unknown",
      year: details.year !== undefined ? details.year : null,
      runtime: details.runtime || null,
      episodeMinutes: details.episodeMinutes !== undefined ? details.episodeMinutes : (type === "series" ? 0 : null),
      episodes: details.episodes || null,
      seasons: details.seasons !== undefined ? details.seasons : (type === "series" ? 0 : null),
      seasonEpisodes: details.seasonEpisodes || [],
      description: details.description || "",
      genres: details.genres || [],
      rating: details.rating ? String(details.rating) : null,
    };

    return new Response(JSON.stringify({ details: response }), { 
<<<<<<< HEAD
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } 
    });
=======
  if (type !== "movie" && type !== "series") { return new Response(JSON.stringify({ error: "Tipo inválido." }), { headers: { 'content-type': 'application/json' } }); }
  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) { return new Response(JSON.stringify({ error: "ID inválido." }), { headers: { 'content-type': 'application/json' } }); }
  const detailsPromise = getScreenDetails(id, type);
  const seasonCoversPromise = type === "series" ? getTvmazeSeasonCovers(id) : Promise.resolve({});
  return Promise.all([detailsPromise, seasonCoversPromise]).then(function(_result) {
    const details = _result[0]; const seasonCovers = _result[1];
    const modifiedEpisodes = details.seasonEpisodes.map(function(e: any) { return Object.assign({}, e, { coverUrl: seasonCovers[String(e.season)] || null }); });
    const merged = Object.assign({}, details, { seasonEpisodes: modifiedEpisodes });
    return new Response(JSON.stringify(merged), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });
>>>>>>> 13cb448 (feat: individual route files with full inline logic for Vercel Node.js)
=======
  const detailsPromise = getMovieSeriesDetails(id, type);
  const seasonPromise = type === "series" ? getTvmazeSeasons(id) : Promise.resolve(null);
=======
  const detailsPromise = type === "series" ? getSeriesDetails(id) : getMovieDetails(id);
>>>>>>> 28ecebe (feat: usar Cinemeta API para busca e detalhes (sem chaves de API))

  return detailsPromise.then(function(details) {
    if (!details) {
      return new Response(JSON.stringify({ error: "Detalhes não encontrados." }), { headers: { 'content-type': 'application/json' }, status: 404 });
    }

    const response = {
      id: details.id || id,
      type: details.type || type,
      title: details.title || "Unknown",
      year: details.year !== undefined ? details.year : null,
      runtime: details.runtime || null,
      episodeMinutes: details.episodeMinutes !== undefined ? details.episodeMinutes : (type === "series" ? 0 : null),
      episodes: details.episodes || null,
      seasons: details.seasons !== undefined ? details.seasons : (type === "series" ? 0 : null),
      seasonEpisodes: details.seasonEpisodes || [],
      description: details.description || "",
      genres: details.genres || [],
      rating: details.rating ? String(details.rating) : null,
    };

    return new Response(JSON.stringify(response), { 
=======
>>>>>>> 537440d (fix: envolver resposta de detalhes em { details } para compatibilidade com frontend)
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } 
    });
>>>>>>> a3eac72 (Replace Cinemeta with FreeApi.Pro + movier API)
  }).catch(function(e) { console.error("[details:" + type + "]", e); return new Response(JSON.stringify({ error: "Falha ao carregar detalhes." }), { headers: { 'content-type': 'application/json' }, status: 502 }); });
}
