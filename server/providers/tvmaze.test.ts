import { describe, expect, it } from "vitest";
import { buildSeasonCoverMap } from "./tvmaze";

describe("buildSeasonCoverMap", () => {
  it("associa número da temporada à melhor imagem disponível", () => {
    const map = buildSeasonCoverMap([
      {
        number: 1,
        image: {
          medium: "https://static.tvmaze.com/medium-1.jpg",
          original: "https://static.tvmaze.com/original-1.jpg",
        },
      },
      { number: 2, image: { medium: "https://static.tvmaze.com/medium-2.jpg" } },
    ]);

    expect(map).toEqual({
      "1": "https://static.tvmaze.com/original-1.jpg",
      "2": "https://static.tvmaze.com/medium-2.jpg",
    });
  });

  it("ignora especiais, temporadas sem imagem e números inválidos", () => {
    expect(
      buildSeasonCoverMap([
        { number: 0, image: { original: "https://static.tvmaze.com/special.jpg" } },
        { number: 3, image: null },
        { number: 4 },
        { number: -1, image: { original: "https://static.tvmaze.com/negative.jpg" } },
      ]),
    ).toEqual({});
  });
});
