drop view if exists public.cast_feed;
create view public.cast_feed as
select
  c.hash,
  c.author_address,
  u.username as author_username,
  u.display_name as author_display_name,
  u.pfp_url as author_pfp_url,
  u.dns_name as author_dns_name,
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
join public.user_profiles_with_dns u on u.address = c.author_address;
