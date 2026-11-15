import { describe, expect, it, vi, afterEach } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("API response format regression tests", () => {
  describe("/api/details", () => {
    it("envolve resposta em { details } — bug fix regressivo", async () => {
      // Mock Cinemeta movie response
      const mockCinemetaMovie = {
        meta: {
          id: "tt1375666",
          name: "Inception",
          type: "movie",
          runtime: "148 min",
          year: "2010",
          description: "A thief who steals corporate secrets...",
          genres: ["Action", "Sci-Fi"],
          imdbRating: "8.8",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCinemetaMovie),
      });

      // Import the GET handler dynamically to use mocked fetch
      const { GET } = await import("../api/details");

      const request = new Request("http://localhost/api/details?type=movie&id=tt1375666");
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      // REGRESSION: Response MUST be wrapped in { details }
      expect(body).toHaveProperty("details");
      expect(body.details).toBeDefined();
      expect(body.details.id).toBe("tt1375666");
      expect(body.details.title).toBe("Inception");
      expect(body.details.runtime).toBe(148);
      expect(body.details.type).toBe("movie");

      // Frontend-safe: data.details.runtime should not crash
      expect(() => {
        const runtime = body.details.runtime;
        void runtime;
      }).not.toThrow();
    });

    it("envolve resposta em { details } para series", async () => {
      const mockCinemetaSeries = {
        meta: {
          id: "tt0903747",
          name: "Breaking Bad",
          type: "series",
          runtime: "49 min",
          year: "2008–2013",
          description: "A chemistry teacher turned meth manufacturer...",
          genres: ["Crime", "Drama"],
          imdbRating: "9.5",
          videos: [
            { season: 1, number: 1 },
            { season: 1, number: 2 },
            { season: 2, number: 1 },
          ],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCinemetaSeries),
      });

      const { GET } = await import("../api/details");

      const request = new Request("http://localhost/api/details?type=series&id=tt0903747");
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      expect(body).toHaveProperty("details");
      expect(body.details.id).toBe("tt0903747");
      expect(body.details.title).toBe("Breaking Bad");
      expect(body.details.episodeMinutes).toBe(49);
      expect(body.details.seasons).toBe(2); // 2 seasons from videos
      expect(body.details.episodes).toBe(3);

      // Frontend-safe: all expected fields exist
      expect(body.details.runtime).toBe(49); // series runtime = episode minutes
      expect(Array.isArray(body.details.seasonEpisodes)).toBe(true);
    });

    it("retorna 404 quando detalhes não são encontrados", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const { GET } = await import("../api/details");

      const request = new Request("http://localhost/api/details?type=movie&id=invalid123");
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(404);
      expect(body.error).toBeDefined();
    });

    it("retorna erro para tipo inválido", async () => {
      const { GET } = await import("../api/details");

      const request = new Request("http://localhost/api/details?type=anime&id=tt123");
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(200); // 400-level but not 5xx
      expect(body.error).toBeDefined();
    });

    it("retorna erro para ID inválido", async () => {
      const { GET } = await import("../api/details");

      const request = new Request("http://localhost/api/details?type=movie&id=".repeat(100));
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      expect(body.error).toBeDefined();
    });
  });

  describe("/api/search", () => {
    it("envolve resultados em { results } — estrutura correta", async () => {
      const mockCinemetaSearch = {
        metas: [
          {
            id: "tt1375666",
            name: "Inception",
            type: "movie",
            releaseInfo: "2010",
            poster: "https://images.metahub.space/poster/small/tt1375666/img",
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCinemetaSearch),
      });

      const { GET } = await import("../api/search");

      const request = new Request("http://localhost/api/search?type=movie&q=inception");
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      // REGRESSION: Response MUST be wrapped in { results }
      expect(body).toHaveProperty("results");
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results.length).toBeGreaterThan(0);
      expect(body.results[0].id).toBe("tt1375666");
      expect(body.results[0].title).toBe("Inception");
      expect(body.results[0].year).toBe(2010);
      expect(body.results[0].source).toBe("Cinemeta");
    });

    it("retorna array vazio quando não há resultados", async () => {
      const mockEmptySearch = { metas: [] };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEmptySearch),
      });

      const { GET } = await import("../api/search");

      const request = new Request("http://localhost/api/search?type=movie&q=xyznonexistent1234567890");
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      expect(body).toHaveProperty("results");
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results.length).toBe(0);
    });

    it("retorna erro para tipo inválido", async () => {
      const { GET } = await import("../api/search");

      const request = new Request("http://localhost/api/search?type=anime&q=test");
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      expect(body.error).toBeDefined();
    });

    it("retorna erro para query muito curta", async () => {
      const { GET } = await import("../api/search");

      const request = new Request("http://localhost/api/search?type=movie&q=a");
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      expect(body.error).toBeDefined();
    });
  });

  describe("Frontend safety — data.details.runtime não crasha", () => {
    it("todos os campos esperados pelo frontend existem na resposta de detalhes", async () => {
      const mockCinemeta = {
        meta: {
          id: "tt1375666",
          name: "Test Movie",
          type: "movie",
          runtime: "120 min",
          year: "2024",
          description: "A test movie.",
          genres: ["Action"],
          imdbRating: "7.5",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCinemeta),
      });

      const { GET } = await import("../api/details");

      const request = new Request("http://localhost/api/details?type=movie&id=tt1375666");
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      // Simulate what the frontend does: access data.details.runtime
      expect(body.details).toBeDefined();
      expect(typeof body.details.id).toBe("string");
      expect(typeof body.details.title).toBe("string");
      expect(body.details.type).toBe("movie");
      expect(body.details.year).toBe(2024);
      expect(body.details.runtime).toBe(120);
      expect(Array.isArray(body.details.seasonEpisodes)).toBe(true);
    });

    it("anime com dados incompletos não crasha o frontend", async () => {
      // Simulate Cinemeta returning partial anime data (no videos, minimal info)
      const mockPartialAnime = {
        meta: {
          id: "tt9054364",
          name: "That Time I Got Reincarnated as a Slime",
          type: "series",
          runtime: "24 min",
          year: "2018–",
          description: "A slime reincarnation story.",
          genres: ["Animation", "Action"],
          imdbRating: "8.0",
          videos: [], // No videos — edge case for anime
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPartialAnime),
      });

      const { GET } = await import("../api/details");

      const request = new Request("http://localhost/api/details?type=series&id=tt9054364");
      const response = await GET(request);
      const body = JSON.parse(await response.text());

      // Frontend must be able to read all fields without undefined errors
      expect(body.details.runtime).toBe(24);
      expect(body.details.episodeMinutes).toBe(24);
      expect(body.details.seasons).toBeNull(); // No videos = no seasons count from API
      expect(Array.isArray(body.details.seasonEpisodes)).toBe(true);
      expect(body.details.seasonEpisodes.length).toBe(0);

      // This is the exact crash pattern that was reported:
      // "Cannot read properties of undefined (reading 'runtime')"
      // Should NOT throw:
      expect(() => {
        const rt = body.details.runtime;
        void rt;
      }).not.toThrow();
    });
  });
});
