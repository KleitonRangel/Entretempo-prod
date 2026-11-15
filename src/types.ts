export type MediaType = "game" | "movie" | "series";
export type Status = "current" | "finished" | "discarded";
export type GameTimeMode = "main" | "mainExtra" | "completionist";

export type GameTimes = {
  main: number | null;
  mainExtra: number | null;
  completionist: number | null;
};

export type SeasonEpisodes = {
  season: number;
  episodes: number;
  /** Pôster específico da temporada, quando o TVmaze tem. */
  coverUrl?: string | null;
};

export type Speed = 1 | 1.3 | 1.5;

export type Item = {
  id: string;
  title: string;
  type: MediaType;
  status: Status;
  order: number;
  inProgress: boolean;
  coverUrl: string;
  coverSource: string;
  source: string;
  externalId: string;
  externalUrl: string;
  year: number | null;
  description: string;
  gameTimes: GameTimes;
  gameTimeMode: GameTimeMode;
  episodes: number | null;
  episodeMinutes: number | null;
  seasons: number | null;
  seasonEpisodes: SeasonEpisodes[];
  selectedSeasons: number[];
  speed: Speed;
  runtime: number | null;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  discardedAt: number | null;
  sample?: boolean;
};

export type NewItemInput = Pick<
  Item,
  | "title"
  | "type"
  | "coverUrl"
  | "coverSource"
  | "source"
  | "externalId"
  | "externalUrl"
  | "year"
  | "description"
  | "gameTimes"
  | "gameTimeMode"
  | "episodes"
  | "episodeMinutes"
  | "seasons"
  | "seasonEpisodes"
  | "selectedSeasons"
  | "speed"
  | "runtime"
>;

export type SearchResult = {
  id: string;
  type: MediaType;
  title: string;
  year: number | null;
  coverUrl: string;
  thumbUrl?: string;
  source: string;
  externalUrl?: string;
  description?: string;
  platforms?: string[];
  times?: GameTimes;
};

export type TitleDetails = {
  id: string;
  type: MediaType;
  runtime: number | null;
  episodeMinutes: number | null;
  episodes: number | null;
  seasons: number | null;
  seasonEpisodes: SeasonEpisodes[];
  description: string;
  genres: string[];
  rating: string | null;
};

export type ToastState = {
  id: number;
  message: string;
  tone?: "default" | "danger";
  action?: { label: string; run: () => void };
};
