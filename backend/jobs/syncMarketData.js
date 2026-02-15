const { select, selectByValues, upsertMarketData, upsertPriceHistory } = require('../lib/supabase');

const CMC_BASE_URL = process.env.CMC_API_BASE || 'https://pro-api.coinmarketcap.com';
const CMC_API_KEY = process.env.CMC_API_KEY;
const DEFAULT_CHAIN_ID = Number(process.env.INK_CHAIN_ID || 57073);
const MARKET_TTL_MINUTES = Number(process.env.MARKET_DATA_TTL_MINUTES || 10);
const HISTORY_TTL_MINUTES = Number(process.env.MARKET_HISTORY_TTL_MINUTES || 60);
const BATCH_SIZE = Number(process.env.CMC_BATCH_SIZE || 100);
const HISTORY_POINTS = Number(process.env.CMC_HISTORY_POINTS || 168);
const HISTORY_TOKEN_LIMIT = Number(process.env.CMC_HISTORY_TOKEN_LIMIT || 50);

const normalizeSymbol = (symbol) => (symbol ? String(symbol).trim().toUpperCase() : null);
const isValidCmcSymbol = (symbol) => Boolean(symbol && /^[A-Z0-9]+$/.test(symbol));
const normalizeAddress = (address) => (address ? String(address).toLowerCase() : null);

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
  return fetchWithRetry(url.toString(), {
    headers: {
      'X-CMC_PRO_API_KEY': CMC_API_KEY
    }
  });
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

  const symbols = Array.from(
    new Set(
      staleTokens
        .map((token) => normalizeSymbol(token.symbol))
        .filter((symbol) => isValidCmcSymbol(symbol))
    )
  );

  if (symbols.length === 0) {
    return { updated: 0, skipped: tokens.length };
  }

  const batches = chunkArray(symbols, BATCH_SIZE);
  let updated = 0;

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

  return { updated, skipped: tokens.length - updated };
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
  const response = await cmcRequest('/v1/cryptocurrency/ohlcv/historical', {
    symbol,
    convert: 'USD',
    interval: 'hourly',
    count: HISTORY_POINTS
  });

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

const syncPriceHistory = async () => {
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
