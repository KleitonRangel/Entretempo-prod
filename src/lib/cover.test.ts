import { describe, expect, it } from "vitest";
import { seasonCoverUrl, selectedCoverUrl } from "./cover";
import { makeItem, seasonCovers, slimeSeasons } from "../test/fixtures";

const seasonsWithCovers = slimeSeasons.map((entry) => ({
  ...entry,
  coverUrl: seasonCovers[entry.season as 1 | 2] ?? null,
}));

function series(selectedSeasons: number[]) {
  return makeItem({
    type: "series",
    coverUrl: "https://images.metahub.space/poster/large/tt9054364/img",
    seasonEpisodes: seasonsWithCovers,
    selectedSeasons,
  });
}

describe("selectedCoverUrl", () => {
  it("mantém a capa da série quando nenhuma temporada está marcada", () => {
    expect(selectedCoverUrl(series([]))).toBe(
      "https://images.metahub.space/poster/large/tt9054364/img",
    );
  });

  it("usa a capa da temporada selecionada", () => {
    expect(selectedCoverUrl(series([2]))).toBe(seasonCovers[2]);
  });

  it("usa a primeira temporada que tiver capa quando há várias", () => {
    expect(selectedCoverUrl(series([3, 2]))).toBe(seasonCovers[2]);
  });

  it("volta para a capa da série quando a temporada não tem pôster", () => {
    expect(selectedCoverUrl(series([3]))).toBe(
      "https://images.metahub.space/poster/large/tt9054364/img",
    );
  });

  it("não troca a capa de jogos e filmes", () => {
    const movie = makeItem({
      type: "movie",
      coverUrl: "https://images.metahub.space/poster/large/tt15239678/img",
      seasonEpisodes: seasonsWithCovers,
      selectedSeasons: [2],
    });

    expect(selectedCoverUrl(movie)).toBe(movie.coverUrl);
  });

  it("encontra a capa de uma temporada específica", () => {
    expect(seasonCoverUrl(seasonsWithCovers, 1)).toBe(seasonCovers[1]);
    expect(seasonCoverUrl(seasonsWithCovers, 4)).toBeNull();
  });
});
