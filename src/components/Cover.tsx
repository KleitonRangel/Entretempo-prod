import { useEffect, useState, type CSSProperties } from "react";
import type { MediaType } from "../types";
import { TYPE_META } from "../lib/catalog";
import { initials } from "../lib/time";

const PALETTES: Array<[string, string]> = [
  ["#5b4bb7", "#241d43"],
  ["#2f6f78", "#12262d"],
  ["#8a5a3b", "#2b1a14"],
  ["#6b4a86", "#25172f"],
  ["#3f648f", "#152130"],
  ["#7f4f58", "#2a171c"],
  ["#4e6b45", "#1a2418"],
];

function displaySrc(src: string): string {
  if (!/^https?:\/\//i.test(src)) return src;
  return `/api/image?url=${encodeURIComponent(src)}`;
}

function paletteFor(title: string): [string, string] {
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) {
    hash = (hash * 31 + title.charCodeAt(index)) % 9973;
  }
  return PALETTES[hash % PALETTES.length];
}

export function Cover({
  src,
  title,
  type,
  className = "",
  loading = "lazy",
}: {
  src: string;
  title: string;
  type: MediaType;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const [first, second] = paletteFor(title || "Entretempo");
  const style = {
    "--cover-a": first,
    "--cover-b": second,
  } as CSSProperties;

  return (
    <div className={`cover ${className}`} style={style}>
      {src && !failed ? (
        <img
          src={displaySrc(src)}
          alt=""
          loading={loading}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cover-fallback">
          <span className="cover-initials">{initials(title || "Entretempo")}</span>
          <span className="cover-kind">{TYPE_META[type].label}</span>
        </div>
      )}
      <span className="cover-sheen" />
    </div>
  );
}
