import type {
  GameTimeMode,
  GameTimes,
  Item,
  MediaType,
  SeasonEpisodes,
  Speed,
  Status,
} from "../types";
import { isSpeed } from "./time";

const STORAGE_KEY = "entretempo:v1";
const DAY = 86_400_000;

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const emptyTimes = (): GameTimes => ({ main: null, mainExtra: null, completionist: null });

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOr(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isMediaType(value: unknown): value is MediaType {
  return value === "game" || value === "movie" || value === "series";
}

function isStatus(value: unknown): value is Status {
  return value === "current" || value === "finished" || value === "discarded";
}

function isGameMode(value: unknown): value is GameTimeMode {
  return value === "main" || value === "mainExtra" || value === "completionist";
}

function seasonNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function seasonCover(value: unknown): string | null {
  const url = stringOr(value).trim();
  return /^https?:\/\//i.test(url) ? url : null;
}

function normalizeSeasonEpisodes(raw: unknown): SeasonEpisodes[] {
  if (!Array.isArray(raw)) return [];

  const counts = new Map<number, { episodes: number; coverUrl: string | null }>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const source = entry as Record<string, unknown>;
    const season = seasonNumber(source.season);
    const episodes = numberOrNull(source.episodes);
    if (season === null || episodes === null || episodes <= 0) continue;
    counts.set(season, {
      episodes: Math.round(episodes),
      coverUrl: seasonCover(source.coverUrl),
    });
  }

  return [...counts.entries()]
    .sort((first, second) => first[0] - second[0])
    .map(([season, entry]) => ({
      season,
      episodes: entry.episodes,
      ...(entry.coverUrl ? { coverUrl: entry.coverUrl } : {}),
    }));
}

function normalizeSelectedSeasons(raw: unknown, available: SeasonEpisodes[]): number[] {
  if (!Array.isArray(raw)) return [];

  const known = new Set(available.map((entry) => entry.season));
  const selected = new Set<number>();

  for (const entry of raw) {
    const season = seasonNumber(entry);
    if (season === null) continue;
    if (known.size > 0 && !known.has(season)) continue;
    selected.add(season);
  }

  return [...selected].sort((first, second) => first - second);
}

export function normalizeItem(raw: unknown, index = 0): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const title = stringOr(source.title).trim();

  if (!title) return null;

  const type = isMediaType(source.type) ? source.type : "game";
  const status = isStatus(source.status) ? source.status : "current";
  const rawTimes = (source.gameTimes ?? {}) as Record<string, unknown>;
  const speedValue = Number(source.speed);
  const seasonEpisodes = normalizeSeasonEpisodes(source.seasonEpisodes);
  const selectedSeasons = normalizeSelectedSeasons(source.selectedSeasons, seasonEpisodes);

  return {
    id: stringOr(source.id) || uid(),
    title,
    type,
    status,
    order: numberOrNull(source.order) ?? index,
    inProgress: Boolean(source.inProgress) && status === "current",
    coverUrl: stringOr(source.coverUrl),
    coverSource: stringOr(source.coverSource),
    source: stringOr(source.source),
    externalId: stringOr(source.externalId),
    externalUrl: stringOr(source.externalUrl),
    year: numberOrNull(source.year),
    description: stringOr(source.description),
    gameTimes: {
      main: numberOrNull(rawTimes.main),
      mainExtra: numberOrNull(rawTimes.mainExtra),
      completionist: numberOrNull(rawTimes.completionist),
    },
    gameTimeMode: isGameMode(source.gameTimeMode) ? source.gameTimeMode : "main",
    episodes: numberOrNull(source.episodes),
    episodeMinutes: numberOrNull(source.episodeMinutes),
    seasons: numberOrNull(source.seasons),
    seasonEpisodes,
    selectedSeasons,
    speed: (isSpeed(speedValue) ? speedValue : 1) as Speed,
    runtime: numberOrNull(source.runtime),
    createdAt: numberOrNull(source.createdAt) ?? Date.now(),
    updatedAt: numberOrNull(source.updatedAt) ?? Date.now(),
    finishedAt: numberOrNull(source.finishedAt),
    discardedAt: numberOrNull(source.discardedAt),
    sample: Boolean(source.sample),
  };
}

// ─── localStorage (síncrono — interface original mantida) ────────────

export function loadItems(): Item[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : [];

    const items = list
      .map((entry, index) => normalizeItem(entry, index))
      .filter((item): item is Item => item !== null);

    return items;
  } catch {
    return null;
  }
}

