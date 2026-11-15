import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { ItemCard } from "./ItemCard";
import type { Item } from "../types";
import { makeItem, slimeSeasons } from "../test/fixtures";

const api = vi.hoisted(() => ({
  getTitleDetails: vi.fn(),
}));

vi.mock("../lib/api", () => api);

function renderCard(item: Item, onPatch = vi.fn()) {
  render(
    <DndContext>
      <SortableContext items={[item.id]}>
        <ItemCard
          item={item}
          expanded
          dragDisabled
          onToggleExpand={vi.fn()}
          onPatch={onPatch}
          onOpenCover={vi.fn()}
          onMove={vi.fn()}
          onDelete={vi.fn()}
          onToggleProgress={vi.fn()}
        />
      </SortableContext>
    </DndContext>,
  );
  return onPatch;
}

describe("ItemCard (série sem temporadas salvas)", () => {
  beforeEach(() => {
    api.getTitleDetails.mockResolvedValue({
      id: "tt9054364",
      type: "series",
      runtime: 24,
      episodeMinutes: 24,
      episodes: 96,
      seasons: 4,
      seasonEpisodes: slimeSeasons,
      description: "",
      genres: [],
      rating: "8.0",
    });
  });

  it("busca a quebra por temporada ao abrir o item antigo", async () => {
    const onPatch = renderCard(
      makeItem({
        id: "slime-antigo",
        title: "That Time I Got Reincarnated as a Slime",
        externalId: "tt9054364",
        episodes: 96,
        episodeMinutes: 24,
        seasons: 4,
        seasonEpisodes: [],
        selectedSeasons: [],
      }),
    );

    await waitFor(() =>
      expect(onPatch).toHaveBeenCalledWith(
        expect.objectContaining({
          seasonEpisodes: slimeSeasons,
          seasons: 4,
          episodes: 96,
        }),
      ),
    );
    expect(api.getTitleDetails).toHaveBeenCalledWith(
      "series",
      "tt9054364",
      expect.any(AbortSignal),
    );
  });

  it("mostra as temporadas quando elas já estão salvas", () => {
    const onPatch = renderCard(
      makeItem({
        episodes: 48,
        episodeMinutes: 24,
        seasons: 2,
        seasonEpisodes: slimeSeasons.slice(0, 2),
        speed: 1.5,
      }),
    );

    expect(screen.getByRole("button", { name: /T2.*24 eps/ })).toBeInTheDocument();
    expect(screen.getByText("2 temp. · 48 eps · 1,5x")).toBeInTheDocument();
    expect(api.getTitleDetails).not.toHaveBeenCalled();
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("mostra a capa da temporada escolhida", () => {
    const seasonCover =
      "https://static.tvmaze.com/uploads/images/original_untouched/190/475422.jpg";

    renderCard(
      makeItem({
        coverUrl: "https://images.metahub.space/poster/large/tt9054364/img",
        episodes: 24,
        episodeMinutes: 24,
        seasons: 1,
        selectedSeasons: [2],
        seasonEpisodes: [
          { season: 1, episodes: 24 },
          { season: 2, episodes: 24, coverUrl: seasonCover },
        ],
      }),
    );

    const image = document.querySelector(".item-cover img");
    expect(image?.getAttribute("src")).toContain(encodeURIComponent(seasonCover));
  });

  it("avisa quando o item não tem identificador externo", () => {
    renderCard(makeItem({ externalId: "", seasonEpisodes: [] }));

    expect(screen.getByText("Este item não tem dados de temporada.")).toBeInTheDocument();
    expect(api.getTitleDetails).not.toHaveBeenCalled();
  });

  it("oferece tentar de novo quando a busca falha", async () => {
    api.getTitleDetails.mockRejectedValueOnce(new Error("sem rede"));

    renderCard(makeItem({ externalId: "tt9054364", seasonEpisodes: [] }));

    expect(
      await screen.findByRole("button", { name: "Tentar de novo" }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
