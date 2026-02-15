create table if not exists public.token_market_data (
  chain_id bigint not null,
  token_address text not null,
  price_usd numeric,
  market_cap numeric,
  volume_24h numeric,
  percent_change_24h numeric,
  logo_url text,
  last_updated timestamptz,
  source text default 'coinmarketcap',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (chain_id, token_address),
  foreign key (chain_id, token_address) references public.tokens(chain_id, address) on delete cascade
);

create index if not exists idx_token_market_last_updated on public.token_market_data (last_updated);
create index if not exists idx_token_market_chain on public.token_market_data (chain_id);

drop trigger if exists set_token_market_updated_at on public.token_market_data;
create trigger set_token_market_updated_at
before update on public.token_market_data
for each row
execute function public.set_updated_at();

create table if not exists public.token_price_history (
  chain_id bigint not null,
  token_address text not null,
  timestamp timestamptz not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume numeric,
  created_at timestamptz default now(),
  primary key (chain_id, token_address, timestamp),
  foreign key (chain_id, token_address) references public.tokens(chain_id, address) on delete cascade
);

create index if not exists idx_token_price_history_token on public.token_price_history (token_address);
create index if not exists idx_token_price_history_chain on public.token_price_history (chain_id);
create index if not exists idx_token_price_history_timestamp on public.token_price_history (timestamp);

alter table public.token_market_data enable row level security;
alter table public.token_price_history enable row level security;

drop policy if exists "Token market data readable" on public.token_market_data;
create policy "Token market data readable"
  on public.token_market_data
  for select
  using (true);

drop policy if exists "Token market data writable by service role" on public.token_market_data;
create policy "Token market data writable by service role"
  on public.token_market_data
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Token market data updatable by service role" on public.token_market_data;
create policy "Token market data updatable by service role"
  on public.token_market_data
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Token market data deletable by service role" on public.token_market_data;
create policy "Token market data deletable by service role"
  on public.token_market_data
  for delete
  using (auth.role() = 'service_role');

drop policy if exists "Token price history readable" on public.token_price_history;
create policy "Token price history readable"
  on public.token_price_history
  for select
  using (true);

drop policy if exists "Token price history writable by service role" on public.token_price_history;
create policy "Token price history writable by service role"
  on public.token_price_history
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Token price history updatable by service role" on public.token_price_history;
create policy "Token price history updatable by service role"
  on public.token_price_history
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Token price history deletable by service role" on public.token_price_history;
create policy "Token price history deletable by service role"
  on public.token_price_history
  for delete
  using (auth.role() = 'service_role');