export function saveItems(items: Item[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));
  } catch (error) {
    console.warn("Não foi possível salvar no navegador.", error);
  }
}

export function clearStoredItems(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem problema: o estado em memória continua funcionando.
  }
}

// ─── Supabase (assíncrono — sync sob demanda) ────────────────────────

let _supabaseAvailable = false;

async function getSupabaseClient() {
  const { supabase } = await import("./supabase");
  return supabase;
}

export async function isSupabaseConfigured(): Promise<boolean> {
  if (_supabaseAvailable) return true;
  try {
    const client = await getSupabaseClient();
    if (!client || !import.meta.env.VITE_SUPABASE_URL) return false;
    // Quick ping to verify connection
    await client.from("items").select("id").limit(1).maybeSingle();
    _supabaseAvailable = true;
    return true;
  } catch {
    return false;
  }
}

export async function syncToSupabase(items: Item[]): Promise<boolean> {
  const ok = await isSupabaseConfigured();
  if (!ok) return false;

  try {
    const client = await getSupabaseClient();
    const dbItems = items.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      status: item.status,
      order: item.order,
      in_progress: item.inProgress,
      cover_url: item.coverUrl,
      cover_source: item.coverSource,
      source: item.source,
      external_id: item.externalId,
      external_url: item.externalUrl,
      year: item.year,
      description: item.description,
      game_times: item.gameTimes,
      game_time_mode: item.gameTimeMode,
      episodes: item.episodes,
      episode_minutes: item.episodeMinutes,
      seasons: item.seasons,
      season_episodes: item.seasonEpisodes,
      selected_seasons: item.selectedSeasons,
      speed: item.speed,
      runtime: item.runtime,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      finished_at: item.finishedAt,
      discarded_at: item.discardedAt,
      sample: item.sample ?? false,
    }));

    const { error } = await client.from("items").upsert(dbItems);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("Falha ao sincronizar com o Supabase:", err);
    return false;
  }
}

export async function loadFromSupabase(): Promise<Item[]> {
  const ok = await isSupabaseConfigured();
  if (!ok) return [];

  try {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from("items")
      .select("*")
      .order("order", { ascending: true });

    if (error || !Array.isArray(data)) return [];

    return data.map(normalizeItem).filter((item): item is Item => item !== null);
  } catch {
    return [];
  }
}

export async function clearSupabase(): Promise<boolean> {
  const ok = await isSupabaseConfigured();
  if (!ok) return false;

  try {
    const client = await getSupabaseClient();
    // Delete all items (no filter needed — just truncate the table for this user)
    await client.from("items").delete().gt("id", ""); // no-op filter, but works
    return true;
  } catch {
    return false;
  }
}

// ─── Export / Import ────────────────────────────────────────────────

export function exportItems(items: Item[]): string {
  return JSON.stringify({ app: "entretempo", version: 1, exportedAt: new Date().toISOString(), items }, null, 2);
}

export function parseImportedItems(text: string): Item[] {
  const parsed = JSON.parse(text) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : null;

  if (!list) throw new Error("O arquivo não parece ser um backup do Entretempo.");

  const items = list
    .map((entry, index) => normalizeItem(entry, index))
    .filter((item): item is Item => item !== null);

  if (items.length === 0) throw new Error("Nenhum item válido foi encontrado no arquivo.");
  return items;
}

export function createItem(
  input: Omit<Item, "id" | "status" | "order" | "inProgress" | "createdAt" | "updatedAt" | "finishedAt" | "discardedAt">,
  order: number,
): Item {
  const now = Date.now();
  return {
    ...input,
    id: uid(),
    status: "current",
    order,
    inProgress: false,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    discardedAt: null,
  };
}

