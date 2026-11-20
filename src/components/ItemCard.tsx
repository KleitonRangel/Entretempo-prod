import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Item, MediaType, Status } from "../types";
import { getTitleDetails } from "../lib/api";
import { selectedCoverUrl, seasonCoverUrl } from "../lib/cover";
import { TYPE_META, TYPE_ORDER } from "../lib/catalog";
import { formatDuration, itemDuration, itemFootnote, itemTimeDetail } from "../lib/time";
import { Cover } from "./Cover";
import { Icon } from "./Icon";
import { TimeFields, type TimePatch } from "./TimeFields";

type CardProps = {
  item: Item;
  expanded: boolean;
  dragDisabled: boolean;
  highlighted?: boolean;
  onToggleExpand: () => void;
  onPatch: (patch: Partial<Item>) => void;
  onOpenCover: () => void;
  onMove: (status: Status) => void;
  onDelete: () => void;
  onToggleProgress: () => void;
};

export function ItemCard({
  item,
  expanded,
  dragDisabled,
  highlighted = false,
  onToggleExpand,
  onPatch,
  onOpenCover,
  onMove,
  onDelete,
  onToggleProgress,
}: CardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: dragDisabled });

  const meta = TYPE_META[item.type];
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      id={`item-${item.id}`}
      style={style}
      className={[
        "item-card",
        item.inProgress ? "is-progress" : "",
        expanded ? "is-expanded" : "",
        isDragging ? "is-dragging" : "",
        highlighted ? "just-added" : "",
        item.status === "discarded" ? "is-muted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="item-row">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="drag-handle"
          {...attributes}
          {...listeners}
          disabled={dragDisabled}
          aria-label={`Arrastar ${item.title} para reordenar`}
          title={dragDisabled ? "Limpe a busca para reordenar" : "Arrastar para reordenar"}
        >
          <Icon name="grip" size={16} />
        </button>

        <div
          className="item-open"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={onToggleExpand}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggleExpand();
            }
          }}
        >
          <Cover src={selectedCoverUrl(item)} title={item.title} type={item.type} className="item-cover" />

          <div className="item-info">
            <div className="item-topline">
              <span className={`type-badge ${meta.className}`}>
                <Icon name={meta.icon} size={13} />
                {meta.label}
              </span>
              {item.inProgress ? (
                <span className="progress-pill">
                  <span className="pulse-dot" />
                  Em andamento
                </span>
              ) : null}
              {item.sample ? <span className="sample-badge">exemplo</span> : null}
            </div>

            <h3>{item.title}</h3>

            <div className="item-meta">
              <span className="item-time">
                <Icon name="clock" size={15} />
                {formatDuration(itemDuration(item))}
              </span>
              <span className="meta-sep">·</span>
              <span className="item-detail">{itemTimeDetail(item)}</span>
            </div>

            <p className="item-foot">{itemFootnote(item)}</p>
          </div>
        </div>

        <div className="item-actions">
          {item.status === "current" ? (
            <>
              <button
                type="button"
                className={`rail-button ${item.inProgress ? "is-active" : ""}`}
                onClick={onToggleProgress}
                title={item.inProgress ? "Pausar em andamento" : "Marcar como em andamento"}
                aria-label={
                  item.inProgress ? "Pausar em andamento" : "Marcar como em andamento"
                }
                aria-pressed={item.inProgress}
              >
                <Icon name={item.inProgress ? "pause" : "play"} size={15} />
              </button>
              <button
                type="button"
                className="rail-button"
                onClick={() => onMove("finished")}
                title="Finalizar"
                aria-label={`Finalizar ${item.title}`}
              >
                <Icon name="check" size={16} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rail-button"
              onClick={() => onMove("current")}
              title="Voltar para Agora"
              aria-label={`Mover ${item.title} para Agora`}
            >
              <Icon name="arrowUp" size={16} />
            </button>
          )}

          <button
            type="button"
            className={`rail-button chevron-button ${expanded ? "is-open" : ""}`}
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={expanded ? "Recolher detalhes" : "Abrir detalhes"}
          >
            <Icon name="chevronDown" size={17} />
          </button>
        </div>
      </div>

      {expanded ? (
        <ItemEditor
          item={item}
          onPatch={onPatch}
          onOpenCover={onOpenCover}
          onMove={onMove}
          onDelete={onDelete}
          onToggleProgress={onToggleProgress}
        />
      ) : null}
    </article>
  );
}

