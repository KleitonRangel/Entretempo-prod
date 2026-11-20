import { describe, expect, it, vi, afterEach } from "vitest";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("frontend API client — defensive regression tests", () => {
  function mockFetch(response: unknown, init: ResponseInit = {}) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: init.status !== undefined ? init.status < 400 : true,
      status: init.status ?? 200,
      json: () => Promise.resolve(response),
      ...init,
    });
  }

  describe("searchTitles", () => {
    it("retorna array quando API responde com formato esperado", async () => {
      const { searchTitles } = await import("./api");
      mockFetch({ results: [{ id: "tt1", type: "movie", title: "Test" }] });

      const result = await searchTitles("movie", "test");

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Test");
    });

    it("retorna array vazio quando resposta não tem campo results (malformed)", async () => {
      const { searchTitles } = await import("./api");
      // Simula API retornando dados sem envolver em { results }
      mockFetch({ id: "tt1", title: "Test" });

      const result = await searchTitles("movie", "test");

      expect(result).toEqual([]);
    });

    it("retorna array vazio quando data.results não é array (malformed)", async () => {
      const { searchTitles } = await import("./api");
      mockFetch({ results: "not-an-array" });

      const result = await searchTitles("movie", "test");

      expect(result).toEqual([]);
    });

    it("lança ApiError quando JSON parse falha mas status é 200 (formato inválido)", async () => {
      const { searchTitles, ApiError } = await import("./api");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      });

      await expect(searchTitles("movie", "test")).rejects.toThrow(ApiError);
    });

    it("lança ApiError quando API retorna status 4xx/5xx", async () => {
      const { searchTitles, ApiError } = await import("./api");
      mockFetch({ error: "Bad request" }, { status: 400 });

      await expect(searchTitles("movie", "ab")).rejects.toThrow(ApiError);
    });

    it("lança ApiError quando fetch network falha", async () => {
      const { searchTitles, ApiError } = await import("./api");
      global.fetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));

      await expect(searchTitles("movie", "test")).rejects.toThrow(ApiError);
    });
  });

  describe("getTitleDetails", () => {
    it("retorna detalhes quando API responde com formato esperado", async () => {
      const { getTitleDetails } = await import("./api");
      mockFetch({ details: { id: "tt1", title: "Test", runtime: 120 } });

      const result = await getTitleDetails("movie", "tt1");

      expect(result.id).toBe("tt1");
      expect(result.runtime).toBe(120);
    });

    it("retorna detalhes padrão quando resposta não tem campo details (malformed)", async () => {
      const { getTitleDetails } = await import("./api");
      mockFetch({ id: "tt1", title: "Test" });

      const result = await getTitleDetails("movie", "tt1");

      expect(result.id).toBe("");
      expect(result.runtime).toBeNull();
      expect(Array.isArray(result.seasonEpisodes)).toBe(true);
    });

    it("retorna detalhes padrão quando data.details é null/undefined", async () => {
      const { getTitleDetails } = await import("./api");
      mockFetch({ details: null });

      const result = await getTitleDetails("movie", "tt1");

      expect(result.id).toBe("");
      expect(result.runtime).toBeNull();
    });

    it("lança ApiError quando JSON parse falha mas status é 200 (formato inválido)", async () => {
      const { getTitleDetails, ApiError } = await import("./api");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      });

      await expect(getTitleDetails("movie", "tt1")).rejects.toThrow(ApiError);
    });

    it("lança ApiError quando API retorna status 4xx/5xx", async () => {
      const { getTitleDetails, ApiError } = await import("./api");
      mockFetch({ error: "Not found" }, { status: 404 });

      await expect(getTitleDetails("movie", "invalid")).rejects.toThrow(ApiError);
    });

    it("não crasha ao acessar campos no resultado com detalhes nulos (regressão do bug original)", async () => {
      const { getTitleDetails } = await import("./api");
      mockFetch({ details: null });

      const result = await getTitleDetails("movie", "tt1");

      // Este era o padrão exato que crashava antes:
      expect(() => {
        void result.runtime;
        void result.episodeMinutes;
        void result.episodes;
        void result.seasons;
        void result.seasonEpisodes;
        void result.description;
        void result.genres;
        void result.rating;
      }).not.toThrow();
    });
  });

  describe("ApiError", () => {
    it("tem name correto", async () => {
      const { ApiError } = await import("./api");
      const err = new ApiError("test error");
      expect(err.name).toBe("ApiError");
      expect(err.message).toBe("test error");
    });
  });
});