export function seedItems(): Item[] {
  const now = Date.now();

  const seeds: Item[] = [
    {
      id: "seed_frieren",
      title: "Frieren e a Jornada para o Além",
      type: "series",
      status: "current",
      order: 0,
      inProgress: true,
      coverUrl: "https://images.metahub.space/poster/large/tt22248376/img",
      coverSource: "Cinemeta",
      source: "Cinemeta",
      externalId: "tt22248376",
      externalUrl: "https://www.imdb.com/title/tt22248376/",
      year: 2023,
      description: "Uma elfa maga revisita o mundo depois da jornada do grupo que derrotou o Rei Demônio.",
      gameTimes: emptyTimes(),
      gameTimeMode: "main",
      episodes: 28,
      episodeMinutes: 25,
      seasons: 1,
      seasonEpisodes: [{ season: 1, episodes: 28 }],
      selectedSeasons: [],
      speed: 1.3,
      runtime: 25,
      createdAt: now - 3 * DAY,
      updatedAt: now,
      finishedAt: null,
      discardedAt: null,
      sample: true,
    },
    {
      id: "seed_elden_ring",
      title: "Elden Ring",
      type: "game",
      status: "current",
      order: 1,
      inProgress: false,
      coverUrl: "https://howlongtobeat.com/games/68151_Elden_Ring.jpg?width=400",
      coverSource: "HowLongToBeat",
      source: "HowLongToBeat",
      externalId: "68151",
      externalUrl: "https://howlongtobeat.com/game/68151",
      year: 2022,
      description: "Um RPG de mundo aberto nas Terras Intermédias, criado pela FromSoftware.",
      gameTimes: { main: 3608, mainExtra: 6086, completionist: 8174 },
      gameTimeMode: "mainExtra",
      episodes: null,
      episodeMinutes: null,
      seasons: null,
      seasonEpisodes: [],
      selectedSeasons: [],
      speed: 1,
      runtime: null,
      createdAt: now - 9 * DAY,
      updatedAt: now,
      finishedAt: null,
      discardedAt: null,
      sample: true,
    },
    {
      id: "seed_dune",
      title: "Duna: Parte Dois",
      type: "movie",
      status: "current",
      order: 2,
      inProgress: false,
      coverUrl: "https://images.metahub.space/poster/large/tt15239678/img",
      coverSource: "Cinemeta",
      source: "Cinemeta",
      externalId: "tt15239678",
      externalUrl: "https://www.imdb.com/title/tt15239678/",
      year: 2024,
      description: "Paul Atreides se une aos Fremen em busca de vingança contra os conspiradores.",
      gameTimes: emptyTimes(),
      gameTimeMode: "main",
      episodes: null,
      episodeMinutes: null,
      seasons: null,
      seasonEpisodes: [],
      selectedSeasons: [],
      speed: 1,
      runtime: 167,
      createdAt: now - 14 * DAY,
      updatedAt: now,
      finishedAt: null,
      discardedAt: null,
      sample: true,
    },
    {
      id: "seed_severance",
      title: "Ruptura",
      type: "series",
      status: "finished",
      order: 0,
      inProgress: false,
      coverUrl: "https://images.metahub.space/poster/large/tt11280740/img",
      coverSource: "Cinemeta",
      source: "Cinemeta",
      externalId: "tt11280740",
      externalUrl: "https://www.imdb.com/title/tt11280740/",
      year: 2022,
      description: "Funcionários da Lumon passam por um procedimento que separa memórias do trabalho e da vida pessoal.",
      gameTimes: emptyTimes(),
      gameTimeMode: "main",
      episodes: 19,
      episodeMinutes: 49,
      seasons: 2,
      seasonEpisodes: [
        { season: 1, episodes: 9 },
        { season: 2, episodes: 10 },
      ],
      selectedSeasons: [],
      speed: 1,
      runtime: 49,
      createdAt: now - 40 * DAY,
      updatedAt: now,
      finishedAt: now - 6 * DAY,
      discardedAt: null,
      sample: true,
    },
    {
      id: "seed_witcher",
      title: "The Witcher: Blood Origin",
      type: "series",
      status: "discarded",
      order: 0,
      inProgress: false,
      coverUrl: "https://images.metahub.space/poster/large/tt12785720/img",
      coverSource: "Cinemeta",
      source: "Cinemeta",
      externalId: "tt12785720",
      externalUrl: "https://www.imdb.com/title/tt12785720/",
      year: 2022,
      description: "A origem do primeiro Bruxo, séculos antes de Geralt de Rívia.",
      gameTimes: emptyTimes(),
      gameTimeMode: "main",
      episodes: 4,
      episodeMinutes: 51,
      seasons: 1,
      seasonEpisodes: [{ season: 1, episodes: 4 }],
      selectedSeasons: [],
      speed: 1,
      runtime: 51,
      createdAt: now - 60 * DAY,
      updatedAt: now,
      finishedAt: null,
      discardedAt: now - 21 * DAY,
      sample: true,
    },
  ];

  return seeds;
}
