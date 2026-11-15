import { cached, clampText, fetchJson, toNumber } from "../http.js";

const BASE = "https://v3-cinemeta.strem.io";
const SEARCH_TTL_MS = 30 * 60 * 1000;
const DETAILS_TTL_MS = 60 * 60 * 1000;

type CinemetaType = "movie" | "series";

type CinemetaMeta = {
  imdb_id?: string;
  id?: string;
  type?: string;
  name?: string;
  releaseInfo?: string;
  year?: string;
  poster?: string;
  background?: string;
  description?: string;
  runtime?: string;
  genres?: string[];
  genre?: string[];
  imdbRating?: string;
  videos?: Array<{ season?: number; number?: number; name?: string }>;
};

export type TitleResult = {
  id: string;
  type: CinemetaType;
  title: string;
  year: number | null;
  coverUrl: string;
  thumbUrl: string;
  source: "Cinemeta";
  externalUrl: string;
  description?: string;
};

export type TitleDetails = {
  id: string;
  type: CinemetaType;
  title?: string;
  runtime: number | null;
  episodeMinutes: number | null;
  episodes: number | null;
  seasons: number | null;
  seasonEpisodes: Array<{ season: number; episodes: number; coverUrl?: string | null }>;
  description: string;
  genres: string[];
  rating: string | null;
};

function parseYear(value: unknown): number | null {
  const match = String(value ?? "").match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

export function parseRuntime(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  const text = String(value ?? "").toLowerCase();
  if (!text) return null;

  const hours = text.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const minutes = text.match(/(\d+)\s*m/);

  if (hours || minutes) {
    const total =
      (hours ? Number(hours[1].replace(",", ".")) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
    return total > 0 ? Math.round(total) : null;
  }

  const numeric = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

function largePoster(url: string | undefined): string {
  if (!url) return "";
  return url.replace(/\/poster\/(small|medium)\//, "/poster/large/");
}

function thumbPoster(url: string | undefined): string {
  if (!url) return "";
  return url.replace(/\/poster\/(small|large)\//, "/poster/medium/");
}

function normalizeResult(meta: CinemetaMeta, type: CinemetaType): TitleResult | null {
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
    description: clampText(meta.description, 280),
  };
}

export async function searchScreen(query: string, type: CinemetaType): Promise<TitleResult[]> {
  const key = `cinemeta:${type}:${query.toLowerCase()}`;

  return cached(key, SEARCH_TTL_MS, async () => {
    const url = `${BASE}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
    const data = await fetchJson<{ metas?: CinemetaMeta[] }>(url, {}, 15_000);

    return (data.metas ?? [])
      .filter((meta) => !meta.type || meta.type === type)
      .map((meta) => normalizeResult(meta, type))
      .filter((result): result is TitleResult => result !== null)
      .slice(0, 10);
  });
}

export async function getScreenDetails(id: string, type: CinemetaType): Promise<TitleDetails> {
  const key = `cinemeta:details:${type}:${id}`;

  return cached(key, DETAILS_TTL_MS, async () => {
    const url = `${BASE}/meta/${type}/${encodeURIComponent(id)}.json`;
    const data = await fetchJson<{ meta?: CinemetaMeta }>(url, {}, 15_000);
    const meta = data.meta;

    if (!meta) throw new Error("Metadados não encontrados.");

    const seasons = new Set<number>();
    const seasonCounts = new Map<number, number>();

    for (const video of meta.videos ?? []) {
      const season = toNumber(video.season);
      const number = toNumber(video.number);
      if (season !== null && number !== null && season > 0 && number > 0) {
        seasons.add(season);
        seasonCounts.set(season, (seasonCounts.get(season) ?? 0) + 1);
      }
    }

    const seasonEpisodes = [...seasonCounts.entries()]
      .sort((first, second) => first[0] - second[0])
      .map(([season, episodes]) => ({ season, episodes }));
    const episodeCount = seasonEpisodes.reduce((total, entry) => total + entry.episodes, 0);

    const runtime = parseRuntime(meta.runtime);
    const genres = meta.genres ?? meta.genre ?? [];

    return {
      id,
      type,
      title: meta.name,
      runtime,
      episodeMinutes: type === "series" ? runtime : null,
      episodes: episodeCount > 0 ? episodeCount : null,
      seasons: seasons.size > 0 ? seasons.size : null,
      seasonEpisodes,
      description: clampText(meta.description, 1200),
      genres: genres.slice(0, 4),
      rating: meta.imdbRating ? String(meta.imdbRating) : null,
    };
  });
}
