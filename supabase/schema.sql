-- Entretempo — estrutura para a migração futura do localStorage para o Supabase.
-- Rode este arquivo no SQL Editor do seu projeto Supabase quando for publicar na nuvem.
-- Enquanto o app roda localmente, nada disso é necessário: os itens ficam no navegador.

create extension if not exists "pgcrypto";

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text not null check (char_length(btrim(title)) > 0),
  media_type text not null check (media_type in ('game', 'movie', 'series')),
  status text not null default 'current' check (status in ('current', 'finished', 'discarded')),

  -- Posição manual dentro da coluna (Agora / Finalizados / Descartados).
  sort_order integer not null default 0,
  in_progress boolean not null default false,

  -- Capa e origem dos dados.
  cover_url text not null default '',
  cover_source text not null default '',
  source text not null default '',
  external_id text not null default '',
  external_url text not null default '',
  release_year integer,
  description text not null default '',

  -- Jogos (HowLongToBeat), em minutos.
  main_minutes integer check (main_minutes is null or main_minutes >= 0),
  main_extra_minutes integer check (main_extra_minutes is null or main_extra_minutes >= 0),
  completionist_minutes integer check (completionist_minutes is null or completionist_minutes >= 0),
  game_time_mode text not null default 'mainExtra'
    check (game_time_mode in ('main', 'mainExtra', 'completionist')),

  -- Séries (Cinemeta/IMDb) e filmes.
  episodes integer check (episodes is null or episodes > 0),
  episode_minutes integer check (episode_minutes is null or episode_minutes > 0),
  seasons integer check (seasons is null or seasons > 0),
  -- Quebra de episódios por temporada, ex.: [{"season": 2, "episodes": 24}].
  season_episodes jsonb not null default '[]'::jsonb,
  -- Temporadas escolhidas; vazio significa "todas".
  selected_seasons integer[] not null default '{}',
  speed numeric(3, 1) not null default 1 check (speed in (1, 1.3, 1.5)),
  runtime_minutes integer check (runtime_minutes is null or runtime_minutes > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  discarded_at timestamptz,

  -- "Em andamento" só faz sentido na coluna Agora.
  constraint items_progress_only_current check (not in_progress or status = 'current')
);

comment on table public.items is
  'Itens da lista pessoal do Entretempo. Espelha o formato salvo em localStorage (chave entretempo:v1).';

-- Consultas do app: uma coluna por vez, na ordem definida pelo usuário.
create index if not exists items_user_status_order_idx
  on public.items (user_id, status, sort_order, created_at);

-- updated_at automático.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_touch_updated_at on public.items;
create trigger items_touch_updated_at
  before update on public.items
  for each row
  execute function public.touch_updated_at();

-- Cada pessoa só enxerga e altera os próprios itens.
alter table public.items enable row level security;

drop policy if exists "items_select_own" on public.items;
create policy "items_select_own"
  on public.items for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own"
  on public.items for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own"
  on public.items for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own"
  on public.items for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Mapa entre o JSON local e as colunas acima (para o dia da migração):
--
--   type             -> media_type
--   order            -> sort_order
--   inProgress       -> in_progress
--   coverUrl         -> cover_url
--   coverSource      -> cover_source
--   externalId       -> external_id
--   externalUrl      -> external_url
--   year             -> release_year
--   gameTimes.main   -> main_minutes
--   gameTimes.mainExtra      -> main_extra_minutes
--   gameTimes.completionist  -> completionist_minutes
--   gameTimeMode     -> game_time_mode
--   episodeMinutes   -> episode_minutes
--   seasonEpisodes   -> season_episodes (jsonb)
--   selectedSeasons  -> selected_seasons (integer[])
--   runtime          -> runtime_minutes
--   createdAt/updatedAt/finishedAt/discardedAt (epoch ms) -> timestamptz
-- ---------------------------------------------------------------------------
