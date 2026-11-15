import { searchGames } from "../server/providers/hltb.js";
import { searchScreen, getScreenDetails } from "../server/providers/cinemeta.js";
import { getSeasonCovers } from "../server/providers/tvmaze.js";

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\/.test(host) ||
    /^169\.254\/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

async function handleSearch(url: URL): Promise<Response> {
  const type = url.searchParams.get("type");
  const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
  if (!["game", "movie", "series"].includes(type)) return new Response(JSON.stringify({ error: "Tipo inválido." }), { status: 400 });
  if (query.length < 2) return new Response(JSON.stringify({ error: "Digite pelo menos 2 caracteres." }), { status: 400 });
  try {
    const results = type === "game" ? await searchGames(query) : await searchScreen(query, type === "movie" ? "movie" : "series");
    return new Response(JSON.stringify({ results }), { headers: { "cache-control": "public, max-age=300", "content-type": "application/json" } });
  } catch (error) {
    console.error(`[search:${type}]`, error);
    return new Response(JSON.stringify({ error: "Falha na busca." }), { status: 502 });
  }
}

async function handleDetails(url: URL): Promise<Response> {
  const type = url.searchParams.get("type");
  const id = (url.searchParams.get("id") || "").trim();
  if (type !== "movie" && type !== "series") return new Response(JSON.stringify({ error: "Tipo inválido." }), { status: 400 });
  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) return new Response(JSON.stringify({ error: "ID inválido." }), { status: 400 });
  try {
    const [details, seasonCovers] = await Promise.all([getScreenDetails(id, type), type === "series" ? getSeasonCovers(id) : Promise.resolve({})]);
    return new Response(JSON.stringify({ details: { ...details, seasonEpisodes: details.seasonEpisodes.map((e: any) => ({ ...e, coverUrl: seasonCovers[String(e.season)] || null }) ) } }), { headers: { "cache-control": "public, max-age=3600", "content-type": "application/json" } });
  } catch (error) {
    console.error(`[details:${type}]`, error);
    return new Response(JSON.stringify({ error: "Falha ao carregar detalhes." }), { status: 502 });
  }
}

async function handleImage(url: URL): Promise<Response> {
  const raw = url.searchParams.get("url") || "";
  try {
    const imgUrl = new URL(raw);
    if (imgUrl.protocol !== "https:" && imgUrl.protocol !== "http:") return new Response(null, { status: 400 });
    const host = imgUrl.hostname.toLowerCase();
    if (host === "localhost" || /^127\./.test(host) || /^10\/.test(host) || /^192\.168\/.test(host)) return new Response(null, { status: 400 });
    const upstream = await fetch(imgUrl.toString(), { headers: { "user-agent": "Chrome/131.0", accept: "image/*" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!upstream.ok) return new Response(null, { status: 502 });
    const ct = upstream.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return new Response(null, { status: 415 });
    const buf = await upstream.arrayBuffer();
    return new Response(new Uint8Array(buf), { headers: { "content-type": ct, "cache-control": "public, max-age=604800" } });
  } catch (e) {
    console.warn("[image]", e); return new Response(null, { status: 500 });
  }
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  if (url.pathname === "/api/search") return handleSearch(url);
  if (url.pathname === "/api/details") return handleDetails(url);
  if (url.pathname === "/api/image") return handleImage(url);
  return new Response(null, { status: 404 });
}
