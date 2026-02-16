const { upsertTokens } = require('../lib/supabase');

const DEFAULT_CHAIN_ID = Number(process.env.INK_CHAIN_ID || 57073);
const resolveBlockscoutBase = () => {
  const preferred = process.env.INK_BLOCKSCOUT_API_BASE;
  if (preferred && /^https?:\/\//i.test(preferred)) return preferred;
  return process.env.BLOCKSCOUT_BASE_URL;
};
const BLOCKSCOUT_BASE = resolveBlockscoutBase();
const SAFE_TX_BASE = process.env.SAFE_TX_SERVICE_BASE;
const INK_API_KEY = process.env.INK_API_KEY;
const INKYSWAP_BASE = process.env.INKYSWAP_API_BASE || 'https://inkyswap.com';
const INKYPUMP_BASE = process.env.INKYPUMP_API_BASE || 'https://inkypump.com';
const INKYPUMP_BATCH_SIZE = Number(process.env.INKYPUMP_BATCH_SIZE || 50);
const INKYPUMP_MAX_BATCHES = Number(process.env.INKYPUMP_MAX_BATCHES || 10);
const INKYPUMP_BATCH_DELAY_MS = Number(process.env.INKYPUMP_BATCH_DELAY_MS || 2000);

const normalizeAddress = (address) => (address ? address.toLowerCase() : null);

const assertValidBaseUrl = (value, label) => {
  if (!value) {
    throw new Error(`Missing ${label}`);
  }
  if (!/^https?:\/\//i.test(value)) {
    throw new Error(`${label} must be a full URL (e.g. https://explorer.inkonchain.com)`);
  }
  return value;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, options = {}, retries = 2) => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await fetch(url, options);
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`${response.status} ${text}`);
      }
      return text ? JSON.parse(text) : null;
    } catch (error) {
      attempt += 1;
      if (attempt > retries) throw error;
      await sleep(500 * attempt);
    }
  }
  return null;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const fetchBlockscoutTokens = async () => {
  let baseUrl;
  try {
    baseUrl = assertValidBaseUrl(BLOCKSCOUT_BASE, 'BLOCKSCOUT_BASE_URL');
  } catch (error) {
    console.warn('[syncTokens] Blockscout disabled:', error.message);
    return [];
  }

  const tokens = [];
  let nextParams = null;
  let pageCount = 0;
  const maxPages = Number(process.env.BLOCKSCOUT_MAX_PAGES || 20);

  while (pageCount < maxPages) {
    // Blockscout REST API v2 tokens list: GET /api/v2/tokens
    const url = new URL('/api/v2/tokens', baseUrl);
    if (INK_API_KEY) {
      url.searchParams.set('apikey', INK_API_KEY);
    }
    if (nextParams) {
      Object.entries(nextParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Blockscout tokens fetch failed: ${response.status} ${text}`);
    }
    const data = await response.json();
    tokens.push(...(data.items || []));
    nextParams = data.next_page_params;
    pageCount += 1;
    if (!nextParams) break;
  }

  return tokens;
};

const fetchSafeTokens = async () => {
  if (!SAFE_TX_BASE || !/^https?:\/\//i.test(SAFE_TX_BASE)) {
    console.warn('[syncTokens] Safe tokens disabled: missing SAFE_TX_SERVICE_BASE');
    return [];
  }

  const tokens = [];
  let offset = 0;
  const limit = Number(process.env.SAFE_TOKENS_PAGE_SIZE || 200);
  const maxPages = Number(process.env.SAFE_MAX_PAGES || 20);

  for (let page = 0; page < maxPages; page += 1) {
    // Safe Transaction Service tokens list: GET /api/v1/tokens/
    const url = new URL('/api/v1/tokens/', SAFE_TX_BASE);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url.toString());
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Safe tokens fetch failed: ${response.status} ${text}`);
    }
    const data = await response.json();
    const results = data.results || data;
    if (Array.isArray(results)) {
      tokens.push(...results);
    }

    if (!data.next || results.length < limit) break;
    offset += limit;
  }

  return tokens;
};

