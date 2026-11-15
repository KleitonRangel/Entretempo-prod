import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatSpeed,
  hoursInputToMinutes,
  isSpeed,
  itemDuration,
  itemTimeDetail,
  minutesToHoursInput,
} from "./time";
import { makeItem, slimeSeasons } from "../test/fixtures";

describe("formatDuration", () => {
  it("mostra um aviso quando não há tempo", () => {
    expect(formatDuration(null)).toBe("Tempo a definir");
    expect(formatDuration(0)).toBe("Tempo a definir");
  });

  it("formata horas e minutos", () => {
    expect(formatDuration(45)).toBe("45min");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(150)).toBe("2h 30min");
  });
});

describe("itemDuration", () => {
  it("usa o modo escolhido do jogo", () => {
    const item = makeItem({
      type: "game",
      gameTimes: { main: 3608, mainExtra: 6086, completionist: 8174 },
      gameTimeMode: "mainExtra",
    });

    expect(itemDuration(item)).toBe(6086);
  });

  it("divide os episódios pela velocidade", () => {
    const item = makeItem({
      episodes: 48,
      episodeMinutes: 24,
      speed: 1.5,
      seasonEpisodes: slimeSeasons,
      selectedSeasons: [2, 3],
    });

    expect(itemDuration(item)).toBe(768);
    expect(formatDuration(itemDuration(item))).toBe("12h 48min");
  });

  it("usa a duração do filme", () => {
    expect(itemDuration(makeItem({ type: "movie", runtime: 166 }))).toBe(166);
  });
});

describe("itemTimeDetail", () => {
  it("mostra as temporadas escolhidas", () => {
    const item = makeItem({
      episodes: 48,
      episodeMinutes: 24,
      speed: 1.5,
      seasonEpisodes: slimeSeasons,
      selectedSeasons: [2, 3],
    });

    expect(itemTimeDetail(item)).toBe("T2, T3 · 48 eps · 1,5x");
  });

  it("mostra o total de temporadas quando todas estão selecionadas", () => {
    const item = makeItem({
      episodes: 96,
      episodeMinutes: 24,
      seasons: 4,
      seasonEpisodes: slimeSeasons,
      selectedSeasons: [],
    });

    expect(itemTimeDetail(item)).toBe("4 temp. · 96 eps · 1x");
  });

  it("resume muitas temporadas", () => {
    const item = makeItem({
      episodes: 96,
      episodeMinutes: 24,
      seasons: 4,
      seasonEpisodes: slimeSeasons,
      selectedSeasons: [1, 2, 3, 4],
    });

    expect(itemTimeDetail(item)).toBe("4 temp. · 96 eps · 1x");
  });

  it("detalha jogos e filmes", () => {
    expect(
      itemTimeDetail(
        makeItem({
          type: "game",
          gameTimes: { main: 1800, mainExtra: 3000, completionist: 4000 },
          gameTimeMode: "completionist",
        }),
      ),
    ).toBe("Completionist · HowLongToBeat");

    expect(itemTimeDetail(makeItem({ type: "movie", runtime: 120 }))).toBe(
      "Duração do filme",
    );
  });
});

describe("velocidade e campos de horas", () => {
  it("formata e valida as velocidades aceitas", () => {
    expect(formatSpeed(1.3)).toBe("1,3x");
    expect(isSpeed(1.5)).toBe(true);
    expect(isSpeed(1.2)).toBe(false);
  });

  it("converte horas digitadas para minutos", () => {
    expect(hoursInputToMinutes("2,5")).toBe(150);
    expect(hoursInputToMinutes("")).toBeNull();
    expect(minutesToHoursInput(150)).toBe("2,5");
  });
});
