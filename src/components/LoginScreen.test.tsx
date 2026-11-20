import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "./LoginScreen";
import { signIn, signUp } from "../lib/auth";

vi.mock("../lib/auth", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

const signInMock = vi.mocked(signIn);
const signUpMock = vi.mocked(signUp);

beforeEach(() => {
  signInMock.mockReset();
  signUpMock.mockReset();
});

describe("LoginScreen", () => {
  it("mostra campos de email e senha", () => {
    render(<LoginScreen />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Entrar$/ })).toBeInTheDocument();
  });

  it("entra com email e senha válidos", async () => {
    signInMock.mockResolvedValue({} as never);
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "segredo");
    await user.click(screen.getByRole("button", { name: /^Entrar$/ }));

    expect(signInMock).toHaveBeenCalledWith("a@b.com", "segredo");
  });

  it("exibe a mensagem de erro devolvida pela autenticação", async () => {
    signInMock.mockRejectedValue(new Error("Email ou senha incorretos."));
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "errada1");
    await user.click(screen.getByRole("button", { name: /^Entrar$/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email ou senha incorretos.");
  });

  it("cria conta e avisa sobre a confirmação por email", async () => {
    signUpMock.mockResolvedValue({ session: null, needsConfirmation: true });
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await user.type(screen.getByLabelText("Email"), "novo@b.com");
    await user.type(screen.getByLabelText("Senha"), "segredo");
    await user.click(screen.getByRole("button", { name: /^Criar conta$/ }));

    expect(signUpMock).toHaveBeenCalledWith("novo@b.com", "segredo");
    expect(await screen.findByRole("status")).toHaveTextContent(/confirme seu email/i);
  });
});
