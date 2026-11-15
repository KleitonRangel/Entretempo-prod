import type { Item } from "../types";

export function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    title: "Item de teste",
    type: "series",
    status: "current",
    order: 0,
    inProgress: false,
    coverUrl: "",
    coverSource: "",
    source: "",
    externalId: "",
    externalUrl: "",
    year: null,
    description: "",
    gameTimes: { main: null, mainExtra: null, completionist: null },
    gameTimeMode: "main",
    episodes: null,
    episodeMinutes: null,
    seasons: null,
    seasonEpisodes: [],
    selectedSeasons: [],
    speed: 1,
    runtime: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    finishedAt: null,
    discardedAt: null,
    sample: false,
    ...overrides,
  };
}

export const slimeSeasons = [
  { season: 1, episodes: 24 },
  { season: 2, episodes: 24 },
  { season: 3, episodes: 24 },
  { season: 4, episodes: 24 },
];

export const seasonCovers = {
  1: "https://static.tvmaze.com/uploads/images/original_untouched/213/532717.jpg",
  2: "https://static.tvmaze.com/uploads/images/original_untouched/190/475422.jpg",
};

