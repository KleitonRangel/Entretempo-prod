import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type SignUpResult = {
  session: Session | null;
  needsConfirmation: boolean;
};

const MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Email ou senha incorretos."],
  [/email not confirmed/i, "Confirme seu email antes de entrar."],
  [/user already registered/i, "Já existe uma conta com este email."],
  [/password should be at least/i, "A senha precisa ter pelo menos 6 caracteres."],
  [/unable to validate email|invalid email/i, "Digite um email válido."],
  [/too many requests|rate limit|email rate limit/i, "Muitas tentativas. Aguarde um momento."],
  [/signup is disabled/i, "A criação de contas está desativada."],
  [/failed to fetch|network/i, "Não foi possível conectar. Verifique sua internet."],
];

export function translateAuthError(message: string): string {
  for (const [pattern, friendly] of MESSAGES) {
    if (pattern.test(message)) return friendly;
  }
  return message || "Não foi possível concluir a autenticação.";
}

function validateCredentials(email: string, password: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error("Digite um email válido.");
  }
  if (password.length < 6) {
    throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  }
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(translateAuthError(error.message));
  return data.session;
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<Session> {
  validateCredentials(email, password);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw new Error(translateAuthError(error.message));
  if (!data.session) throw new Error("Não foi possível iniciar a sessão. Tente de novo.");

  return data.session;
}

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  validateCredentials(email, password);

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) throw new Error(translateAuthError(error.message));

  return {
    session: data.session,
    // Supabase retorna user sem sessão quando a confirmação por email está ativa.
    needsConfirmation: !data.session && Boolean(data.user),
  };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(translateAuthError(error.message));
}