function ItemEditor({
  item,
  onPatch,
  onOpenCover,
  onMove,
  onDelete,
  onToggleProgress,
}: {
  item: Item;
  onPatch: (patch: Partial<Item>) => void;
  onOpenCover: () => void;
  onMove: (status: Status) => void;
  onDelete: () => void;
  onToggleProgress: () => void;
}) {
  const typeMeta = TYPE_META[item.type];
  const usingSeasonCover =
    item.type === "series" &&
    item.selectedSeasons.some((season) => seasonCoverUrl(item.seasonEpisodes, season) !== null);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [seasonsError, setSeasonsError] = useState(false);
  const [seasonsAttempt, setSeasonsAttempt] = useState(0);
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;

  const seasonCount = item.seasonEpisodes?.length ?? 0;

  // Itens salvos antes da quebra por temporada (ou criados com a API fora do ar)
  // se completam ao abrir o card, sem exigir recriar o item.
  useEffect(() => {
    if (item.type !== "series" || seasonCount > 0 || !item.externalId) return;

    const controller = new AbortController();
    setSeasonsLoading(true);
    setSeasonsError(false);

    getTitleDetails("series", item.externalId, controller.signal)
      .then((details) => {
        const list = details.seasonEpisodes ?? [];
        if (list.length === 0) {
          setSeasonsError(true);
          return;
        }
        onPatchRef.current({
          seasonEpisodes: list,
          seasons: item.seasons ?? details.seasons,
          episodes: item.episodes ?? details.episodes,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSeasonsError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSeasonsLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.type, item.externalId, seasonCount, item.seasons, item.episodes, seasonsAttempt]);

  return (
    <div className="item-editor">
      <div className="editor-side">
        <Cover
          src={selectedCoverUrl(item)}
          title={item.title}
          type={item.type}
          className="editor-cover"
        />
        <div className="editor-cover-actions">
          <button type="button" className="small-button" onClick={onOpenCover}>
            <Icon name="image" size={14} />
            Trocar capa
          </button>
          {item.externalUrl ? (
            <a
              className="small-link"
              href={item.externalUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="external" size={13} />
              {item.source === "HowLongToBeat" ? "HowLongToBeat" : "IMDb"}
            </a>
          ) : null}
          {item.coverUrl ? (
            <button
              type="button"
              className="small-link danger-link"
              onClick={() => onPatch({ coverUrl: "", coverSource: "" })}
            >
              Remover capa
            </button>
          ) : null}
        </div>
        <p className="editor-source">
          {usingSeasonCover
            ? "Capa da temporada selecionada"
            : item.sample
              ? "Item de exemplo"
              : item.source
                ? `Capa e tempos salvos · ${item.source}`
                : "Sincronizado com sua conta"}
        </p>
      </div>

      <div className="editor-main">
        <div className="editor-grid">
          <label className="field">
            <span>Título</span>
            <input
              className="text-input"
              value={item.title}
              onChange={(event) => onPatch({ title: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Tipo</span>
            <select
              className="text-input"
              value={item.type}
              onChange={(event) => onPatch({ type: event.target.value as MediaType })}
            >
              {TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {TYPE_META[type].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="editor-time">
          <div className="block-head">
            <h4>Tempo de conclusão</h4>
            <span className={`type-badge ${typeMeta.className}`}>
              <Icon name={typeMeta.icon} size={13} />
              {typeMeta.label}
            </span>
          </div>
          {item.type === "series" && seasonCount === 0 ? (
            <div className="inline-status season-status">
              {seasonsLoading ? (
                <>
                  <span className="spinner" />
                  <span>Buscando temporadas...</span>
                </>
              ) : seasonsError ? (
                <>
                  <Icon name="info" size={15} />
                  <span>Não conseguimos carregar as temporadas.</span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setSeasonsAttempt((value) => value + 1)}
                  >
                    Tentar de novo
                  </button>
                </>
              ) : !item.externalId ? (
                <>
                  <Icon name="info" size={15} />
                  <span>Este item não tem dados de temporada.</span>
                </>
              ) : null}
            </div>
          ) : null}
          <TimeFields
            type={item.type}
            gameTimes={item.gameTimes}
            gameTimeMode={item.gameTimeMode}
            episodes={item.episodes}
            episodeMinutes={item.episodeMinutes}
            seasons={item.seasons}
            seasonEpisodes={item.seasonEpisodes}
            selectedSeasons={item.selectedSeasons}
            speed={item.speed}
            runtime={item.runtime}
            onChange={(patch: TimePatch) => onPatch(patch)}
          />
        </section>

        <div className="editor-bottom">
          <button
            type="button"
            role="switch"
            aria-checked={item.inProgress}
            className={`switch-row ${item.inProgress ? "is-on" : ""}`}
            onClick={onToggleProgress}
            disabled={item.status !== "current"}
          >
            <span className="switch-track" aria-hidden="true">
              <span />
            </span>
            <span className="switch-copy">
              <strong>Em andamento</strong>
              <small>
                {item.status === "current"
                  ? "Destaca o item com uma borda na sua lista"
                  : "Disponível apenas na lista Agora"}
              </small>
            </span>
          </button>

          <div className="editor-actions">
            {item.status === "current" ? (
              <>
                <button
                  type="button"
                  className="status-button"
                  onClick={() => onMove("finished")}
                >
                  <Icon name="check" size={15} />
                  Finalizar
                </button>
                <button
                  type="button"
                  className="status-button"
                  onClick={() => onMove("discarded")}
                >
                  <Icon name="close" size={15} />
                  Descartar
                </button>
              </>
            ) : (
              <button
                type="button"
                className="status-button"
                onClick={() => onMove("current")}
              >
                <Icon name="arrowUp" size={15} />
                Voltar para Agora
              </button>
            )}
            <button
              type="button"
              className="status-button is-danger"
              onClick={onDelete}
              title="Excluir item"
            >
              <Icon name="trash" size={15} />
              Excluir
            </button>
          </div>
        </div>

        <p className="autosave-note">
          <Icon name="check" size={12} />
          Alterações sincronizadas automaticamente
        </p>
      </div>
    </div>
  );
}
