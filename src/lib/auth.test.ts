import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSession,
  onAuthChange,
  signIn,
  signOut,
  signUp,
  translateAuthError,
} from "./auth";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: { auth: mocks },
}));

const session = { user: { id: "user-1", email: "a@b.com" } } as never;

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("translateAuthError", () => {
  it("traduz os erros mais comuns do Supabase", () => {
    expect(translateAuthError("Invalid login credentials")).toBe("Email ou senha incorretos.");
    expect(translateAuthError("Email not confirmed")).toBe("Confirme seu email antes de entrar.");
    expect(translateAuthError("User already registered")).toBe(
      "Já existe uma conta com este email.",
    );
    expect(translateAuthError("Password should be at least 6 characters")).toBe(
      "A senha precisa ter pelo menos 6 caracteres.",
    );
  });

  it("mantém mensagens desconhecidas", () => {
    expect(translateAuthError("Falha estranha")).toBe("Falha estranha");
    expect(translateAuthError("")).toBe("Não foi possível concluir a autenticação.");
  });
});

describe("signIn", () => {
  it("valida email e senha antes de chamar o Supabase", async () => {
    await expect(signIn("sem-arroba", "123456")).rejects.toThrow(/email válido/i);
    await expect(signIn("a@b.com", "123")).rejects.toThrow(/pelo menos 6/i);
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("autentica com email normalizado e retorna a sessão", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session }, error: null });

    await expect(signIn("  a@b.com  ", "segredo")).resolves.toBe(session);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "segredo",
    });
  });

  it("traduz erro de credenciais inválidas", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });

    await expect(signIn("a@b.com", "segredo")).rejects.toThrow("Email ou senha incorretos.");
  });
});

describe("signUp", () => {
  it("sinaliza confirmação por email quando não há sessão", async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: { id: "u1" } },
      error: null,
    });

    await expect(signUp("a@b.com", "segredo")).resolves.toEqual({
      session: null,
      needsConfirmation: true,
    });
  });

  it("retorna sessão quando o cadastro já entra direto", async () => {
    mocks.signUp.mockResolvedValue({ data: { session, user: { id: "u1" } }, error: null });

    await expect(signUp("a@b.com", "segredo")).resolves.toEqual({
      session,
      needsConfirmation: false,
    });
  });
});

describe("sessão", () => {
  it("lê a sessão atual", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });

    await expect(getSession()).resolves.toBe(session);
  });

  it("assina e cancela a mudança de autenticação", () => {
    const unsubscribe = vi.fn();
    let listener: ((event: string, value: unknown) => void) | undefined;

    mocks.onAuthStateChange.mockImplementation((callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe } } };
    });

    const received: unknown[] = [];
    const cancel = onAuthChange((value) => received.push(value));
    listener?.("SIGNED_IN", session);

    expect(received).toEqual([session]);
    cancel();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("encerra a sessão", async () => {
    mocks.signOut.mockResolvedValue({ error: null });

    await signOut();
    expect(mocks.signOut).toHaveBeenCalled();
  });
});
