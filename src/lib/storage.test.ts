import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSupabase,
  itemToRow,
  loadFromSupabase,
  normalizeItem,
  parseImportedItems,
  seedItems,
  syncToSupabase,
} from "./storage";
import { makeItem, slimeSeasons } from "../test/fixtures";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("./supabase", () => ({
  supabase: { from: mocks.from },
}));

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.from.mockReset();
});

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

describe("backup em arquivo", () => {
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

describe("Supabase por usuário", () => {
  it("converte o item para o formato da tabela com user_id", () => {
    const item = makeItem({ id: "abc", title: "Ruptura" });
    const row = itemToRow(item, "user-123");

    expect(row).toMatchObject({
      id: "abc",
      user_id: "user-123",
      title: "Ruptura",
      in_progress: item.inProgress,
      cover_url: item.coverUrl,
      game_time_mode: item.gameTimeMode,
      selected_seasons: item.selectedSeasons,
    });
  });

  it("não sincroniza sem usuário autenticado", async () => {
    const result = await syncToSupabase([makeItem()], "");

    expect(result).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("envia upsert com user_id e remove itens apagados da nuvem", async () => {
    const item = makeItem({ id: "keep" });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const not = vi.fn().mockResolvedValue({ error: null });
    const eq = vi.fn(() => ({ not }));
    const del = vi.fn(() => ({ eq }));

    mocks.from.mockReturnValueOnce({ upsert }).mockReturnValueOnce({ delete: del });

    const result = await syncToSupabase([item], "user-1");

    expect(result).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "keep", user_id: "user-1" })],
      { onConflict: "id" },
    );
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(not).toHaveBeenCalledWith("id", "in", "(keep)");
  });

  it("carrega apenas os itens do usuário e normaliza as linhas", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "row-1",
          user_id: "user-1",
          title: "Duna",
          type: "movie",
          status: "current",
        },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));

    mocks.from.mockReturnValueOnce({ select });

    const items = await loadFromSupabase("user-1");

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Duna");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("limpa somente os itens do usuário autenticado", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq }));

    mocks.from.mockReturnValueOnce({ delete: del });

    expect(await clearSupabase("user-9")).toBe(true);
    expect(eq).toHaveBeenCalledWith("user_id", "user-9");
  });
});
