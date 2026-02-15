create extension if not exists pg_trgm;

create table if not exists public.tokens (
  chain_id bigint not null,
  address text not null,
  symbol text,
  name text,
  decimals integer,
  logo_url text,
  verified boolean default false,
  source text default 'blockscout',
  spam boolean default false,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint tokens_address_lowercase check (address = lower(address))
);

create unique index if not exists tokens_chain_address_key on public.tokens (chain_id, address);
create index if not exists tokens_chain_id_idx on public.tokens (chain_id);
create index if not exists tokens_symbol_trgm_idx on public.tokens using gin (symbol gin_trgm_ops);
create index if not exists tokens_name_trgm_idx on public.tokens using gin (name gin_trgm_ops);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tokens_updated_at on public.tokens;
create trigger set_tokens_updated_at
before update on public.tokens
for each row
execute function public.set_updated_at();

create or replace function public.search_tokens(
  p_query text,
  p_chain_id bigint,
  p_limit int default 20
)
returns setof public.tokens
language sql
stable
as $$
  select t.*
  from public.tokens t
  where t.chain_id = p_chain_id
    and t.is_active = true
    and t.spam = false
    and (
      lower(t.symbol) = lower(p_query)
      or t.symbol % p_query
      or t.name % p_query
      or t.name ilike '%' || p_query || '%'
      or t.symbol ilike p_query || '%'
      or t.address = lower(p_query)
      or t.address like lower(p_query) || '%'
    )
  order by
    t.verified desc,
    (lower(t.symbol) = lower(p_query)) desc,
    similarity(t.symbol, p_query) desc,
    similarity(t.name, p_query) desc
  limit p_limit;
$$;

alter table public.tokens enable row level security;

drop policy if exists "Tokens are readable by everyone" on public.tokens;
create policy "Tokens are readable by everyone"
  on public.tokens
  for select
  using (true);

drop policy if exists "Tokens writable by service role" on public.tokens;
create policy "Tokens writable by service role"
  on public.tokens
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Tokens updatable by service role" on public.tokens;
create policy "Tokens updatable by service role"
  on public.tokens
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Tokens deletable by service role" on public.tokens;
create policy "Tokens deletable by service role"
  on public.tokens
  for delete
  using (auth.role() = 'service_role');
