create table if not exists public.token_trending (
  chain_id bigint not null,
  token_address text not null,
  volume_2h numeric,
  volume_6h numeric,
  volume_24h numeric,
  change_2h numeric,
  change_6h numeric,
  change_24h numeric,
  rank_2h integer,
  rank_6h integer,
  rank_24h integer,
  updated_at timestamptz default now(),
  primary key (chain_id, token_address),
  foreign key (chain_id, token_address) references public.tokens(chain_id, address) on delete cascade
);

create index if not exists idx_token_trending_chain on public.token_trending (chain_id);
create index if not exists idx_token_trending_rank_2h on public.token_trending (rank_2h, token_address);
create index if not exists idx_token_trending_rank_6h on public.token_trending (rank_6h, token_address);
create index if not exists idx_token_trending_rank_24h on public.token_trending (rank_24h, token_address);

alter table public.token_trending enable row level security;

drop policy if exists "Token trending readable" on public.token_trending;
create policy "Token trending readable"
  on public.token_trending
  for select
  using (true);

drop policy if exists "Token trending writable by service role" on public.token_trending;
create policy "Token trending writable by service role"
  on public.token_trending
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Token trending updatable by service role" on public.token_trending;
create policy "Token trending updatable by service role"
  on public.token_trending
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Token trending deletable by service role" on public.token_trending;
create policy "Token trending deletable by service role"
  on public.token_trending
  for delete
  using (auth.role() = 'service_role');

create or replace function public.refresh_token_trending(p_chain_id bigint)
returns void
language plpgsql
as $$
declare
  v_now timestamptz := now();
begin
  update public.token_trending
    set volume_2h = null, change_2h = null, rank_2h = null
  where chain_id = p_chain_id;

  update public.token_trending
    set volume_6h = null, change_6h = null, rank_6h = null
  where chain_id = p_chain_id;

  update public.token_trending
    set volume_24h = null, change_24h = null, rank_24h = null
  where chain_id = p_chain_id;

  with base as (
    select
      md.token_address,
      md.volume_24h as fallback_volume,
      md.percent_change_24h as fallback_change
    from public.token_market_data md
    where md.chain_id = p_chain_id
  ),
  window_data as (
    select
      tph.token_address,
      sum(tph.volume) as volume,
      (array_agg(tph.close order by tph.timestamp asc))[1] as first_close,
      (array_agg(tph.close order by tph.timestamp desc))[1] as last_close
    from public.token_price_history tph
    where tph.chain_id = p_chain_id
      and tph.timestamp >= now() - interval '2 hours'
    group by tph.token_address
  ),
  combined as (
    select
      coalesce(w.token_address, b.token_address) as token_address,
      coalesce(w.volume, b.fallback_volume) as volume,
      coalesce(
        case
          when w.first_close is null or w.first_close = 0 then null
          else (w.last_close - w.first_close) / w.first_close * 100
        end,
        b.fallback_change
      ) as change
    from base b
    full outer join window_data w on w.token_address = b.token_address
  ),
  ranked as (
    select
      token_address,
      volume,
      change,
      dense_rank() over (order by volume desc nulls last, change desc nulls last) as rank
    from combined
    where volume is not null
  )
  insert into public.token_trending (
    chain_id,
    token_address,
    volume_2h,
    change_2h,
    rank_2h,
    updated_at
  )
  select p_chain_id, token_address, volume, change, rank, v_now
  from ranked
  on conflict (chain_id, token_address) do update
    set volume_2h = excluded.volume_2h,
        change_2h = excluded.change_2h,
        rank_2h = excluded.rank_2h,
        updated_at = v_now;

  with base as (
    select
      md.token_address,
      md.volume_24h as fallback_volume,
      md.percent_change_24h as fallback_change
    from public.token_market_data md
    where md.chain_id = p_chain_id
  ),
  window_data as (
    select
      tph.token_address,
      sum(tph.volume) as volume,
      (array_agg(tph.close order by tph.timestamp asc))[1] as first_close,
      (array_agg(tph.close order by tph.timestamp desc))[1] as last_close
    from public.token_price_history tph
    where tph.chain_id = p_chain_id
      and tph.timestamp >= now() - interval '6 hours'
    group by tph.token_address
  ),
  combined as (
    select
      coalesce(w.token_address, b.token_address) as token_address,
      coalesce(w.volume, b.fallback_volume) as volume,
      coalesce(
        case
          when w.first_close is null or w.first_close = 0 then null
          else (w.last_close - w.first_close) / w.first_close * 100
        end,
        b.fallback_change
      ) as change
    from base b
    full outer join window_data w on w.token_address = b.token_address
  ),
  ranked as (
    select
      token_address,
      volume,
      change,
      dense_rank() over (order by volume desc nulls last, change desc nulls last) as rank
    from combined
    where volume is not null
  )
  insert into public.token_trending (
    chain_id,
    token_address,
    volume_6h,
    change_6h,
    rank_6h,
    updated_at
  )
  select p_chain_id, token_address, volume, change, rank, v_now
  from ranked
  on conflict (chain_id, token_address) do update
    set volume_6h = excluded.volume_6h,
        change_6h = excluded.change_6h,
        rank_6h = excluded.rank_6h,
        updated_at = v_now;

  with base as (
    select
      md.token_address,
      md.volume_24h as fallback_volume,
      md.percent_change_24h as fallback_change
    from public.token_market_data md
    where md.chain_id = p_chain_id
  ),
  window_data as (
    select
      tph.token_address,
      sum(tph.volume) as volume,
      (array_agg(tph.close order by tph.timestamp asc))[1] as first_close,
      (array_agg(tph.close order by tph.timestamp desc))[1] as last_close
    from public.token_price_history tph
    where tph.chain_id = p_chain_id
      and tph.timestamp >= now() - interval '24 hours'
    group by tph.token_address
  ),
  combined as (
    select
      coalesce(w.token_address, b.token_address) as token_address,
      coalesce(w.volume, b.fallback_volume) as volume,
      coalesce(
        case
          when w.first_close is null or w.first_close = 0 then null
          else (w.last_close - w.first_close) / w.first_close * 100
        end,
        b.fallback_change
      ) as change
    from base b
    full outer join window_data w on w.token_address = b.token_address
  ),
  ranked as (
    select
      token_address,
      volume,
      change,
      dense_rank() over (order by volume desc nulls last, change desc nulls last) as rank
    from combined
    where volume is not null
  )
  insert into public.token_trending (
    chain_id,
    token_address,
    volume_24h,
    change_24h,
    rank_24h,
    updated_at
  )
  select p_chain_id, token_address, volume, change, rank, v_now
  from ranked
  on conflict (chain_id, token_address) do update
    set volume_24h = excluded.volume_24h,
        change_24h = excluded.change_24h,
        rank_24h = excluded.rank_24h,
        updated_at = v_now;
end;
$$;
