import { useEffect, useState } from "react";
import type { MediaType, NewItemInput, SearchResult, TitleDetails } from "../types";
import { TYPE_META, TYPE_ORDER } from "../lib/catalog";
import { getTitleDetails, searchTitles } from "../lib/api";
import { selectedCoverUrl } from "../lib/cover";
import { formatDuration } from "../lib/time";
import { Cover } from "./Cover";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { TimeFields } from "./TimeFields";

const EXAMPLES: Record<MediaType, string[]> = {
  game: ["Elden Ring", "Hades", "Hollow Knight"],
  movie: ["Duna", "Interestelar", "Cidade de Deus"],
  series: ["Ruptura", "Frieren", "The Bear"],
};

function emptyTimes(): NewItemInput["gameTimes"] {
  return { main: null, mainExtra: null, completionist: null };
}

function emptyDraft(type: MediaType): NewItemInput {
  return {
    title: "",
    type,
    coverUrl: "",
    coverSource: "",
    source: "",
    externalId: "",
    externalUrl: "",
    year: null,
    description: "",
    gameTimes: emptyTimes(),
    gameTimeMode: "mainExtra",
    episodes: null,
    episodeMinutes: null,
    seasons: null,
    seasonEpisodes: [],
    selectedSeasons: [],
    speed: 1,
    runtime: null,
  };
}

function draftFromResult(result: SearchResult): NewItemInput {
  const times = result.times ?? emptyTimes();
  const mode = times.mainExtra
    ? "mainExtra"
    : times.main
      ? "main"
      : times.completionist
        ? "completionist"
        : "mainExtra";

  return {
    ...emptyDraft(result.type),
    title: result.title,
    coverUrl: result.coverUrl,
    coverSource: result.source,
    source: result.source,
    externalId: result.id,
    externalUrl: result.externalUrl ?? "",
    year: result.year,
    description: result.description ?? "",
    gameTimes: times,
    gameTimeMode: mode,
  };
}

