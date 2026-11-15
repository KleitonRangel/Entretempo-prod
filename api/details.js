export default async function handler(request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = (url.searchParams.get("id") || "").trim();

  if (type !== "movie" && type !== "series") {
    return new Response(JSON.stringify({ error: "Tipo inválido. Use movie ou series." }), { status: 400 });
  }

  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) {
    return new Response(JSON.stringify({ error: "Identificador inválido." }), { status: 400 });
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

    return new Response(JSON.stringify({ details: withCovers }), {
      headers: { "cache-control": "public, max-age=3600", "content-type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/metadados/i.test(message)) {
      return new Response(JSON.stringify({ error: "Esse título não tem episódios cadastrados no IMDb. Confira se escolheu a versão certa (o ano ajuda) ou use a entrada manual." }), { status: 404 });
    }
    console.error(`[details:${type}]`, error);
    return new Response(JSON.stringify({ error: "Não foi possível carregar os detalhes desse título." }), { status: 502 });
  }
}
