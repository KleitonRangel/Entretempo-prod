-- ============================================================================
-- Entretempo — schema do Supabase
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
-- É seguro rodar mais de uma vez (usa IF NOT EXISTS / OR REPLACE).
-- ============================================================================

create extension if not exists pgcrypto;

-- ─── Tabela de itens ────────────────────────────────────────────────────────
create table if not exists public.items (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  type text not null,
  status text not null,
  "order" integer not null default 0,
  in_progress boolean not null default false,
  cover_url text not null default '',
  cover_source text not null default '',
  source text not null default '',
  external_id text not null default '',
  external_url text not null default '',
  year integer,
  description text not null default '',
  game_times jsonb not null default '{"main":null,"mainExtra":null,"completionist":null}'::jsonb,
  game_time_mode text not null default 'main',
  episodes integer,
  episode_minutes integer,
  seasons integer,
  season_episodes jsonb not null default '[]'::jsonb,
  selected_seasons jsonb not null default '[]'::jsonb,
  speed numeric not null default 1,
  runtime integer,
  created_at bigint not null,
  updated_at bigint not null,
  finished_at bigint,
  discarded_at bigint,
  sample boolean not null default false
);

-- ─── Compatibilidade com tabelas já existentes ──────────────────────────────
alter table public.items add column if not exists user_id uuid default auth.uid()
  references auth.users(id) on delete cascade;
alter table public.items add column if not exists in_progress boolean not null default false;
alter table public.items add column if not exists cover_url text not null default '';
alter table public.items add column if not exists cover_source text not null default '';
alter table public.items add column if not exists source text not null default '';
alter table public.items add column if not exists external_id text not null default '';
alter table public.items add column if not exists external_url text not null default '';
alter table public.items add column if not exists year integer;
alter table public.items add column if not exists description text not null default '';
alter table public.items add column if not exists game_times jsonb
  not null default '{"main":null,"mainExtra":null,"completionist":null}'::jsonb;
alter table public.items add column if not exists game_time_mode text not null default 'main';
alter table public.items add column if not exists episodes integer;
alter table public.items add column if not exists episode_minutes integer;
alter table public.items add column if not exists seasons integer;
alter table public.items add column if not exists season_episodes jsonb not null default '[]'::jsonb;
alter table public.items add column if not exists selected_seasons jsonb not null default '[]'::jsonb;
alter table public.items add column if not exists speed numeric not null default 1;
alter table public.items add column if not exists runtime integer;
alter table public.items add column if not exists created_at bigint not null default 0;
alter table public.items add column if not exists updated_at bigint not null default 0;
alter table public.items add column if not exists finished_at bigint;
alter table public.items add column if not exists discarded_at bigint;
alter table public.items add column if not exists sample boolean not null default false;

-- Itens antigos sem dono ficam invisíveis pelas políticas abaixo.
-- Se quiser limpá-los: delete from public.items where user_id is null;

create index if not exists items_user_order_idx
  on public.items (user_id, "order");

-- ─── Row Level Security: cada usuário só vê e altera os próprios itens ──────
alter table public.items enable row level security;
alter table public.items force row level security;

drop policy if exists "items_select_own" on public.items;
create policy "items_select_own"
  on public.items for select
  using (auth.uid() = user_id);

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own"
  on public.items for insert
  with check (auth.uid() = user_id);

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own"
  on public.items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own"
  on public.items for delete
  using (auth.uid() = user_id);

-- Garante que ninguém consiga trocar o dono de um item.
create or replace function public.items_keep_owner()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Não é permitido alterar o dono de um item.';
  end if;
  return new;
end;
$$;

drop trigger if exists items_keep_owner on public.items;
create trigger items_keep_owner
  before update on public.items
  for each row execute function public.items_keep_owner();

-- ============================================================================
-- Depois de criar a sua conta pelo app, você pode desativar novos cadastros:
--   Authentication → Providers → Email → desmarque "Enable sign ups".
-- ============================================================================
