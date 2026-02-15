alter table public.users add column if not exists dns_name text;
alter table public.users add column if not exists dns_last_updated timestamptz;
alter table public.users add column if not exists resolver_source text;

create table if not exists public.name_resolution_cache (
  wallet_address text primary key,
  dns_name text,
  last_checked timestamptz not null default now(),
  source text not null default 'blockscout',
  created_at timestamptz not null default now(),
  constraint name_resolution_cache_address_lowercase check (wallet_address = lower(wallet_address))
);

create index if not exists idx_name_resolution_cache_last_checked
  on public.name_resolution_cache (last_checked);

alter table public.name_resolution_cache enable row level security;

drop policy if exists "Name resolution cache readable" on public.name_resolution_cache;
create policy "Name resolution cache readable"
  on public.name_resolution_cache
  for select
  using (true);

drop policy if exists "Name resolution cache writable by service role" on public.name_resolution_cache;
create policy "Name resolution cache writable by service role"
  on public.name_resolution_cache
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Name resolution cache updatable by service role" on public.name_resolution_cache;
create policy "Name resolution cache updatable by service role"
  on public.name_resolution_cache
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Name resolution cache deletable by service role" on public.name_resolution_cache;
create policy "Name resolution cache deletable by service role"
  on public.name_resolution_cache
  for delete
  using (auth.role() = 'service_role');

create or replace view public.user_profiles_with_dns as
select
  u.fid,
  u.address,
  u.username,
  u.display_name,
  u.pfp_url,
  u.banner_url,
  u.bio,
  u.website,
  u.location,
  u.pronouns,
  u.metadata_uri,
  u.on_chain_tx_hash,
  u.created_at,
  u.updated_at,
  coalesce(u.dns_name, n.dns_name) as dns_name,
  coalesce(u.dns_last_updated, n.last_checked) as dns_last_updated,
  coalesce(u.resolver_source, n.source) as resolver_source
from public.users u
left join public.name_resolution_cache n
  on n.wallet_address = u.address;
