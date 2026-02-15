const { rpc, select, selectByValues } = require('./supabase');

const DEFAULT_MARKET_TTL_MINUTES = Number(process.env.MARKET_DATA_TTL_MINUTES || 10);

const toLower = (value) => (value ? String(value).toLowerCase() : value);

const isMarketStale = (lastUpdated, ttlMinutes = DEFAULT_MARKET_TTL_MINUTES) => {
  if (!lastUpdated) return true;
  const updatedAt = new Date(lastUpdated).getTime();
  if (Number.isNaN(updatedAt)) return true;
  const now = Date.now();
  return now - updatedAt > ttlMinutes * 60 * 1000;
};

const buildMarketKey = (chainId, address) => `${chainId}:${toLower(address)}`;

const mergeMarket = (tokens, marketRows) => {
  const marketMap = new Map(
    (marketRows || []).map((row) => [buildMarketKey(row.chain_id, row.token_address), row])
  );
  return (tokens || []).map((token) => {
    const key = buildMarketKey(token.chain_id, token.address);
    const market = marketMap.get(key) || null;
    const mergedLogo = market?.logo_url || token.logo_url || null;
    return {
      ...token,
      logo_url: mergedLogo,
      market,
      market_is_stale: market ? isMarketStale(market.last_updated) : true
    };
  });
};

const TRENDING_WINDOWS = {
  '2h': { rank: 'rank_2h', volume: 'volume_2h', change: 'change_2h' },
  '6h': { rank: 'rank_6h', volume: 'volume_6h', change: 'change_6h' },
  '24h': { rank: 'rank_24h', volume: 'volume_24h', change: 'change_24h' }
};

const normalizeWindow = (value) => (TRENDING_WINDOWS[value] ? value : '6h');

const attachTrending = async (tokens, chainId) => {
  if (!tokens || tokens.length === 0) return tokens;
  const addresses = tokens.map((token) => token.address);
  const rows = await selectByValues('token_trending', 'token_address', addresses, {
    chain_id: `eq.${chainId}`
  });
  const trendingMap = new Map(rows.map((row) => [toLower(row.token_address), row]));
  return tokens.map((token) => ({
    ...token,
    trending: trendingMap.get(toLower(token.address)) || null
  }));
};

const searchTokens = async ({ query, chainId, limit }) => {
  const payload = {
    p_query: query,
    p_chain_id: chainId,
    p_limit: limit
  };
  return rpc('search_tokens', payload);
};

const listTokens = async ({ chainId, limit, offset }) => {
  const params = new URLSearchParams();
  params.set('chain_id', `eq.${chainId}`);
  params.set('is_active', 'eq.true');
  params.set('spam', 'eq.false');
  params.set('order', 'verified.desc,symbol.asc');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return select('tokens', params);
};

const listTokensWithMarket = async ({ chainId, limit, offset }) => {
  const tokens = await listTokens({ chainId, limit, offset });
  const addresses = tokens.map((token) => token.address);
  const market = await selectByValues('token_market_data', 'token_address', addresses, {
    chain_id: `eq.${chainId}`
  });
  const merged = mergeMarket(tokens, market);
  return attachTrending(merged, chainId);
};

const searchTokensWithMarket = async ({ query, chainId, limit }) => {
  const tokens = await searchTokens({ query, chainId, limit });
  const addresses = (tokens || []).map((token) => token.address);
  const market = await selectByValues('token_market_data', 'token_address', addresses, {
    chain_id: `eq.${chainId}`
  });
  const merged = mergeMarket(tokens, market);
  return attachTrending(merged, chainId);
};

const fetchTokenDetail = async ({ address, chainId }) => {
  const params = new URLSearchParams();
  params.set('chain_id', `eq.${chainId}`);
  params.set('address', `eq.${toLower(address)}`);
  params.set('limit', '1');
  const results = await select('tokens', params);
  const token = results[0];
  if (!token) return null;
  const market = await selectByValues('token_market_data', 'token_address', [token.address], {
    chain_id: `eq.${chainId}`
  });
  const merged = mergeMarket([token], market);
  const withTrending = await attachTrending(merged, chainId);
  return withTrending[0];
};

