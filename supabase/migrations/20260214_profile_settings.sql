alter table if exists public.users
  add column if not exists banner_url text,
  add column if not exists website text,
  add column if not exists location text,
  add column if not exists pronouns text;
