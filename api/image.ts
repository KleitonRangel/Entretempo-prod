// Vercel Serverless Function — /api/image (GET) — Image proxy
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" || host === "::1") return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("url") || "";
  try {
    var imgUrl = new URL(raw);
    if (imgUrl.protocol !== "https:" && imgUrl.protocol !== "http:") return Promise.resolve(new Response(null, { status: 400 }));
    const host = imgUrl.hostname.toLowerCase();
    if (!isBlockedHost(host)) {
      return fetch(imgUrl.toString(), { headers: { "user-agent": "Chrome/131.0", accept: "image/*" }, redirect: "follow", signal: AbortSignal.timeout(15000) }).then(function(resp) {
        if (!resp.ok) return new Response(null, { status: 502 });
        const ct = resp.headers.get("content-type") || "";
        if (!ct.startsWith("image/")) return new Response(null, { status: 415 });
        return resp.arrayBuffer().then(function(buf: ArrayBuffer) { return new Response(new Uint8Array(buf), { headers: { "content-type": ct, "cache-control": "public, max-age=604800" } }); });
      }).catch(function(e) { console.warn("[image]", e); return new Response(null, { status: 500 }); });
    } else { return Promise.resolve(new Response(null, { status: 400 })); }
  } catch (e) { console.warn("[image]", e); return Promise.resolve(new Response(null, { status: 500 })); }
}
