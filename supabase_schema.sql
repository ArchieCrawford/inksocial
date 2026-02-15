-- Supabase Schema for InkSocial (Farcaster-like on Ink Network)

-- 1. Users table (Indexed by FID and Address)
CREATE TABLE IF NOT EXISTS users (
    fid BIGINT PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    pfp_url TEXT,
    banner_url TEXT,
    bio TEXT,
    website TEXT,
    location TEXT,
    pronouns TEXT,
    dns_name TEXT,
    dns_last_updated TIMESTAMP WITH TIME ZONE,
    resolver_source TEXT,
    metadata_uri TEXT,
    on_chain_tx_hash TEXT, -- Reference to the registration tx
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1b. Name Resolution Cache
CREATE TABLE IF NOT EXISTS name_resolution_cache (
    wallet_address TEXT PRIMARY KEY,
    dns_name TEXT,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source TEXT DEFAULT 'blockscout',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT name_resolution_cache_address_lowercase CHECK (wallet_address = lower(wallet_address))
);

CREATE INDEX IF NOT EXISTS idx_name_resolution_cache_last_checked
    ON name_resolution_cache (last_checked);

-- View to join user profiles with DNS names
CREATE OR REPLACE VIEW user_profiles_with_dns AS
SELECT
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
    COALESCE(u.dns_name, n.dns_name) AS dns_name,
    COALESCE(u.dns_last_updated, n.last_checked) AS dns_last_updated,
    COALESCE(u.resolver_source, n.source) AS resolver_source
FROM users u
LEFT JOIN name_resolution_cache n
    ON n.wallet_address = u.address;

-- 2. Auth Nonces (for SIWE-style secure signing)
CREATE TABLE IF NOT EXISTS auth_nonces (
    address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 3. Posts (Casts) - Stored off-chain but signed
CREATE TABLE IF NOT EXISTS casts (
    hash TEXT PRIMARY KEY, -- Hash of the signed message
    author_address TEXT REFERENCES users(address) ON DELETE CASCADE,
    content TEXT NOT NULL,
    channel_id TEXT,
    parent_hash TEXT REFERENCES casts(hash),
    signature TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Follows (Social Graph)
CREATE TABLE IF NOT EXISTS follows (
    follower_address TEXT REFERENCES users(address) ON DELETE CASCADE,
    following_address TEXT REFERENCES users(address) ON DELETE CASCADE,
    signature TEXT, -- Optional: cryptographic proof of follow
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_address, following_address)
);

-- 5. Likes (Reactions)
CREATE TABLE IF NOT EXISTS likes (
    cast_hash TEXT REFERENCES casts(hash) ON DELETE CASCADE,
    user_address TEXT REFERENCES users(address) ON DELETE CASCADE,
    signature TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cast_hash, user_address)
);

-- 5b. Recasts (Reprints)
CREATE TABLE IF NOT EXISTS recasts (
    cast_hash TEXT REFERENCES casts(hash) ON DELETE CASCADE,
    user_address TEXT REFERENCES users(address) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cast_hash, user_address)
);

-- Cast feed view (aggregated counts)
CREATE OR REPLACE VIEW cast_feed AS
SELECT
    c.hash,
    c.author_address,
    u.username AS author_username,
    u.display_name AS author_display_name,
    u.pfp_url AS author_pfp_url,
    u.dns_name AS author_dns_name,
    c.content,
    c.channel_id,
    c.parent_hash,
    c.signature,
    c.timestamp,
    c.created_at,
    (SELECT COUNT(*) FROM likes l WHERE l.cast_hash = c.hash) AS like_count,
    (SELECT COUNT(*) FROM recasts r WHERE r.cast_hash = c.hash) AS recast_count,
    (SELECT COUNT(*) FROM casts rc WHERE rc.parent_hash = c.hash) AS reply_count
FROM casts c
JOIN user_profiles_with_dns u ON u.address = c.author_address;

