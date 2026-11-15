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

export default async function handler(request, response) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("url") || "";

  try {
    const imgUrl = new URL(raw);

    if (imgUrl.protocol !== "https:" && imgUrl.protocol !== "http:") {
      response.status(400).json({ error: "Endereço de imagem inválido." });
      return;
    }

    if (isBlockedHost(imgUrl.hostname)) {
      response.status(400).json({ error: "Esse endereço não pode ser usado." });
      return;
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
      response.status(502).end();
      return;
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      response.status(415).end();
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > 12 * 1024 * 1024) {
      response.status(413).end();
      return;
    }

    response.setHeader("content-type", contentType);
    response.setHeader("cache-control", "public, max-age=604800, immutable");
    response.send(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/abort/i.test(message)) {
      response.status(504).end();
      return;
    }
    console.warn("[image]", error instanceof Error ? error.message : error);
    response.status(400).end();
  }
}
