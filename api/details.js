import { getScreenDetails } from "../server/providers/cinemeta.js";
import { getSeasonCovers } from "../server/providers/tvmaze.js";

export default async function handler(request, response) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = (url.searchParams.get("id") || "").trim();

  if (type !== "movie" && type !== "series") {
    response.status(400).json({ error: "Tipo inválido. Use movie ou series." });
    return;
  }

  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) {
    response.status(400).json({ error: "Identificador inválido." });
    return;
  }

  try {
    const [details, seasonCovers] = await Promise.all([
      getScreenDetails(id, type),
      type === "series" ? getSeasonCovers(id) : Promise.resolve({}),
    ]);

    const withCovers = {
      ...details,
      seasonEpisodes: details.seasonEpisodes.map((entry) => ({
        ...entry,
        coverUrl: seasonCovers[String(entry.season)] || null,
      })),
    };

    response.setHeader("cache-control", "public, max-age=3600");
    response.json({ details: withCovers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/metadados/i.test(message)) {
      response.status(404).json({ error: "Esse título não tem episódios cadastrados no IMDb. Confira se escolheu a versão certa (o ano ajuda) ou use a entrada manual." });
      return;
    }
    console.error(`[details:${type}]`, error);
    response.status(502).json({ error: "Não foi possível carregar os detalhes desse título." });
  }
}
