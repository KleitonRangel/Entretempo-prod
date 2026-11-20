import { useState, type FormEvent } from "react";
import { signIn, signUp } from "../lib/auth";
import { Icon } from "./Icon";

type Mode = "signin" | "signup";

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password);
        if (result.needsConfirmation) {
          setMessage("Conta criada. Confirme seu email antes de entrar.");
        } else if (result.session) {
          setMessage("Conta criada. Você já está dentro.");
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  return (
    <div className="auth-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grain" />

      <main className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="auth-logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="34" height="34">
              <defs>
                <linearGradient id="auth-brand-gradient" x1="4" y1="4" x2="28" y2="28">
                  <stop stopColor="#c3b8ff" />
                  <stop offset="1" stopColor="#6f5ee0" />
                </linearGradient>
              </defs>
              <circle
                cx="16"
                cy="16"
                r="10"
                fill="none"
                stroke="url(#auth-brand-gradient)"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeDasharray="47 16"
                transform="rotate(-38 16 16)"
              />
              <path d="M14.2 11.6 21 16l-6.8 4.4V11.6Z" fill="url(#auth-brand-gradient)" />
              <circle cx="16" cy="16" r="1.9" fill="#0a0a0c" />
            </svg>
          </span>
          <span className="brand-word">entretempo</span>
        </div>

        <header className="auth-head">
          <p className="eyebrow">Sua fila pessoal</p>
          <h1 id="auth-title">{mode === "signin" ? "Entrar na sua conta" : "Criar sua conta"}</h1>
          <p>
            {mode === "signin"
              ? "Seus jogos, filmes e séries ficam sincronizados entre dispositivos."
              : "Leva menos de um minuto. Depois é só montar sua fila."}
          </p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>Email</span>
            <span className="auth-input">
              <Icon name="mail" size={16} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
                autoComplete="email"
                inputMode="email"
                aria-label="Email"
                required
              />
            </span>
          </label>

          <label className="auth-field">
            <span>Senha</span>
            <span className="auth-input">
              <Icon name="lock" size={16} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "signup" ? "Mínimo de 6 caracteres" : "Sua senha"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
                aria-label="Senha"
                required
              />
            </span>
          </label>

          {error ? (
            <div className="inline-warning" role="alert">
              <Icon name="info" size={15} />
              <span>{error}</span>
            </div>
          ) : null}

          {message ? (
            <div className="inline-success" role="status">
              <Icon name="check" size={15} />
              <span>{message}</span>
            </div>
          ) : null}

          <button type="submit" className="primary-button auth-submit" disabled={busy}>
            {busy ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <Icon name={mode === "signin" ? "user" : "plus"} size={16} />
            )}
            {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "signin" ? "Ainda não tem conta?" : "Já tem uma conta?"}
          <button
            type="button"
            className="text-button"
            onClick={() => changeMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </main>

      <footer className="auth-foot">entretempo — seu tempo, bem gasto.</footer>
    </div>
  );
}
