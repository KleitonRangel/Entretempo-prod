export default async function handler(request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const query = (url.searchParams.get("q") || "").trim().slice(0, 120);

  if (!["game", "movie", "series"].includes(type)) {
    return new Response(JSON.stringify({ error: "Tipo inválido. Use game, movie ou series." }), { status: 400 });
  }

  if (query.length < 2) {
    return new Response(JSON.stringify({ error: "Digite pelo menos 2 caracteres para buscar." }), { status: 400 });
  }

  try {
    const results = type === "game" ? await searchGames(query) : await searchScreen(query, type === "movie" ? "movie" : "series");
    return new Response(JSON.stringify({ results }), {
      headers: { "cache-control": "public, max-age=300", "content-type": "application/json" }
    });
  } catch (error) {
    console.error(`[search:${type}]`, error);
    return new Response(JSON.stringify({ error: "A busca não respondeu agora. Tente de novo ou cadastre manualmente." }), { status: 502 });
  }
}
