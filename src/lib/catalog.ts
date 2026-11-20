import type { GameTimeMode, MediaType, Status } from "../types";

export type IconName =
  | "plus"
  | "search"
  | "clock"
  | "game"
  | "movie"
  | "series"
  | "grip"
  | "play"
  | "pause"
  | "check"
  | "close"
  | "chevronDown"
  | "chevronRight"
  | "arrowLeft"
  | "arrowUp"
  | "trash"
  | "undo"
  | "database"
  | "external"
  | "download"
  | "upload"
  | "sparkle"
  | "image"
  | "previous"
  | "next"
  | "info"
  | "timer"
  | "logout"
  | "lock"
  | "mail"
  | "user";

export const TYPE_META: Record<
  MediaType,
  { label: string; plural: string; icon: IconName; className: string }
> = {
  game: { label: "Jogo", plural: "Jogos", icon: "game", className: "game" },
  movie: { label: "Filme", plural: "Filmes", icon: "movie", className: "movie" },
  series: { label: "Série", plural: "Séries", icon: "series", className: "series" },
};

export const STATUS_META: Record<
  Status,
  {
    label: string;
    short: string;
    description: string;
    emptyTitle: string;
    emptyCopy: string;
  }
> = {
  current: {
    label: "Agora",
    short: "Agora",
    description: "Na ordem em que você quer viver cada história.",
    emptyTitle: "Sua fila está livre",
    emptyCopy: "Adicione um jogo, filme ou série para começar a organizar o que vem a seguir.",
  },
  finished: {
    label: "Finalizados",
    short: "Finalizados",
    description: "O que já passou pela sua lista — e ficou com você.",
    emptyTitle: "Nada finalizado ainda",
    emptyCopy: "Quando você terminar algo, ele aparece aqui.",
  },
  discarded: {
    label: "Descartados",
    short: "Descartados",
    description: "Sem culpa. Você decidiu que não era o momento.",
    emptyTitle: "Nenhum item descartado",
    emptyCopy: "Abandonar também é escolher onde colocar seu tempo.",
  },
};

export const GAME_MODE_META: Record<
  GameTimeMode,
  { label: string; hint: string; short: string }
> = {
  main: { label: "Main Story", hint: "História principal", short: "Main Story" },
  mainExtra: { label: "Main + Extra", hint: "Principal + extras", short: "Main + Extra" },
  completionist: {
    label: "Completionist",
    hint: "100% do jogo",
    short: "Completionist",
  },
};

export const SPEEDS = [1, 1.3, 1.5] as const;

export const TYPE_ORDER: MediaType[] = ["game", "movie", "series"];
