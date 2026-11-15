-- Schema do Entretempo — Supabase
-- Execute este SQL no SQL Editor do seu projeto Supabase

-- Tabela de itens (filmes, séries e jogos)
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('game', 'movie', 'series')),
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'finished', 'discarded')),
  "order" INTEGER NOT NULL DEFAULT 0,
  in_progress BOOLEAN NOT NULL DEFAULT FALSE,
  cover_url TEXT NOT NULL DEFAULT '',
  cover_source TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  year INTEGER,
  description TEXT NOT NULL DEFAULT '',
  game_times JSONB,
  game_time_mode TEXT NOT NULL DEFAULT 'main' CHECK (game_time_mode IN ('main', 'mainExtra', 'completionist')),
  episodes INTEGER,
  episode_minutes INTEGER,
  seasons INTEGER,
  season_episodes JSONB,
  selected_seasons INTEGER[] NOT NULL DEFAULT '{}',
  speed DOUBLE PRECISION NOT NULL DEFAULT 1,
  runtime INTEGER,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  finished_at BIGINT,
  discarded_at BIGINT,
  sample BOOLEAN NOT NULL DEFAULT FALSE
);

-- Índice para ordenação rápida
CREATE INDEX IF NOT EXISTS items_order_idx ON items ("order");

-- RLS (Row Level Security) — aberto para leitura/escrita via anon key
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Permitir que qualquer usuário autenticado ou anônimo leia e escreva
-- (o app não usa autenticação Supabase, então precisamos de políticas abertas)
CREATE POLICY "Permitir leitura de itens"
  ON items FOR SELECT
  USING (true);

CREATE POLICY "Permitir inserção de itens"
  ON items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de itens"
  ON items FOR UPDATE
  USING (true);

CREATE POLICY "Permitir exclusão de itens"
  ON items FOR DELETE
  USING (true);