-- 6. Channels
CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    pfp_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_address TEXT REFERENCES users(address) ON DELETE CASCADE,
    actor_address TEXT REFERENCES users(address) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'like', 'recast', 'reply', 'follow'
    target_hash TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 8. Token registry + market data
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS tokens (
    chain_id BIGINT NOT NULL,
    address TEXT NOT NULL,
    symbol TEXT,
    name TEXT,
    decimals INTEGER,
    logo_url TEXT,
    verified BOOLEAN DEFAULT FALSE,
    source TEXT DEFAULT 'blockscout',
    spam BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tokens_address_lowercase CHECK (address = lower(address))
);

CREATE UNIQUE INDEX IF NOT EXISTS tokens_chain_address_key ON tokens (chain_id, address);
CREATE INDEX IF NOT EXISTS tokens_chain_id_idx ON tokens (chain_id);
CREATE INDEX IF NOT EXISTS tokens_symbol_trgm_idx ON tokens USING gin (symbol gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tokens_name_trgm_idx ON tokens USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tokens_updated_at ON tokens;
CREATE TRIGGER set_tokens_updated_at
BEFORE UPDATE ON tokens
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS token_market_data (
    chain_id BIGINT NOT NULL,
    token_address TEXT NOT NULL,
    price_usd NUMERIC,
    market_cap NUMERIC,
    volume_24h NUMERIC,
    percent_change_24h NUMERIC,
    logo_url TEXT,
    last_updated TIMESTAMP WITH TIME ZONE,
    source TEXT DEFAULT 'coinmarketcap',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chain_id, token_address),
    FOREIGN KEY (chain_id, token_address) REFERENCES tokens(chain_id, address) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_token_market_last_updated ON token_market_data (last_updated);
CREATE INDEX IF NOT EXISTS idx_token_market_chain ON token_market_data (chain_id);

DROP TRIGGER IF EXISTS set_token_market_updated_at ON token_market_data;
CREATE TRIGGER set_token_market_updated_at
BEFORE UPDATE ON token_market_data
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS token_price_history (
    chain_id BIGINT NOT NULL,
    token_address TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    open NUMERIC,
    high NUMERIC,
    low NUMERIC,
    close NUMERIC,
    volume NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chain_id, token_address, timestamp),
    FOREIGN KEY (chain_id, token_address) REFERENCES tokens(chain_id, address) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_token_price_history_token ON token_price_history (token_address);
CREATE INDEX IF NOT EXISTS idx_token_price_history_chain ON token_price_history (chain_id);
CREATE INDEX IF NOT EXISTS idx_token_price_history_timestamp ON token_price_history (timestamp);

-- 8b. Token Trending Ranks
CREATE TABLE IF NOT EXISTS token_trending (
    chain_id BIGINT NOT NULL,
    token_address TEXT NOT NULL,
    volume_2h NUMERIC,
    volume_6h NUMERIC,
    volume_24h NUMERIC,
    change_2h NUMERIC,
    change_6h NUMERIC,
    change_24h NUMERIC,
    rank_2h INTEGER,
    rank_6h INTEGER,
    rank_24h INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chain_id, token_address),
    FOREIGN KEY (chain_id, token_address) REFERENCES tokens(chain_id, address) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_token_trending_chain ON token_trending (chain_id);
CREATE INDEX IF NOT EXISTS idx_token_trending_rank_2h ON token_trending (rank_2h, token_address);
CREATE INDEX IF NOT EXISTS idx_token_trending_rank_6h ON token_trending (rank_6h, token_address);
CREATE INDEX IF NOT EXISTS idx_token_trending_rank_24h ON token_trending (rank_24h, token_address);

-- Seed Data (idempotent)
INSERT INTO channels (id, name, description) VALUES 
('all', 'Home', 'Everything on InkSocial'),
('ink', 'Ink Ecosystem', 'The heartbeat of Ink Network'),
('devs', 'Builders', 'Developing the future of social')
ON CONFLICT (id) DO NOTHING;

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_casts_author ON casts(author_address);
CREATE INDEX IF NOT EXISTS idx_casts_parent ON casts(parent_hash);
CREATE INDEX IF NOT EXISTS idx_recasts_cast ON recasts(cast_hash);
CREATE INDEX IF NOT EXISTS idx_recasts_user ON recasts(user_address);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_address);
