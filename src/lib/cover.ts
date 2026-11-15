import type { MediaType, SeasonEpisodes } from "../types";

type CoverSource = {
  type: MediaType;
  coverUrl: string;
  selectedSeasons: number[];
  seasonEpisodes: SeasonEpisodes[];
};

/**
 * Capa exibida no card: se uma temporada está selecionada, usa o pôster
 * daquela temporada (TVmaze); senão, mantém a capa da série.
 */
export function selectedCoverUrl(item: CoverSource): string {
  if (item.type !== "series" || item.selectedSeasons.length === 0) return item.coverUrl;

  for (const season of item.selectedSeasons) {
    const entry = item.seasonEpisodes.find((option) => option.season === season);
    if (entry?.coverUrl) return entry.coverUrl;
  }

  return item.coverUrl;
}

export function seasonCoverUrl(
  seasonEpisodes: SeasonEpisodes[],
  season: number,
): string | null {
  return seasonEpisodes.find((entry) => entry.season === season)?.coverUrl ?? null;
}