const fetchTokenChart = async ({ address, chainId, limit = 168, start, end }) => {
  const params = new URLSearchParams();
  params.set('chain_id', `eq.${chainId}`);
  params.set('token_address', `eq.${toLower(address)}`);
  if (start) params.append('timestamp', `gte.${start}`);
  if (end) params.append('timestamp', `lte.${end}`);
  params.set('order', 'timestamp.asc');
  params.set('limit', String(limit));
  return select('token_price_history', params);
};

const fetchTokensByAddresses = async ({ addresses, chainId }) => {
  if (!addresses || addresses.length === 0) return [];
  const tokens = await selectByValues('tokens', 'address', addresses, {
    chain_id: `eq.${chainId}`
  });
  const market = await selectByValues('token_market_data', 'token_address', addresses, {
    chain_id: `eq.${chainId}`
  });
  const merged = mergeMarket(tokens, market);
  return attachTrending(merged, chainId);
};

const listTrending = async ({ chainId, window, limit, cursor }) => {
  const windowKey = normalizeWindow(window);
  const columns = TRENDING_WINDOWS[windowKey];
  const params = new URLSearchParams();
  params.set('chain_id', `eq.${chainId}`);
  params.set(columns.rank, 'not.is.null');
  params.set('select', `token_address,${columns.rank},${columns.volume},${columns.change}`);
  params.set('order', `${columns.rank}.asc,token_address.asc`);
  params.set('limit', String(limit));

  if (cursor) {
    const [rankStr, address] = cursor.split('|');
    const rank = Number(rankStr);
    if (rank && address) {
      const normalized = toLower(address);
      params.set(
        'or',
        `(${columns.rank}.gt.${rank},and(${columns.rank}.eq.${rank},token_address.gt.${normalized}))`
      );
    }
  }

  const trendingRows = await select('token_trending', params);
  const addresses = trendingRows.map((row) => row.token_address);
  const tokens = await fetchTokensByAddresses({ addresses, chainId });
  const tokenMap = new Map(tokens.map((token) => [toLower(token.address), token]));

  const items = trendingRows.map((row) => ({
    ...tokenMap.get(toLower(row.token_address)),
    rank_window: windowKey,
    rank: row[columns.rank],
    rank_volume: row[columns.volume],
    rank_change: row[columns.change]
  })).filter(Boolean);

  const last = trendingRows[trendingRows.length - 1];
  const nextCursor = last ? `${last[columns.rank]}|${last.token_address}` : null;
  return { items, nextCursor };
};

const listRecent = async ({ chainId, limit, cursor }) => {
  const params = new URLSearchParams();
  params.set('chain_id', `eq.${chainId}`);
  params.set('is_active', 'eq.true');
  params.set('spam', 'eq.false');
  params.set('order', 'created_at.desc,address.asc');
  params.set('limit', String(limit));

  if (cursor) {
    const [createdAt, address] = cursor.split('|');
    if (createdAt && address) {
      const normalized = toLower(address);
      params.set(
        'or',
        `(created_at.lt.${createdAt},and(created_at.eq.${createdAt},address.gt.${normalized}))`
      );
    }
  }

  const tokens = await select('tokens', params);
  const addresses = tokens.map((token) => token.address);
  const market = await selectByValues('token_market_data', 'token_address', addresses, {
    chain_id: `eq.${chainId}`
  });
  const merged = mergeMarket(tokens, market);
  const withTrending = await attachTrending(merged, chainId);
  const last = tokens[tokens.length - 1];
  const nextCursor = last ? `${last.created_at}|${last.address}` : null;
  return { items: withTrending, nextCursor };
};

module.exports = {
  searchTokens,
  listTokens,
  listTokensWithMarket,
  searchTokensWithMarket,
  fetchTokenDetail,
  fetchTokenChart,
  listTrending,
  listRecent
};
