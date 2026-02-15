create extension if not exists pg_trgm;

create index if not exists tokens_symbol_trgm_idx on public.tokens using gin (symbol gin_trgm_ops);
create index if not exists tokens_name_trgm_idx on public.tokens using gin (name gin_trgm_ops);
create index if not exists users_username_trgm_idx on public.users using gin (username gin_trgm_ops);
create index if not exists users_dns_name_trgm_idx on public.users using gin (dns_name gin_trgm_ops);
