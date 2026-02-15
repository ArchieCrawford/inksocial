create table if not exists public.recasts (
  cast_hash text references public.casts(hash) on delete cascade,
  user_address text references public.users(address) on delete cascade,
  created_at timestamptz default now(),
  primary key (cast_hash, user_address)
);

create index if not exists idx_recasts_cast on public.recasts (cast_hash);
create index if not exists idx_recasts_user on public.recasts (user_address);

create or replace view public.cast_feed as
select
  c.hash,
  c.author_address,
  u.username as author_username,
  u.display_name as author_display_name,
  u.pfp_url as author_pfp_url,
  c.content,
  c.channel_id,
  c.parent_hash,
  c.signature,
  c.timestamp,
  c.created_at,
  (select count(*) from public.likes l where l.cast_hash = c.hash) as like_count,
  (select count(*) from public.recasts r where r.cast_hash = c.hash) as recast_count,
  (select count(*) from public.casts rc where rc.parent_hash = c.hash) as reply_count
from public.casts c
join public.users u on u.address = c.author_address;
