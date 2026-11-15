import { describe, expect, it } from "vitest";
import {
  loadItems,
  normalizeItem,
  parseImportedItems,
  saveItems,
  seedItems,
} from "./storage";
import { makeItem, slimeSeasons } from "../test/fixtures";

describe("normalizeItem", () => {
  it("completa itens antigos sem os campos de temporada", () => {
    const legacy = {
      id: "legacy",
      title: "Série antiga",
      type: "series",
      episodes: 24,
      episodeMinutes: 24,
      seasons: 1,
    };

    const item = normalizeItem(legacy);

    expect(item).not.toBeNull();
    expect(item?.seasonEpisodes).toEqual([]);
    expect(item?.selectedSeasons).toEqual([]);
    expect(item?.speed).toBe(1);
  });

  it("remove temporadas selecionadas que não existem na série", () => {
    const item = normalizeItem({
      title: "Slime",
      type: "series",
      seasonEpisodes: slimeSeasons,
      selectedSeasons: [2, 9, "3", 2],
    });

    expect(item?.seasonEpisodes).toEqual(slimeSeasons);
    expect(item?.selectedSeasons).toEqual([2, 3]);
  });

  it("descarta quebra de temporada inválida", () => {
    const item = normalizeItem({
      title: "Série quebrada",
      type: "series",
      seasonEpisodes: [
        { season: 1, episodes: 12 },
        { season: 0, episodes: 4 },
        { season: 2, episodes: 0 },
        { season: "x", episodes: 3 },
        null,
      ],
    });

    expect(item?.seasonEpisodes).toEqual([{ season: 1, episodes: 12 }]);
  });

  it("preserva a capa de cada temporada e descarta endereços inválidos", () => {
    const item = normalizeItem({
      title: "Slime",
      type: "series",
      seasonEpisodes: [
        {
          season: 1,
          episodes: 24,
          coverUrl: "https://static.tvmaze.com/uploads/images/original_untouched/213/532717.jpg",
        },
        { season: 2, episodes: 24, coverUrl: "javascript:alert(1)" },
      ],
    });

    expect(item?.seasonEpisodes).toEqual([
      {
        season: 1,
        episodes: 24,
        coverUrl: "https://static.tvmaze.com/uploads/images/original_untouched/213/532717.jpg",
      },
      { season: 2, episodes: 24 },
    ]);
  });

  it("rejeita itens sem título", () => {
    expect(normalizeItem({ type: "game" })).toBeNull();
    expect(normalizeItem(null)).toBeNull();
  });
});

describe("persistência", () => {
  it("faz round-trip dos itens no localStorage", () => {
    const item = makeItem({
      id: "roundtrip",
      title: "Ruptura",
      episodes: 10,
      episodeMinutes: 49,
      seasons: 1,
      seasonEpisodes: [{ season: 2, episodes: 10 }],
      selectedSeasons: [2],
    });

    saveItems([item]);
    const loaded = loadItems();

    expect(loaded).toHaveLength(1);
    expect(loaded?.[0].selectedSeasons).toEqual([2]);
    expect(loaded?.[0].seasonEpisodes).toEqual([{ season: 2, episodes: 10 }]);
  });

  it("retorna null quando o armazenamento está vazio ou corrompido", () => {
    expect(loadItems()).toBeNull();
    window.localStorage.setItem("entretempo:v1", "{quebrado");
    expect(loadItems()).toBeNull();
  });

  it("importa backup no formato antigo e no novo", () => {
    const oldFormat = JSON.stringify([{ title: "Antigo", type: "movie" }]);
    const newFormat = JSON.stringify({ items: [{ title: "Novo", type: "game" }] });

    expect(parseImportedItems(oldFormat).map((item) => item.title)).toEqual(["Antigo"]);
    expect(parseImportedItems(newFormat).map((item) => item.title)).toEqual(["Novo"]);
    expect(() => parseImportedItems("{}")).toThrow(/backup do Entretempo/);
  });
});

describe("seeds", () => {
  it("mantêm os campos de temporada consistentes", () => {
    const seeds = seedItems();

    expect(seeds).toHaveLength(5);
    for (const item of seeds) {
      expect(Array.isArray(item.seasonEpisodes)).toBe(true);
      expect(Array.isArray(item.selectedSeasons)).toBe(true);
      expect(item.selectedSeasons.every((season) =>
        item.seasonEpisodes.some((entry) => entry.season === season),
      )).toBe(true);
    }
  });
});
