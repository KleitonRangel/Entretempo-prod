import { useEffect, useState } from "react";
import type { MediaType, SearchResult } from "../types";
import { TYPE_META } from "../lib/catalog";
import { searchTitles } from "../lib/api";
import { Cover } from "./Cover";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export function CoverPicker({
  type,
  initialQuery,
  currentCover,
  onSelect,
  onClose,
}: {
  type: MediaType;
  initialQuery: string;
  currentCover: string;
  onSelect: (coverUrl: string, source: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [manualUrl, setManualUrl] = useState(currentCover);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    setError("");

    const timer = window.setTimeout(() => {
      searchTitles(type, trimmed, controller.signal)
        .then((found) => {
          setResults(found);
          setSearching(false);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          setResults([]);
          setError(reason instanceof Error ? reason.message : "A busca falhou.");
          setSearching(false);
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, type, nonce]);

  function applyManual() {
    const trimmed = manualUrl.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      setError("Use um endereço de imagem começando com http:// ou https://.");
      return;
    }
    onSelect(trimmed, "manual");
    onClose();
  }

  return (
    <Modal
      eyebrow="Personalizar"
      title="Trocar capa"
      size="md"
      onClose={onClose}
      footer={
        <div className="modal-footer-row">
          {currentCover ? (
            <button
              type="button"
              className="text-button is-danger"
              onClick={() => {
                onSelect("", "");
                onClose();
              }}
            >
              <Icon name="trash" size={14} />
              Remover capa
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="secondary-button" onClick={onClose}>
            Fechar
          </button>
        </div>
      }
    >
      <div className="cover-picker">
        <p className="search-hint">
          Buscando capas de {TYPE_META[type].plural.toLowerCase()} para “{initialQuery}”.
        </p>

        <label className="search-input">
          <Icon name="search" size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar outro título..."
            autoComplete="off"
            spellCheck={false}
          />
          {searching ? <span className="spinner" aria-label="Buscando" /> : null}
          {query ? (
            <button
              type="button"
              className="clear-search"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
            >
              <Icon name="close" size={13} />
            </button>
          ) : null}
        </label>

        {error && !searching ? (
          <div className="inline-warning">
            <Icon name="info" size={15} />
            <span>{error}</span>
            <button
              type="button"
              className="text-button"
              onClick={() => setNonce((value) => value + 1)}
            >
              Tentar de novo
            </button>
          </div>
        ) : null}

        {searching && results.length === 0 ? (
          <div className="result-grid result-grid-small" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, index) => (
              <div className="result-skeleton" key={index}>
                <span className="skeleton-cover" />
                <span className="skeleton-line" />
              </div>
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="result-grid result-grid-small">
            {results.map((result) => (
              <button
                type="button"
                className={`result-card ${result.coverUrl === currentCover ? "is-selected" : ""}`}
                key={`${result.type}-${result.id}`}
                onClick={() => {
                  if (!result.coverUrl) return;
                  onSelect(result.coverUrl, result.source);
                  onClose();
                }}
              >
                <Cover
                  src={result.thumbUrl || result.coverUrl}
                  title={result.title}
                  type={type}
                  className="result-cover"
                />
                <span className="result-copy">
                  <strong>{result.title}</strong>
                  <small>
                    {result.year ?? "—"} · {result.source}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : query.trim().length >= 2 ? (
          <div className="search-state compact">
            <div>
              <strong>Nenhuma capa encontrada</strong>
              <p>Tente outro nome ou cole uma URL de imagem abaixo.</p>
            </div>
          </div>
        ) : null}

        <div className="manual-cover">
          <span className="manual-cover-label">Ou use uma URL de imagem</span>
          <div className="manual-cover-row">
            <input
              className="text-input"
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              placeholder="https://exemplo.com/capa.jpg"
              inputMode="url"
            />
            <button type="button" className="secondary-button" onClick={applyManual}>
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
