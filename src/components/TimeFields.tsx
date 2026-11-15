import { useEffect, useId, useRef, useState, type RefObject } from "react";
import type { GameTimeMode, Item, MediaType, SeasonEpisodes, Speed } from "../types";
import { GAME_MODE_META, SPEEDS } from "../lib/catalog";
import {
  formatDuration,
  formatSpeed,
  hoursInputToMinutes,
  minutesToHoursInput,
} from "../lib/time";
import { Icon } from "./Icon";

export type TimePatch = Partial<
  Pick<
    Item,
    | "gameTimes"
    | "gameTimeMode"
    | "episodes"
    | "episodeMinutes"
    | "seasons"
    | "selectedSeasons"
    | "speed"
    | "runtime"
  >
>;

function useSyncedText(value: string, focused: RefObject<boolean>) {
  const [text, setText] = useState(value);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value, focused]);

  return [text, setText] as const;
}

function HoursInput({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
  label: string;
}) {
  const focused = useRef(false);
  const [text, setText] = useSyncedText(minutesToHoursInput(value), focused);

  return (
    <input
      className="inline-number"
      type="text"
      inputMode="decimal"
      value={text}
      aria-label={label}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setText(minutesToHoursInput(value));
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*[.,]?\d*$/.test(next)) return;
        setText(next);
        onChange(hoursInputToMinutes(next));
      }}
      placeholder="0"
    />
  );
}

function NumberInput({
  value,
  onChange,
  label,
  placeholder = "0",
  max = 100000,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  placeholder?: string;
  max?: number;
}) {
  const focused = useRef(false);
  const [text, setText] = useSyncedText(value === null ? "" : String(value), focused);

  return (
    <input
      className="inline-number"
      type="text"
      inputMode="numeric"
      value={text}
      aria-label={label}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setText(value === null ? "" : String(value));
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*$/.test(next)) return;
        setText(next);
        const parsed = Number(next);
        if (next === "" || !Number.isFinite(parsed) || parsed <= 0) {
          onChange(null);
        } else {
          onChange(Math.min(max, Math.round(parsed)));
        }
      }}
      placeholder={placeholder}
    />
  );
}

