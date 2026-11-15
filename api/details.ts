// Vercel Serverless Function — /api/details (GET)
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
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = (url.searchParams.get("id") || "").trim();

  if (type !== "movie" && type !== "series") {
    return new Response(JSON.stringify({ error: "Tipo inválido." }), { headers: { 'content-type': 'application/json' } });
  }
  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) {
    return new Response(JSON.stringify({ error: "ID inválido." }), { headers: { 'content-type': 'application/json' } });
  }

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
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' }
    });
  }).catch(function(e) { console.error("[details:" + type + "]", e); return new Response(JSON.stringify({ error: "Falha ao carregar detalhes." }), { headers: { 'content-type': 'application/json' }, status: 502 }); });
}
