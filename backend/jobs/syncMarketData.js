const { select, selectByValues, upsertMarketData, upsertPriceHistory } = require('../lib/supabase');

const CMC_BASE_URL = process.env.CMC_API_BASE || 'https://pro-api.coinmarketcap.com';
const CMC_API_KEY = process.env.CMC_API_KEY;
const DEFAULT_CHAIN_ID = Number(process.env.INK_CHAIN_ID || 57073);
const MARKET_TTL_MINUTES = Number(process.env.MARKET_DATA_TTL_MINUTES || 10);
const HISTORY_TTL_MINUTES = Number(process.env.MARKET_HISTORY_TTL_MINUTES || 60);
const BATCH_SIZE = Number(process.env.CMC_BATCH_SIZE || 100);
const HISTORY_POINTS = Number(process.env.CMC_HISTORY_POINTS || 168);
const HISTORY_TOKEN_LIMIT = Number(process.env.CMC_HISTORY_TOKEN_LIMIT || 50);
let ohlcvDisabled = false;
const INKYSWAP_BASE = process.env.INKYSWAP_API_BASE || 'https://inkyswap.com';
const USE_INKYSWAP_MARKET = process.env.USE_INKYSWAP_MARKET === 'true';
const STABLE_SYMBOLS = new Set(
  (process.env.INKYSWAP_STABLE_SYMBOLS || 'USDC,USDT,DAI,USDG,USDB')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
);
const STABLE_ADDRESSES = new Set(
  (process.env.INKYSWAP_STABLE_ADDRESSES || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const normalizeSymbol = (symbol) => (symbol ? String(symbol).trim().toUpperCase() : null);
const isValidCmcSymbol = (symbol) => Boolean(symbol && /^[A-Z0-9]+$/.test(symbol));
const normalizeAddress = (address) => (address ? String(address).toLowerCase() : null);
const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toDecimal = (raw, decimals) => {
  const num = toNumber(raw);
  if (num === null) return null;
  const scale = Number.isFinite(decimals) ? Number(decimals) : 18;
  return num / Math.pow(10, scale);
};

const isStableToken = ({ address, symbol } = {}) => {
  if (address && STABLE_ADDRESSES.has(address)) return true;
  if (symbol && STABLE_SYMBOLS.has(symbol)) return true;
  return false;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url, options = {}, retries = 3, baseDelay = 500) => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await fetch(url, options);
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (error) {
          throw new Error(`CMC response parse failed: ${response.status} ${text}`);
        }
      }
      if (!response.ok) {
        const errorMessage = data?.status?.error_message || text;
        const error = new Error(`CMC request failed: ${response.status} ${errorMessage}`);
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      attempt += 1;
      if (attempt > retries) throw error;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  return null;
};

const cmcRequest = async (path, params = {}) => {
  if (!CMC_API_KEY) {
    throw new Error('Missing CMC_API_KEY');
  }
  const url = new URL(path, CMC_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  try {
    return await fetchWithRetry(url.toString(), {
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY
      }
    });
  } catch (error) {
    if (error?.status === 400 && /Invalid values for \"symbol\"/i.test(error.message || '')) {
      console.warn('[syncMarketData] CMC symbol batch rejected, skipping batch.');
      return { data: {} };
    }
    throw error;
  }
};

const fetchInkySwapPairs = async () => {
  const url = new URL('/api/pairs', INKYSWAP_BASE);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`InkySwap pairs fetch failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const buildInkySwapSnapshot = (pairs, tokens = []) => {
  const tokenMeta = new Map(
    tokens.map((token) => [normalizeAddress(token.address), {
      address: normalizeAddress(token.address),
      symbol: normalizeSymbol(token.symbol),
      decimals: Number.isFinite(token.decimals) ? Number(token.decimals) : null,
      logo_url: token.logo_url
    }])
  );

  const priceMap = new Map();
  const volumeMap = new Map();
  const pairEntries = [];

  const mergeMeta = (pairToken) => {
    if (!pairToken) return null;
    const address = normalizeAddress(pairToken.address);
    if (!address) return null;
    const base = tokenMeta.get(address) || {};
    return {
      address,
      symbol: normalizeSymbol(pairToken.symbol || base.symbol),
      decimals: Number.isFinite(pairToken.decimals) ? Number(pairToken.decimals) : base.decimals ?? 18
    };
  };

  tokens.forEach((token) => {
    const address = normalizeAddress(token.address);
    if (!address) return;
    const symbol = normalizeSymbol(token.symbol);
    if (isStableToken({ address, symbol })) {
      priceMap.set(address, 1);
    }
  });

  for (const pair of pairs) {
    const token0 = mergeMeta(pair.token0);
    const token1 = mergeMeta(pair.token1);
    if (!token0?.address || !token1?.address) continue;

    if (isStableToken(token0)) priceMap.set(token0.address, 1);
    if (isStableToken(token1)) priceMap.set(token1.address, 1);

    const reserve0 = toDecimal(pair.reserve0, token0.decimals);
    const reserve1 = toDecimal(pair.reserve1, token1.decimals);
    if (!reserve0 || !reserve1) continue;

    pairEntries.push({ token0, token1, reserve0, reserve1 });

    const volumeUsd = toNumber(pair.volume_24h) || 0;
    if (volumeUsd > 0) {
      volumeMap.set(token0.address, (volumeMap.get(token0.address) || 0) + volumeUsd);
      volumeMap.set(token1.address, (volumeMap.get(token1.address) || 0) + volumeUsd);
    }
  }

  for (let i = 0; i < 5; i += 1) {
    let changed = false;
    for (const entry of pairEntries) {
      const price0 = priceMap.get(entry.token0.address);
      const price1 = priceMap.get(entry.token1.address);

      if (price0 == null && price1 != null) {
        const next = price1 * (entry.reserve1 / entry.reserve0);
        if (Number.isFinite(next)) {
          priceMap.set(entry.token0.address, next);
          changed = true;
        }
      }

      if (price1 == null && price0 != null) {
        const next = price0 * (entry.reserve0 / entry.reserve1);
        if (Number.isFinite(next)) {
          priceMap.set(entry.token1.address, next);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return { priceMap, volumeMap, pairCount: pairEntries.length };
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const isStale = (lastUpdated, ttlMinutes) => {
  if (!lastUpdated) return true;
  const updatedAt = new Date(lastUpdated).getTime();
  if (Number.isNaN(updatedAt)) return true;
  return Date.now() - updatedAt > ttlMinutes * 60 * 1000;
};

const extractEntries = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return [data];
};

const candidateAddress = (entry) => {
  if (!entry) return null;
  const direct = normalizeAddress(entry.token_address || entry.contract_address || entry.address);
  if (direct) return direct;
  const platform = entry.platform || entry.platforms;
  if (Array.isArray(platform)) {
    for (const item of platform) {
      const addr = normalizeAddress(item.token_address || item.contract_address || item.address);
      if (addr) return addr;
    }
  } else if (platform) {
    return normalizeAddress(platform.token_address || platform.contract_address || platform.address);
  }
  return null;
};

const matchEntry = (entries, tokenAddress) => {
  const normalized = normalizeAddress(tokenAddress);
  const list = extractEntries(entries);
  if (!normalized) return list[0] || null;
  for (const entry of list) {
    const addr = candidateAddress(entry);
    if (addr && addr === normalized) {
      return entry;
    }
  }
  return list[0] || null;
};

const fetchTokens = async () => {
  const params = new URLSearchParams();
  params.set('chain_id', `eq.${DEFAULT_CHAIN_ID}`);
  params.set('is_active', 'eq.true');
  params.set('spam', 'eq.false');
  params.set('select', 'address,symbol,name,decimals,logo_url,metadata');
  params.set('limit', '10000');
  return select('tokens', params);
};

const fetchMarketRows = async (addresses) => {
  if (!addresses.length) return [];
  const batches = chunkArray(addresses, 200);
  const results = [];
  for (const batch of batches) {
    const rows = await selectByValues('token_market_data', 'token_address', batch, {
      chain_id: `eq.${DEFAULT_CHAIN_ID}`
    });
    results.push(...rows);
  }
  return results;
};

const buildMarketUpdates = (tokens, quoteData, infoData) => {
  const updates = [];
  for (const token of tokens) {
    const symbol = normalizeSymbol(token.symbol);
    if (!symbol) continue;
    const quoteEntry = matchEntry(quoteData?.[symbol], token.address);
    const infoEntry = matchEntry(infoData?.[symbol], token.address);
    const quoteUsd = quoteEntry?.quote?.USD || {};
    const price = quoteUsd.price ?? null;
    const marketCap = quoteUsd.market_cap ?? null;
    const volume24h = quoteUsd.volume_24h ?? null;
    const percentChange24h = quoteUsd.percent_change_24h ?? null;
    const lastUpdated = quoteUsd.last_updated || quoteEntry?.last_updated || new Date().toISOString();
    const logoUrl = infoEntry?.logo || infoEntry?.logo_url || null;

    if (price === null && logoUrl === null && marketCap === null) {
      continue;
    }

    updates.push({
      chain_id: DEFAULT_CHAIN_ID,
      token_address: normalizeAddress(token.address),
      price_usd: price,
      market_cap: marketCap,
      volume_24h: volume24h,
      percent_change_24h: percentChange24h,
      logo_url: logoUrl,
      last_updated: lastUpdated,
      source: 'coinmarketcap'
    });
  }
  return updates;
};

const syncMarketDataFromInkySwap = async ({ tokens, marketMap }) => {
  const pairs = await fetchInkySwapPairs();
  const { priceMap, volumeMap } = buildInkySwapSnapshot(pairs, tokens);
  const now = new Date().toISOString();
  const updates = [];

  for (const token of tokens) {
    const address = normalizeAddress(token.address);
    if (!address) continue;
    const existing = marketMap.get(address);
    if (existing && !isStale(existing.last_updated, MARKET_TTL_MINUTES)) {
      continue;
    }
    const price = priceMap.get(address);
    const volume = volumeMap.get(address);
    if (price == null && volume == null) continue;

    updates.push({
      chain_id: DEFAULT_CHAIN_ID,
      token_address: address,
      price_usd: price ?? null,
      market_cap: null,
      volume_24h: volume ?? null,
      percent_change_24h: null,
      logo_url: token.logo_url || null,
      last_updated: now,
      source: 'inkyswap'
    });
  }

  if (updates.length > 0) {
    await upsertMarketData(updates);
  }

  return {
    updated: updates.length,
    skipped: tokens.length - updates.length,
    source: 'inkyswap',
    pairs: pairs.length
  };
};

const syncMarketData = async () => {
  const tokens = await fetchTokens();
  const addresses = tokens.map((token) => normalizeAddress(token.address));
  const marketRows = await fetchMarketRows(addresses);
  const marketMap = new Map(
    marketRows.map((row) => [normalizeAddress(row.token_address), row])
  );
  const staleTokens = tokens.filter((token) => {
    const entry = marketMap.get(normalizeAddress(token.address));
    return !entry || isStale(entry.last_updated, MARKET_TTL_MINUTES);
  });

  if (USE_INKYSWAP_MARKET || !CMC_API_KEY) {
    return syncMarketDataFromInkySwap({ tokens, marketMap });
  }

  const symbols = Array.from(
    new Set(
      staleTokens
        .map((token) => normalizeSymbol(token.symbol))
        .filter((symbol) => isValidCmcSymbol(symbol))
    )
  );

  if (symbols.length === 0) {
    return syncMarketDataFromInkySwap({ tokens, marketMap });
  }

  const batches = chunkArray(symbols, BATCH_SIZE);
  let updated = 0;

  try {
    for (const batch of batches) {
      const symbolList = batch.join(',');
      const [quotes, info] = await Promise.all([
        cmcRequest('/v1/cryptocurrency/quotes/latest', { symbol: symbolList, convert: 'USD' }),
        cmcRequest('/v1/cryptocurrency/info', { symbol: symbolList })
      ]);

      const updates = buildMarketUpdates(staleTokens, quotes?.data || {}, info?.data || {});
      if (updates.length > 0) {
        await upsertMarketData(updates);
        updated += updates.length;
      }
    }
  } catch (error) {
    if (error?.status === 403) {
      console.warn('[syncMarketData] CMC plan does not allow market data. Falling back to InkySwap.');
      return syncMarketDataFromInkySwap({ tokens, marketMap });
    }
    throw error;
  }

  if (updated === 0) {
    return syncMarketDataFromInkySwap({ tokens, marketMap });
  }

  return { updated, skipped: tokens.length - updated, source: 'coinmarketcap' };
};

const fetchHistoryTargets = async () => {
  const params = new URLSearchParams();
  params.set('chain_id', `eq.${DEFAULT_CHAIN_ID}`);
  params.set('market_cap', 'not.is.null');
  params.set('order', 'market_cap.desc');
  params.set('limit', String(HISTORY_TOKEN_LIMIT));
  const marketRows = await select('token_market_data', params);
  const addresses = marketRows.map((row) => normalizeAddress(row.token_address));
  const tokenRows = await selectByValues('tokens', 'address', addresses, {
    select: 'address,symbol',
    chain_id: `eq.${DEFAULT_CHAIN_ID}`
  });
  const symbolMap = new Map(
    tokenRows.map((token) => [normalizeAddress(token.address), normalizeSymbol(token.symbol)])
  );
  return addresses
    .map((address) => ({
      address,
      symbol: symbolMap.get(address)
    }))
    .filter((item) => item.symbol);
};

const fetchLatestHistoryTimestamp = async (address) => {
  const params = new URLSearchParams();
  params.set('chain_id', `eq.${DEFAULT_CHAIN_ID}`);
  params.set('token_address', `eq.${normalizeAddress(address)}`);
  params.set('order', 'timestamp.desc');
  params.set('limit', '1');
  const rows = await select('token_price_history', params);
  return rows[0]?.timestamp || null;
};

const fetchOhlcv = async (symbol) => {
  if (ohlcvDisabled) return [];
  let response;
  try {
    response = await cmcRequest('/v1/cryptocurrency/ohlcv/historical', {
      symbol,
      convert: 'USD',
      interval: 'hourly',
      count: HISTORY_POINTS
    });
  } catch (error) {
    if (error?.status === 403) {
      ohlcvDisabled = true;
      console.warn('[syncMarketData] CMC OHLCV not permitted by plan. Skipping history sync.');
      return [];
    }
    throw error;
  }

  const entry = response?.data?.[symbol] || response?.data || null;
  const quotes = entry?.quotes || entry?.data?.quotes || [];
  return quotes.map((quote) => {
    const usd = quote?.quote?.USD || quote?.USD || {};
    return {
      timestamp: quote.time_close || quote.time_open || quote.time_high || quote.time_low,
      open: usd.open ?? null,
      high: usd.high ?? null,
      low: usd.low ?? null,
      close: usd.close ?? null,
      volume: usd.volume ?? null
    };
  });
};

const syncPriceHistoryFromInkySwap = async () => {
  const tokens = await fetchTokens();
  const pairs = await fetchInkySwapPairs();
  const { priceMap, volumeMap } = buildInkySwapSnapshot(pairs, tokens);
  const now = new Date().toISOString();
  const entries = [];
  let skipped = 0;

  for (const token of tokens) {
    const address = normalizeAddress(token.address);
    if (!address) continue;
    const price = priceMap.get(address);
    if (price == null) {
      skipped += 1;
      continue;
    }
    const lastTimestamp = await fetchLatestHistoryTimestamp(address);
    if (lastTimestamp && !isStale(lastTimestamp, HISTORY_TTL_MINUTES)) {
      skipped += 1;
      continue;
    }
    entries.push({
      chain_id: DEFAULT_CHAIN_ID,
      token_address: address,
      timestamp: now,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: volumeMap.get(address) ?? null
    });
  }

  if (entries.length > 0) {
    await upsertPriceHistory(entries);
  }

  return { tokens: tokens.length, upserted: entries.length, skipped, source: 'inkyswap' };
};

const syncPriceHistory = async () => {
  if (USE_INKYSWAP_MARKET || !CMC_API_KEY) {
    return syncPriceHistoryFromInkySwap();
  }

  const targets = await fetchHistoryTargets();
  let upserted = 0;
  let skipped = 0;

  for (const target of targets) {
    const lastTimestamp = await fetchLatestHistoryTimestamp(target.address);
    if (lastTimestamp && !isStale(lastTimestamp, HISTORY_TTL_MINUTES)) {
      skipped += 1;
      continue;
    }

    const quotes = await fetchOhlcv(target.symbol);
    if (ohlcvDisabled) {
      return syncPriceHistoryFromInkySwap();
    }
    const entries = quotes
      .filter((quote) => quote.timestamp)
      .map((quote) => ({
        chain_id: DEFAULT_CHAIN_ID,
        token_address: normalizeAddress(target.address),
        timestamp: quote.timestamp,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume
      }));

    if (entries.length > 0) {
      await upsertPriceHistory(entries);
      upserted += entries.length;
    }
  }

  return { tokens: targets.length, upserted, skipped };
};

module.exports = { syncMarketData, syncPriceHistory };

if (require.main === module) {
  const mode = process.argv[2] || 'market';
  const runner = mode === 'history' ? syncPriceHistory : syncMarketData;
  runner()
    .then((result) => {
      console.log('CMC sync complete', { mode, ...result });
    })
    .catch((error) => {
      console.error('CMC sync failed', error);
      process.exit(1);
    });
}