export function TimeFields({
  type,
  gameTimes,
  gameTimeMode,
  episodes,
  episodeMinutes,
  seasons,
  seasonEpisodes,
  selectedSeasons,
  speed,
  runtime,
  onChange,
}: {
  type: MediaType;
  gameTimes: Item["gameTimes"];
  gameTimeMode: GameTimeMode;
  episodes: number | null;
  episodeMinutes: number | null;
  seasons: number | null;
  seasonEpisodes: SeasonEpisodes[] | null;
  selectedSeasons: number[] | null;
  speed: Speed;
  runtime: number | null;
  onChange: (patch: TimePatch) => void;
}) {
  const radioName = useId();
  const modes: GameTimeMode[] = ["main", "mainExtra", "completionist"];
  // Dados antigos ou respostas incompletas da API podem chegar sem esses campos.
  const seasonList = seasonEpisodes ?? [];
  const selectedList = selectedSeasons ?? [];

  if (type === "game") {
    return (
      <div className="time-fields">
        <div className="mode-list">
          {modes.map((mode) => {
            const meta = GAME_MODE_META[mode];
            const active = gameTimeMode === mode;
            return (
              <label key={mode} className={`mode-card ${active ? "is-active" : ""}`}>
                <input
                  type="radio"
                  name={radioName}
                  checked={active}
                  onChange={() => onChange({ gameTimeMode: mode })}
                />
                <span className="mode-radio" aria-hidden="true" />
                <span className="mode-copy">
                  <strong>{meta.label}</strong>
                  <small>{meta.hint}</small>
                </span>
                <span className="mode-hours">
                  <HoursInput
                    value={gameTimes[mode]}
                    label={`Tempo de ${meta.label} em horas`}
                    onChange={(minutes) =>
                      onChange({ gameTimes: { ...gameTimes, [mode]: minutes } })
                    }
                  />
                  <span>h</span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="time-total">
          <span>
            <Icon name="timer" size={15} />
            Tempo escolhido
          </span>
          <strong>{formatDuration(gameTimes[gameTimeMode])}</strong>
        </div>
        <p className="field-note">
          Os três tempos do HowLongToBeat ficam salvos neste item. Edite qualquer valor se precisar.
        </p>
      </div>
    );
  }

  if (type === "series") {
    const total = episodes && episodeMinutes ? (episodes * episodeMinutes) / speed : null;
    const totalSeasonEpisodes = seasonList.reduce((sum, entry) => sum + entry.episodes, 0);
    const allSeasons = selectedList.length === 0;
    const selectedCount = allSeasons ? seasonList.length : selectedList.length;
    const selectedEpisodeTotal = allSeasons
      ? totalSeasonEpisodes
      : seasonList
          .filter((entry) => selectedList.includes(entry.season))
          .reduce((sum, entry) => sum + entry.episodes, 0);

    function chooseSeasons(next: number[]) {
      const unique = [...new Set(next)]
        .filter((season) => seasonList.some((entry) => entry.season === season))
        .sort((first, second) => first - second);

      if (unique.length === 0) {
        onChange({
          selectedSeasons: [],
          episodes: totalSeasonEpisodes,
          seasons: seasonList.length,
        });
        return;
      }

      const chosen = seasonList.filter((entry) => unique.includes(entry.season));
      onChange({
        selectedSeasons: unique,
        episodes: chosen.reduce((sum, entry) => sum + entry.episodes, 0),
        seasons: chosen.length,
      });
    }

    function toggleSeason(season: number) {
      if (allSeasons) {
        chooseSeasons([season]);
        return;
      }

      chooseSeasons(
        selectedList.includes(season)
          ? selectedList.filter((entry) => entry !== season)
          : [...selectedList, season],
      );
    }

    return (
      <div className="time-fields">
        {seasonList.length > 0 ? (
          <div className="season-block">
            <div className="season-head">
              <span className="season-label">Temporadas</span>
              <span className="season-summary">
                {allSeasons
                  ? `Todas · ${totalSeasonEpisodes} eps`
                  : `${selectedCount} ${selectedCount === 1 ? "temporada" : "temporadas"} · ${selectedEpisodeTotal} eps`}
              </span>
            </div>
            <div className="season-chips" role="group" aria-label="Temporadas da série">
              <button
                type="button"
                className={`season-chip wide ${allSeasons ? "is-active" : ""}`}
                aria-pressed={allSeasons}
                onClick={() => chooseSeasons([])}
              >
                Todas
              </button>
              {seasonList.map((entry) => {
                const active = !allSeasons && selectedList.includes(entry.season);
                return (
                  <button
                    key={entry.season}
                    type="button"
                    className={`season-chip ${active ? "is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => toggleSeason(entry.season)}
                  >
                    <strong>T{entry.season}</strong>
                    <span>{entry.episodes} eps</span>
                  </button>
                );
              })}
            </div>
            <p className="field-note">
              Clique em uma temporada para considerar só ela; selecione mais de uma para somar os
              episódios.
            </p>
          </div>
        ) : null}

        <div className="field-row field-row-3">
          <label className="field">
            <span>Episódios</span>
            <NumberInput
              value={episodes}
              label="Quantidade de episódios"
              onChange={(value) => onChange({ episodes: value })}
            />
          </label>
          <label className="field">
            <span>Min. por episódio</span>
            <NumberInput
              value={episodeMinutes}
              label="Minutos por episódio"
              onChange={(value) => onChange({ episodeMinutes: value })}
            />
          </label>
          <label className="field">
            <span>Temporadas</span>
            <NumberInput
              value={seasons}
              label="Quantidade de temporadas"
              onChange={(value) => onChange({ seasons: value })}
            />
          </label>
        </div>

        <div className="speed-row">
          <span className="speed-label">Velocidade de exibição</span>
          <div className="segmented" role="group" aria-label="Velocidade de exibição">
            {SPEEDS.map((option) => (
              <button
                key={option}
                type="button"
                className={speed === option ? "is-active" : ""}
                aria-pressed={speed === option}
                onClick={() => onChange({ speed: option as Speed })}
              >
                {formatSpeed(option)}
              </button>
            ))}
          </div>
        </div>

        <div className="time-total">
          <span>
            <Icon name="timer" size={15} />
            Tempo total
            {speed !== 1 ? <em> em {formatSpeed(speed)}</em> : null}
          </span>
          <strong>{formatDuration(total)}</strong>
        </div>
        <p className="field-note">
          Episódios e duração vêm do IMDb. O tempo total é recalculado conforme a velocidade.
        </p>
      </div>
    );
  }

  return (
    <div className="time-fields">
      <div className="field-row">
        <label className="field field-duration">
          <span>Duração do filme (minutos)</span>
          <NumberInput
            value={runtime}
            label="Duração do filme em minutos"
            placeholder="120"
            max={1000}
            onChange={(value) => onChange({ runtime: value })}
          />
        </label>
      </div>
      <div className="time-total">
        <span>
          <Icon name="timer" size={15} />
          Tempo total
        </span>
        <strong>{formatDuration(runtime)}</strong>
      </div>
      <p className="field-note">A duração é preenchida pelo IMDb. Ajuste se quiser.</p>
    </div>
  );
}