const fetchInkySwapTokens = async () => {
  let baseUrl;
  try {
    baseUrl = assertValidBaseUrl(INKYSWAP_BASE, 'INKYSWAP_API_BASE');
  } catch (error) {
    console.warn('[syncTokens] InkySwap disabled:', error.message);
    return [];
  }
  const url = new URL('/api/tokens', baseUrl);
  const data = await fetchJson(url.toString());
  if (!data) return [];
  const tokens = data.tokens || data.items || data;
  if (!Array.isArray(tokens)) return [];
  return tokens.filter((token) => Number(token.chainId) === DEFAULT_CHAIN_ID);
};

const fetchInkyPumpBatch = async (addresses) => {
  let baseUrl;
  try {
    baseUrl = assertValidBaseUrl(INKYPUMP_BASE, 'INKYPUMP_API_BASE');
  } catch (error) {
    console.warn('[syncTokens] InkyPump disabled:', error.message);
    return [];
  }
  if (!addresses.length) return [];
  const batches = chunkArray(addresses, INKYPUMP_BATCH_SIZE);
  const results = [];
  for (let i = 0; i < Math.min(batches.length, INKYPUMP_MAX_BATCHES); i += 1) {
    const batch = batches[i];
    const url = new URL('/api/tokens/batch', baseUrl);
    const payload = {
      addresses: batch,
      includeMetrics: true,
      includeHolders: false
    };
    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      if (!response.ok) {
        if (response.status === 429) {
          await sleep(INKYPUMP_BATCH_DELAY_MS);
          continue;
        }
        throw new Error(`InkyPump batch failed: ${response.status} ${text}`);
      }
      const parsed = text ? JSON.parse(text) : null;
      const data = parsed?.data || parsed;
      const tokens = data?.tokens || data?.items || data || [];
      if (Array.isArray(tokens)) {
        results.push(...tokens);
      }
    } catch (error) {
      // Skip failures for a batch to keep sync moving.
    }
    await sleep(INKYPUMP_BATCH_DELAY_MS);
  }
  return results;
};

const normalizeBlockscout = (token) => ({
  chain_id: DEFAULT_CHAIN_ID,
  address: normalizeAddress(token.address_hash),
  symbol: token.symbol || null,
  name: token.name || null,
  decimals: token.decimals ? Number(token.decimals) : null,
  logo_url: token.icon_url || null,
  verified: false,
  source: 'blockscout',
  spam: false,
  is_active: true,
  metadata: { blockscout: token }
});

const normalizeSafe = (token) => ({
  chain_id: DEFAULT_CHAIN_ID,
  address: normalizeAddress(token.address),
  symbol: token.symbol || null,
  name: token.name || null,
  decimals: token.decimals !== undefined ? Number(token.decimals) : null,
  logo_url: token.logoUri || token.logo_url || null,
  verified: true,
  source: 'safe',
  spam: false,
  is_active: true,
  metadata: { safe: token }
});

const normalizeInkySwap = (token) => ({
  chain_id: DEFAULT_CHAIN_ID,
  address: normalizeAddress(token.address),
  symbol: token.symbol || null,
  name: token.name || null,
  decimals: token.decimals !== undefined ? Number(token.decimals) : null,
  logo_url: token.logoURI || null,
  verified: true,
  source: 'inkyswap',
  spam: false,
  is_active: true,
  metadata: { inkyswap: token }
});

const normalizeInkyPump = (token) => ({
  chain_id: DEFAULT_CHAIN_ID,
  address: normalizeAddress(token.address),
  symbol: token.ticker || token.symbol || null,
  name: token.name || null,
  decimals: token.decimals !== undefined ? Number(token.decimals) : null,
  logo_url: token.image_url || token.logo_url || null,
  verified: false,
  source: 'inkypump',
  spam: false,
  is_active: true,
  metadata: { inkypump: token }
});

