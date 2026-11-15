import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AddItemModal } from "./AddItemModal";
import type { SearchResult } from "../types";
import { slimeSeasons } from "../test/fixtures";

const api = vi.hoisted(() => ({
  searchTitles: vi.fn(),
  getTitleDetails: vi.fn(),
}));

vi.mock("../lib/api", () => api);

const slime: SearchResult = {
  id: "tt9054364",
  type: "series",
  title: "That Time I Got Reincarnated as a Slime",
  year: 2018,
  coverUrl: "https://images.metahub.space/poster/large/tt9054364/img",
  thumbUrl: "https://images.metahub.space/poster/medium/tt9054364/img",
  source: "Cinemeta",
  externalUrl: "https://www.imdb.com/title/tt9054364/",
};

const details = {
  id: "tt9054364",
  type: "series" as const,
  runtime: 24,
  episodeMinutes: 24,
  episodes: 96,
  seasons: 4,
  seasonEpisodes: slimeSeasons,
  description: "",
  genres: [],
  rating: "8.0",
};

function renderModal(onAdd = vi.fn()) {
  render(<AddItemModal onClose={vi.fn()} onAdd={onAdd} />);
  return onAdd;
}

async function searchSeries(query = "slime") {
  fireEvent.click(screen.getByRole("button", { name: "Série" }));
  fireEvent.change(screen.getByPlaceholderText("Buscar séries por nome..."), {
    target: { value: query },
  });
  return screen.findByRole(
    "button",
    { name: /That Time I Got Reincarnated as a Slime/ },
    { timeout: 3000 },
  );
}

describe("AddItemModal (séries com temporadas)", () => {
  beforeEach(() => {
    api.searchTitles.mockResolvedValue([slime]);
    api.getTitleDetails.mockResolvedValue(details);
  });

  it("libera as temporadas depois de carregar os detalhes", async () => {
    renderModal();
    fireEvent.click(await searchSeries());

    expect(await screen.findByText("Todas · 96 eps", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /T2.*24 eps/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Quantidade de episódios")).toHaveValue("96"),
    );
  });

  it("envia a temporada escolhida ao adicionar", async () => {
    const onAdd = renderModal();
    fireEvent.click(await searchSeries());
    await screen.findByText("Todas · 96 eps", {}, { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: /T2.*24 eps/ }));

    expect(screen.getByText("1 temporada · 24 eps")).toBeInTheDocument();
    expect(screen.getByText("9h 36min")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar à lista" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const payload = onAdd.mock.calls[0][0];
    expect(payload.type).toBe("series");
    expect(payload.selectedSeasons).toEqual([2]);
    expect(payload.seasons).toBe(1);
    expect(payload.episodes).toBe(24);
    expect(payload.seasonEpisodes).toEqual(slimeSeasons);
  });

  it("permite tentar de novo quando os detalhes falham", async () => {
    api.getTitleDetails.mockRejectedValueOnce(new Error("servidor fora do ar"));

    renderModal();
    fireEvent.click(await searchSeries());

    const retry = await screen.findByRole(
      "button",
      { name: "Tentar de novo" },
      { timeout: 3000 },
    );
    expect(screen.queryByText("Todas · 96 eps")).not.toBeInTheDocument();

    fireEvent.click(retry);

    expect(await screen.findByText("Todas · 96 eps", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(api.getTitleDetails).toHaveBeenCalledTimes(2);
  });

  it("explica quando o título não tem episódios no IMDb e volta para a busca", async () => {
    api.getTitleDetails.mockRejectedValueOnce(
      new Error("Esse título não tem episódios cadastrados no IMDb."),
    );

    renderModal();
    fireEvent.click(await searchSeries());

    expect(
      await screen.findByText("Esse título não tem episódios cadastrados no IMDb."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Escolher outro título"));

    expect(screen.getByPlaceholderText("Buscar séries por nome...")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade de episódios")).not.toBeInTheDocument();
  });
});
