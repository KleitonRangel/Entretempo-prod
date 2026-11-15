import { searchGames } from "../server/providers/hltb.js";
import { searchScreen } from "../server/providers/cinemeta.js";

export default async function handler(request, response) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const query = (url.searchParams.get("q") || "").trim().slice(0, 120);

  if (!["game", "movie", "series"].includes(type)) {
    response.status(400).json({ error: "Tipo inválido. Use game, movie ou series." });
    return;
  }

  if (query.length < 2) {
    response.status(400).json({ error: "Digite pelo menos 2 caracteres para buscar." });
    return;
  }

  try {
    const results = type === "game" ? await searchGames(query) : await searchScreen(query, type === "movie" ? "movie" : "series");
    response.setHeader("cache-control", "public, max-age=300");
    response.json({ results });
  } catch (error) {
    console.error(`[search:${type}]`, error);
    response.status(502).json({ error: "A busca não respondeu agora. Tente de novo ou cadastre manualmente." });
  }
}
