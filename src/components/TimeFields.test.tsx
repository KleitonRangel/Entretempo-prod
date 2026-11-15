import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Item } from "../types";
import { TimeFields } from "./TimeFields";
import { makeItem, slimeSeasons } from "../test/fixtures";

function SeriesHarness({ initial }: { initial: Partial<Item> }) {
  const [item, setItem] = useState(
    makeItem({
      episodes: 96,
      episodeMinutes: 24,
      seasons: 4,
      seasonEpisodes: slimeSeasons,
      ...initial,
    }),
  );

  return (
    <TimeFields
      type="series"
      gameTimes={item.gameTimes}
      gameTimeMode={item.gameTimeMode}
      episodes={item.episodes}
      episodeMinutes={item.episodeMinutes}
      seasons={item.seasons}
      seasonEpisodes={item.seasonEpisodes}
      selectedSeasons={item.selectedSeasons}
      speed={item.speed}
      runtime={item.runtime}
      onChange={(patch) => setItem((current) => ({ ...current, ...patch }))}
    />
  );
}

describe("TimeFields (séries)", () => {
  it("mostra todas as temporadas com a quebra de episódios", () => {
    render(<SeriesHarness initial={{}} />);

    expect(screen.getByText("Todas · 96 eps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /T1.*24 eps/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /T4.*24 eps/ })).toBeInTheDocument();
    expect(screen.getByText("38h 24min")).toBeInTheDocument();
  });

  it("ao escolher T2, considera só a temporada 2", () => {
    render(<SeriesHarness initial={{}} />);

    fireEvent.click(screen.getByRole("button", { name: /T2.*24 eps/ }));

    expect(screen.getByText("1 temporada · 24 eps")).toBeInTheDocument();
    expect(screen.getByText("9h 36min")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade de episódios")).toHaveValue("24");
    expect(screen.getByLabelText("Quantidade de temporadas")).toHaveValue("1");
    expect(screen.getByRole("button", { name: /T2.*24 eps/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("soma temporadas selecionadas e recalcula na velocidade escolhida", () => {
    render(<SeriesHarness initial={{}} />);

    fireEvent.click(screen.getByRole("button", { name: /T2.*24 eps/ }));
    fireEvent.click(screen.getByRole("button", { name: /T3.*24 eps/ }));

    expect(screen.getByText("2 temporadas · 48 eps")).toBeInTheDocument();
    expect(screen.getByText("19h 12min")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1,5x" }));
    expect(screen.getByText("12h 48min")).toBeInTheDocument();
  });

  it("volta para todas as temporadas", () => {
    render(<SeriesHarness initial={{ selectedSeasons: [2, 3] }} />);

    expect(screen.getByText("2 temporadas · 48 eps")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todas" }));

    expect(screen.getByText("Todas · 96 eps")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade de episódios")).toHaveValue("96");
    expect(screen.getByLabelText("Quantidade de temporadas")).toHaveValue("4");
  });

  it("remove uma temporada clicando novamente", () => {
    render(<SeriesHarness initial={{ selectedSeasons: [2, 3] }} />);

    fireEvent.click(screen.getByRole("button", { name: /T2.*24 eps/ }));

    expect(screen.getByText("1 temporada · 24 eps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /T2.*24 eps/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /T3.*24 eps/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("não quebra quando a API devolve temporadas nulas", () => {
    render(
      <SeriesHarness initial={{ seasonEpisodes: null as unknown as [], selectedSeasons: null as unknown as [] }} />,
    );

    expect(screen.queryByRole("button", { name: "Todas" })).not.toBeInTheDocument();
    expect(screen.getByText("Episódios")).toBeInTheDocument();
    expect(screen.getByText("38h 24min")).toBeInTheDocument();
  });
});
