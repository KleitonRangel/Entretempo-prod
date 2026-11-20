import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { getSession, onAuthChange } from "./lib/auth";
import { loadFromSupabase, syncToSupabase } from "./lib/storage";
import { makeItem } from "./test/fixtures";

vi.mock("./lib/auth", () => ({
  getSession: vi.fn(),
  onAuthChange: vi.fn(() => () => {}),
  signOut: vi.fn(),
}));

vi.mock("./lib/storage", () => ({
  loadFromSupabase: vi.fn(),
  syncToSupabase: vi.fn(),
  clearSupabase: vi.fn(),
  createItem: vi.fn((input) => ({ ...input, id: "new", status: "current", order: 0 })),
  seedItems: vi.fn(() => []),
}));

const getSessionMock = vi.mocked(getSession);
const onAuthChangeMock = vi.mocked(onAuthChange);
const loadMock = vi.mocked(loadFromSupabase);
const syncMock = vi.mocked(syncToSupabase);

const session = { user: { id: "user-1", email: "a@b.com" } } as never;

beforeEach(() => {
  getSessionMock.mockReset();
  onAuthChangeMock.mockReset();
  onAuthChangeMock.mockReturnValue(() => {});
  loadMock.mockReset();
  syncMock.mockReset();
});

describe("App — autenticação", () => {
  it("mostra a tela de login quando não há sessão", async () => {
    getSessionMock.mockResolvedValue(null);

    render(<App />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  });

  it("entra no app e carrega os itens do usuário autenticado", async () => {
    getSessionMock.mockResolvedValue(session);
    loadMock.mockResolvedValue([makeItem({ id: "cloud-1", title: "Jogo da nuvem", type: "game" })]);

    render(<App />);

    expect(await screen.findByText("Jogo da nuvem")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(loadMock).toHaveBeenCalledWith("user-1");
  });

  it("usa itens de exemplo quando a conta ainda não tem nada", async () => {
    getSessionMock.mockResolvedValue(session);
    loadMock.mockResolvedValue([]);

    render(<App />);

    expect(await screen.findByText("Sua fila está livre")).toBeInTheDocument();
    expect(loadMock).toHaveBeenCalledWith("user-1");
  });
});