export function AddItemModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (input: NewItemInput) => void;
}) {
  const [type, setType] = useState<MediaType>("game");
  const [mode, setMode] = useState<"search" | "configure">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [draft, setDraft] = useState<NewItemInput | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsNonce, setDetailsNonce] = useState(0);
  const [searchNonce, setSearchNonce] = useState(0);

  useEffect(() => {
    if (mode !== "search") return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    setSearchError("");

    const timer = window.setTimeout(() => {
      searchTitles(type, trimmed, controller.signal)
        .then((found) => {
          setResults(found);
          setSearching(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResults([]);
          setSearchError(error instanceof Error ? error.message : "A busca falhou.");
          setSearching(false);
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, type, mode, searchNonce]);

  useEffect(() => {
    if (!selected || type === "game") {
      setDetailsLoading(false);
      setDetailsError("");
      return;
    }

    const controller = new AbortController();
    setDetailsLoading(true);
    setDetailsError("");

    getTitleDetails(type, selected.id, controller.signal)
      .then((details: TitleDetails) => {
        setDraft((current) =>
          current
            ? {
                ...current,
                runtime: current.runtime ?? details.runtime,
                episodes: current.episodes ?? details.episodes,
                episodeMinutes: current.episodeMinutes ?? details.episodeMinutes,
                seasons: current.seasons ?? details.seasons,
                seasonEpisodes:
                  current.seasonEpisodes.length > 0
                    ? current.seasonEpisodes
                    : (details.seasonEpisodes ?? []),
                description: current.description || details.description,
              }
            : current,
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDetailsError(
          error instanceof Error && error.message
            ? error.message
            : "Não foi possível carregar a duração e os episódios. Preencha manualmente.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });

    return () => controller.abort();
  }, [selected, type, detailsNonce]);

  function changeType(next: MediaType) {
    setType(next);
    setResults([]);
    setSelected(null);
    setDraft(null);
    setMode("search");
    setSearchError("");
  }

  function backToSearch() {
    setMode("search");
    setSelected(null);
    setDraft(null);
    setDetailsError("");
    setDetailsLoading(false);
  }

  function choose(result: SearchResult) {
    setSelected(result);
    setDraft(draftFromResult(result));
    setMode("configure");
    setDetailsError("");
  }

  function startManual() {
    setSelected(null);
    setDraft(emptyDraft(type));
    setMode("configure");
    setDetailsError("");
  }

  function patchDraft(patch: Partial<NewItemInput>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function submit() {
    if (!draft || !draft.title.trim()) return;
    onAdd({ ...draft, title: draft.title.trim() });
  }

  const searchHint =
    type === "game"
      ? "Buscamos no HowLongToBeat. A capa e os três tempos ficam salvos no item."
      : type === "movie"
        ? "Buscamos no IMDb. A capa e a duração ficam salvas no item."
        : "Buscamos no IMDb. A capa, a duração e os episódios ficam salvos no item.";

  const footer =
    mode === "search" ? (
      <div className="modal-footer-row">
        <button type="button" className="text-button" onClick={startManual}>
          <Icon name="plus" size={15} />
          Cadastrar manualmente
        </button>
        <span className="footer-note">{TYPE_META[type].plural} · dados salvos localmente</span>
      </div>
    ) : (
      <div className="modal-footer-row">
        <button type="button" className="text-button" onClick={backToSearch}>
          <Icon name="arrowLeft" size={15} />
          {selected ? "Escolher outro título" : "Voltar à busca"}
        </button>
        <div className="modal-footer-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="new-item-form"
            className="primary-button"
            disabled={!draft?.title.trim()}
          >
            <Icon name="plus" size={16} />
            Adicionar à lista
          </button>
        </div>
      </div>
    );

  return (
    <Modal
      eyebrow="Nova entrada"
      title={mode === "search" ? "Adicionar ao Entretempo" : "Configurar item"}
      size="lg"
      onClose={onClose}
      footer={footer}
    >
      {mode === "search" ? (
        <div className="add-search">
          <div className="type-segmented" role="group" aria-label="Tipo de conteúdo">
            {TYPE_ORDER.map((option) => (
              <button
                key={option}
                type="button"
                className={type === option ? "is-active" : ""}
                aria-pressed={type === option}
                onClick={() => changeType(option)}
              >
                <Icon name={TYPE_META[option].icon} size={16} />
                {TYPE_META[option].label}
              </button>
            ))}
          </div>

          <label className="search-input search-input-large">
            <Icon name="search" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Buscar ${TYPE_META[type].plural.toLowerCase()} por nome...`}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            {searching ? <span className="spinner" aria-label="Buscando" /> : null}
            {query ? (
              <button
                type="button"
                className="clear-search"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
              >
                <Icon name="close" size={14} />
              </button>
            ) : null}
          </label>
          <p className="search-hint">{searchHint}</p>

          <div className="results-head">
            <h3>{results.length > 0 ? "Escolha uma capa" : "Sugestões"}</h3>
            {results.length > 0 ? <span>{results.length} opções</span> : null}
          </div>

          {searchError ? (
            <div className="search-state is-error">
              <span className="search-state-icon">
                <Icon name="info" size={20} />
              </span>
              <div>
                <strong>Não conseguimos buscar agora</strong>
                <p>{searchError}</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSearchNonce((value) => value + 1)}
              >
                Tentar de novo
              </button>
            </div>
          ) : searching && results.length === 0 ? (
            <div className="result-grid" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, index) => (
                <div className="result-skeleton" key={index}>
                  <span className="skeleton-cover" />
                  <span className="skeleton-line" />
                  <span className="skeleton-line short" />
                </div>
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="result-grid">
              {results.map((result) => (
                <button
                  type="button"
                  className="result-card"
                  key={`${result.type}-${result.id}`}
                  onClick={() => choose(result)}
                >
                  <Cover
                    src={result.thumbUrl || result.coverUrl}
                    title={result.title}
                    type={result.type}
                    className="result-cover"
                  />
                  <span className="result-copy">
                    <strong>{result.title}</strong>
                    <small>
                      {result.year ?? "—"} · {result.source}
                    </small>
                  </span>
                  {result.times?.mainExtra ? (
                    <span className="result-time">{formatDuration(result.times.mainExtra)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="search-state">
              <span className="search-state-icon">
                <Icon name="search" size={20} />
              </span>
              <div>
                <strong>Nada encontrado para “{query.trim()}”</strong>
                <p>Tente outro nome ou cadastre o item manualmente.</p>
              </div>
              <button type="button" className="secondary-button" onClick={startManual}>
                Usar entrada manual
              </button>
            </div>
          ) : (
            <div className="search-idle">
              <span className="search-idle-icon">
                <Icon name={TYPE_META[type].icon} size={24} />
              </span>
              <div>
                <strong>Procure o título que você quer colocar na fila</strong>
                <p>Digite pelo menos 2 letras. Você escolhe a capa e confirma os tempos.</p>
              </div>
              <div className="example-chips">
                {EXAMPLES[type].map((example) => (
                  <button
                    type="button"
                    className="example-chip"
                    key={example}
                    onClick={() => setQuery(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : draft ? (
        <form
          id="new-item-form"
          className="configure"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="configure-cover">
            <Cover
              src={selectedCoverUrl(draft)}
              title={draft.title || "Sem título"}
              type={draft.type}
              className="draft-cover"
            />
            {draft.externalUrl ? (
              <a
                className="small-link"
                href={draft.externalUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="external" size={13} />
                Ver no {draft.source === "HowLongToBeat" ? "HowLongToBeat" : "IMDb"}
              </a>
            ) : null}
            <p className="editor-source">
              {selected ? "Capa escolhida na busca" : "Entrada manual"}
            </p>
          </div>

          <div className="configure-main">
            <label className="field">
              <span>Título</span>
              <input
                className="text-input"
                value={draft.title}
                onChange={(event) => patchDraft({ title: event.target.value })}
                placeholder="Nome do jogo, filme ou série"
                autoFocus
                required
              />
            </label>

            <div className="configure-meta">
              <span className={`type-badge ${TYPE_META[draft.type].className}`}>
                <Icon name={TYPE_META[draft.type].icon} size={13} />
                {TYPE_META[draft.type].label}
              </span>
              {draft.year ? <span>{draft.year}</span> : null}
              {draft.source ? <span className="source-badge">{draft.source}</span> : null}
            </div>

            {!selected ? (
              <label className="field">
                <span>URL da capa (opcional)</span>
                <input
                  className="text-input"
                  value={draft.coverUrl}
                  onChange={(event) =>
                    patchDraft({ coverUrl: event.target.value, coverSource: "manual" })
                  }
                  placeholder="https://..."
                  inputMode="url"
                />
              </label>
            ) : null}

            {detailsLoading ? (
              <div className="inline-status">
                <span className="spinner" />
                Buscando episódios e duração...
              </div>
            ) : null}
            {detailsError ? (
              <div className="inline-warning">
                <Icon name="info" size={15} />
                <span>{detailsError}</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setDetailsNonce((value) => value + 1)}
                >
                  Tentar de novo
                </button>
              </div>
            ) : null}

            <section className="editor-time">
              <div className="block-head">
                <h4>Tempo de conclusão</h4>
                <span className={`type-badge ${TYPE_META[draft.type].className}`}>
                  {TYPE_META[draft.type].label}
                </span>
              </div>
              <TimeFields
                type={draft.type}
                gameTimes={draft.gameTimes}
                gameTimeMode={draft.gameTimeMode}
                episodes={draft.episodes}
                episodeMinutes={draft.episodeMinutes}
                seasons={draft.seasons}
                seasonEpisodes={draft.seasonEpisodes}
                selectedSeasons={draft.selectedSeasons}
                speed={draft.speed}
                runtime={draft.runtime}
                onChange={(patch) => patchDraft(patch)}
              />
            </section>

            <p className="field-note">
              A capa e os tempos são consultados só agora, na criação. Depois ficam salvos com o
              item — mesmo sem internet.
            </p>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
