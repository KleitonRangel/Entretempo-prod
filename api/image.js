function isBlockedHost(hostname) {
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

export default async function handler(request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("url") || "";

  try {
    const imgUrl = new URL(raw);

    if (imgUrl.protocol !== "https:" && imgUrl.protocol !== "http:") {
      return new Response(JSON.stringify({ error: "Endereço de imagem inválido." }), { status: 400 });
    }

    if (isBlockedHost(imgUrl.hostname)) {
      return new Response(JSON.stringify({ error: "Esse endereço não pode ser usado." }), { status: 400 });
    }

    const upstream = await fetch(imgUrl.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        referer: imgUrl.hostname.includes("howlongtobeat.com") ? "https://howlongtobeat.com/" : imgUrl.origin,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      return new Response(null, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return new Response(null, { status: 415 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > 12 * 1024 * 1024) {
      return new Response(null, { status: 413 });
    }

    return new Response(buffer, {
      headers: { "content-type": contentType, "cache-control": "public, max-age=604800, immutable" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/abort/i.test(message)) {
      return new Response(null, { status: 504 });
    }
    console.warn("[image]", error instanceof Error ? error.message : error);
    return new Response(null, { status: 400 });
  }
}
