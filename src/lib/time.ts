import type { Item, MediaType } from "../types";
import { GAME_MODE_META, SPEEDS } from "./catalog";

export function formatDuration(totalMinutes: number | null | undefined): string {
  if (totalMinutes === null || totalMinutes === undefined || totalMinutes <= 0) {
    return "Tempo a definir";
  }

  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest}min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${String(rest).padStart(2, "0")}min`;
}

export function formatCompact(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours)}h`;
  if (hours >= 1) return `${hours.toFixed(1).replace(".", ",")}h`;
  return `${Math.round(minutes)}min`;
}

export function itemDuration(item: Item): number | null {
  if (item.type === "game") {
    return item.gameTimes[item.gameTimeMode];
  }

  if (item.type === "movie") {
    return item.runtime;
  }

  if (item.episodes && item.episodeMinutes) {
    return (item.episodes * item.episodeMinutes) / item.speed;
  }

  return item.runtime;
}

export function itemTimeDetail(item: Item): string {
  if (item.type === "game") {
    const mode = GAME_MODE_META[item.gameTimeMode];
    return `${mode.short} · HowLongToBeat`;
  }

  if (item.type === "movie") {
    return item.runtime ? "Duração do filme" : "Defina a duração";
  }

  if (item.episodes && item.episodeMinutes) {
    const seasonLabel =
      item.selectedSeasons.length > 0
        ? item.selectedSeasons.length <= 3
          ? item.selectedSeasons.map((season) => `T${season}`).join(", ")
          : `${item.selectedSeasons.length} temp.`
        : item.seasons
          ? `${item.seasons} temp.`
          : "";

    return `${seasonLabel ? `${seasonLabel} · ` : ""}${item.episodes} eps · ${formatSpeed(item.speed)}`;
  }

  return "Defina episódios e duração";
}

export function formatSpeed(speed: number): string {
  return `${String(speed).replace(".", ",")}x`;
}

export function isSpeed(value: number): value is (typeof SPEEDS)[number] {
  return SPEEDS.includes(value as (typeof SPEEDS)[number]);
}

export function minutesToHoursInput(minutes: number | null): string {
  if (!minutes) return "";
  const hours = minutes / 60;
  return String(Math.round(hours * 10) / 10).replace(".", ",");
}

export function hoursInputToMinutes(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 60);
}

export function plural(value: number, singular: string, pluralForm: string): string {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

export function formatDate(timestamp: number | null): string {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(new Date(timestamp))
    .replace(".", "");
}

export function relativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / 86_400_000);

  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  if (days < 30) return `há ${Math.floor(days / 7)} sem.`;
  return formatDate(timestamp);
}

export function itemFootnote(item: Item): string {
  if (item.status === "finished") {
    return item.finishedAt ? `Finalizado em ${formatDate(item.finishedAt)}` : "Finalizado";
  }
  if (item.status === "discarded") {
    return item.discardedAt ? `Descartado em ${formatDate(item.discardedAt)}` : "Descartado";
  }
  if (item.inProgress) return "Você está com este item agora";
  return `Adicionado ${relativeDate(item.createdAt)}`;
}

export function mediaSummary(type: MediaType): string {
  if (type === "game") return "Jogo";
  if (type === "movie") return "Filme";
  return "Série";
}

export function initials(title: string): string {
  const words = title
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "ET";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function normalizeTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
