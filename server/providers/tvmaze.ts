import { cached } from "../http.js";

const BASE = "https://api.tvmaze.com";
const SEASON_TTL_MS = 24 * 60 * 60 * 1000;

type TvmazeShow = {
  id?: number;
};

type TvmazeSeason = {
  number?: number;
  image?: {
    medium?: string;
    original?: string;
  } | null;
};

export type SeasonCoverMap = Record<string, string>;

/** Mantém só temporadas regulares (a 0 é especiais) com imagem utilizável. */
export function buildSeasonCoverMap(seasons: TvmazeSeason[]): SeasonCoverMap {
  const map: SeasonCoverMap = {};

  for (const season of seasons) {
    const number = Number(season.number);
    const image = season.image?.original || season.image?.medium;
    if (!Number.isInteger(number) || number <= 0 || !image) continue;
    map[String(number)] = image;
  }

  return map;
}

async function requestJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Capas por temporada do TVmaze (gratuito, sem chave). O IMDb não expõe
 * pôsteres de temporada, então usamos o TVmaze como complemento.
 */
export async function getSeasonCovers(imdbId: string): Promise<SeasonCoverMap> {
  if (!imdbId) return {};

  return cached(`tvmaze:seasons:${imdbId}`, SEASON_TTL_MS, async () => {
    const show = await requestJson<TvmazeShow>(
      `${BASE}/lookup/shows?imdb=${encodeURIComponent(imdbId)}`,
    );
    if (!show?.id) return {};

    const seasons = await requestJson<TvmazeSeason[]>(`${BASE}/shows/${show.id}/seasons`);
    return buildSeasonCoverMap(seasons ?? []);
  });
}