const sourcePriority = {
  blockscout: 1,
  inkypump: 2,
  inkyswap: 3,
  safe: 4
};

const mergeToken = (existing, incoming, { preferLogo = false } = {}) => {
  if (!existing) return incoming;
  const merged = { ...existing };
  merged.symbol = merged.symbol || incoming.symbol;
  merged.name = merged.name || incoming.name;
  merged.decimals = merged.decimals ?? incoming.decimals;
  if (preferLogo && incoming.logo_url) {
    merged.logo_url = incoming.logo_url;
  } else if (!merged.logo_url && incoming.logo_url) {
    merged.logo_url = incoming.logo_url;
  }
  merged.verified = Boolean(merged.verified || incoming.verified);
  const existingPriority = sourcePriority[merged.source] || 0;
  const incomingPriority = sourcePriority[incoming.source] || 0;
  merged.source = incomingPriority >= existingPriority ? incoming.source : merged.source;
  merged.metadata = { ...merged.metadata, ...incoming.metadata };
  return merged;
};

const mergeTokens = (blockscoutTokens, safeTokens, inkyswapTokens, inkypumpTokens) => {
  const merged = new Map();

  blockscoutTokens.forEach((token) => {
    const normalized = normalizeBlockscout(token);
    if (!normalized.address) return;
    const key = `${normalized.chain_id}:${normalized.address}`;
    merged.set(key, normalized);
  });

  safeTokens.forEach((token) => {
    const normalized = normalizeSafe(token);
    if (!normalized.address) return;
    const key = `${normalized.chain_id}:${normalized.address}`;
    const existing = merged.get(key);
    const combined = mergeToken(existing, normalized, { preferLogo: true });
    merged.set(key, combined);
  });

  inkyswapTokens.forEach((token) => {
    const normalized = normalizeInkySwap(token);
    if (!normalized.address) return;
    const key = `${normalized.chain_id}:${normalized.address}`;
    const existing = merged.get(key);
    const combined = mergeToken(existing, normalized, { preferLogo: false });
    merged.set(key, combined);
  });

  inkypumpTokens.forEach((token) => {
    const normalized = normalizeInkyPump(token);
    if (!normalized.address) return;
    const key = `${normalized.chain_id}:${normalized.address}`;
    const existing = merged.get(key);
    const combined = mergeToken(existing, normalized, { preferLogo: false });
    merged.set(key, combined);
  });

  return Array.from(merged.values());
};

const syncTokens = async () => {
  const [blockscoutResult, safeResult, inkyswapResult] = await Promise.allSettled([
    fetchBlockscoutTokens(),
    fetchSafeTokens(),
    fetchInkySwapTokens()
  ]);
  const blockscoutTokens = blockscoutResult.status === 'fulfilled' ? blockscoutResult.value : [];
  const safeTokens = safeResult.status === 'fulfilled' ? safeResult.value : [];
  const inkyswapTokens = inkyswapResult.status === 'fulfilled' ? inkyswapResult.value : [];

  const partial = mergeTokens(blockscoutTokens, safeTokens, inkyswapTokens, []);
  const enrichTargets = partial
    .filter((token) => !token.logo_url || !token.metadata?.inkypump)
    .map((token) => token.address)
    .filter(Boolean);
  const inkypumpTokens = await fetchInkyPumpBatch(enrichTargets);
  const merged = mergeTokens(blockscoutTokens, safeTokens, inkyswapTokens, inkypumpTokens);
  await upsertTokens(merged);

  return {
    chainId: DEFAULT_CHAIN_ID,
    blockscoutCount: blockscoutTokens.length,
    safeCount: safeTokens.length,
    inkyswapCount: inkyswapTokens.length,
    inkypumpCount: inkypumpTokens.length,
    upserted: merged.length
  };
};

module.exports = { syncTokens };

if (require.main === module) {
  syncTokens()
    .then((result) => {
      console.log('Sync complete', result);
    })
    .catch((error) => {
      console.error('Sync failed', error);
      process.exit(1);
    });
}
