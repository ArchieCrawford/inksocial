const http = require('node:http');
const { URL } = require('node:url');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const { sendJson, parseJsonBody } = require('./lib/http');
const {
  searchTokens,
  listTokens,
  listTokensWithMarket,
  searchTokensWithMarket,
  fetchTokenDetail,
  fetchTokenChart,
  listTrending,
  listRecent
} = require('./lib/tokens');
const { syncTokens } = require('./jobs/syncTokens');
const { fetchProfile, updateProfile, upsertUser } = require('./lib/profile');
const { uploadPublicObject } = require('./lib/storage');
const { resolveInkName } = require('./lib/nameResolver');
const { getCache, setCache } = require('./lib/cache');
const {
  issueNonce,
  consumeNonce,
  hashPayload,
  buildMessage,
  verifySignature
} = require('./lib/profileAuth');
const { fetchFeed, createCast, toggleReaction, fetchCounts } = require('./lib/casts');
const { createSession, getSession, removeSession } = require('./lib/sessions');
const { verifyMessage } = require('ethers');

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_CHAIN_ID = Number(process.env.INK_CHAIN_ID || 57073);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_BANNER_BYTES = 4 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120);
const SEARCH_RATE_LIMIT_WINDOW_MS = Number(process.env.SEARCH_RATE_LIMIT_WINDOW_MS || 60000);
const SEARCH_RATE_LIMIT_MAX_REQUESTS = Number(process.env.SEARCH_RATE_LIMIT_MAX_REQUESTS || 60);
const CACHE_TTL_TRENDING_MS = Number(process.env.CACHE_TTL_TRENDING_MS || 15000);
const CACHE_TTL_RECENT_MS = Number(process.env.CACHE_TTL_RECENT_MS || 15000);
const CACHE_TTL_SEARCH_MS = Number(process.env.CACHE_TTL_SEARCH_MS || 10000);
const CACHE_TTL_TOKEN_MS = Number(process.env.CACHE_TTL_TOKEN_MS || 20000);
const CACHE_TTL_CHART_MS = Number(process.env.CACHE_TTL_CHART_MS || 60000);

const rateState = new Map();
const searchRateState = new Map();

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
};

const isRateLimited = (req, res) => {
  if (!RATE_LIMIT_MAX_REQUESTS || !RATE_LIMIT_WINDOW_MS) return false;
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rateState.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  rateState.set(ip, entry);

  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    sendJson(res, 429, { error: 'Too many requests' });
    return true;
  }
  return false;
};

const isSearchRateLimited = (req, res) => {
  if (!SEARCH_RATE_LIMIT_MAX_REQUESTS || !SEARCH_RATE_LIMIT_WINDOW_MS) return false;
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = searchRateState.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > SEARCH_RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  searchRateState.set(ip, entry);

  if (entry.count > SEARCH_RATE_LIMIT_MAX_REQUESTS) {
    sendJson(res, 429, { error: 'Too many search requests' });
    return true;
  }
  return false;
};

const normalizeWindow = (value) => {
  if (value === '2h' || value === '6h' || value === '24h') return value;
  return '6h';
};

const parseRangeToStart = (range) => {
  if (!range) return null;
  const now = Date.now();
  const lookup = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000
  };
  const ms = lookup[range];
  if (!ms) return null;
  return new Date(now - ms).toISOString();
};

const readAdminKey = (req) => {
  const headerKey = req.headers['x-admin-api-key'];
  if (headerKey) return headerKey;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return '';
};

const readSessionToken = (req) => {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return '';
};

const requireSession = (req, res) => {
  const token = readSessionToken(req);
  const session = getSession(token);
  if (!session) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  return session;
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Api-Key',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    res.end();
    return;
  }

  if (isRateLimited(req, res)) {
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/tokens/search') {
    const query = (url.searchParams.get('q') || '').trim();
    const chainId = Number(url.searchParams.get('chainId') || DEFAULT_CHAIN_ID);
    const limit = Math.min(Number(url.searchParams.get('limit') || 20), 50);

    if (!query) {
      sendJson(res, 200, { items: [] });
      return;
    }

    try {
      if (isSearchRateLimited(req, res)) return;
      const cacheKey = `tokens:search:${chainId}:${query}:${limit}`;
      const cached = getCache(cacheKey);
      if (cached) {
        sendJson(res, 200, cached);
        return;
      }
      const items = await searchTokensWithMarket({ query, chainId, limit });
      const payload = { items };
      setCache(cacheKey, payload, CACHE_TTL_SEARCH_MS);
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/tokens/trending') {
    const window = normalizeWindow(url.searchParams.get('window'));
    const chainId = Number(url.searchParams.get('chainId') || DEFAULT_CHAIN_ID);
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 50);
    const cursor = url.searchParams.get('cursor') || '';

    try {
      const cacheKey = `tokens:trending:${chainId}:${window}:${limit}:${cursor}`;
      const cached = getCache(cacheKey);
      if (cached) {
        sendJson(res, 200, cached);
        return;
      }
      const result = await listTrending({ chainId, window, limit, cursor });
      setCache(cacheKey, result, CACHE_TTL_TRENDING_MS);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/tokens/recent') {
    const chainId = Number(url.searchParams.get('chainId') || DEFAULT_CHAIN_ID);
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 50);
    const cursor = url.searchParams.get('cursor') || '';

    try {
      const cacheKey = `tokens:recent:${chainId}:${limit}:${cursor}`;
      const cached = getCache(cacheKey);
      if (cached) {
        sendJson(res, 200, cached);
        return;
      }
      const result = await listRecent({ chainId, limit, cursor });
      setCache(cacheKey, result, CACHE_TTL_RECENT_MS);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/tokens/list') {
    const chainId = Number(url.searchParams.get('chainId') || DEFAULT_CHAIN_ID);
    const limit = Math.min(Number(url.searchParams.get('limit') || 20), 50);
    const offset = Number(url.searchParams.get('offset') || 0);

    try {
      const items = await listTokensWithMarket({ chainId, limit, offset });
      sendJson(res, 200, { items });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/tokens') {
    const chainId = Number(url.searchParams.get('chainId') || DEFAULT_CHAIN_ID);
    const limit = Math.min(Number(url.searchParams.get('limit') || 20), 50);
    const cursor = url.searchParams.get('cursor') || '';

    try {
      const result = await listRecent({ chainId, limit, cursor });
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/token/search') {
    const query = (url.searchParams.get('q') || '').trim();
    const chainId = Number(url.searchParams.get('chainId') || DEFAULT_CHAIN_ID);
    const limit = Math.min(Number(url.searchParams.get('limit') || 20), 50);

    if (!query) {
      sendJson(res, 200, { items: [] });
      return;
    }

    try {
      if (isSearchRateLimited(req, res)) return;
      const cacheKey = `tokens:search:${chainId}:${query}:${limit}`;
      const cached = getCache(cacheKey);
      if (cached) {
        sendJson(res, 200, cached);
        return;
      }
      const items = await searchTokensWithMarket({ query, chainId, limit });
      const payload = { items };
      setCache(cacheKey, payload, CACHE_TTL_SEARCH_MS);
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/token/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const address = parts[1];
    if (!address) {
      sendJson(res, 400, { error: 'Missing token address' });
      return;
    }

    if (parts.length === 3 && parts[2] === 'chart') {
      const limit = Math.min(Number(url.searchParams.get('limit') || 168), 500);
      const range = url.searchParams.get('range');
      const start = url.searchParams.get('start') || parseRangeToStart(range);
      const end = url.searchParams.get('end');
      try {
        const cacheKey = `token:chart:${address}:${range || ''}:${start || ''}:${end || ''}:${limit}`;
        const cached = getCache(cacheKey);
        if (cached) {
          sendJson(res, 200, cached);
          return;
        }
        const items = await fetchTokenChart({ address, chainId: DEFAULT_CHAIN_ID, limit, start, end });
        const payload = { items };
        setCache(cacheKey, payload, CACHE_TTL_CHART_MS);
        sendJson(res, 200, payload);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }

    try {
      const cacheKey = `token:detail:${address}`;
      const cached = getCache(cacheKey);
      if (cached) {
        sendJson(res, 200, cached);
        return;
      }
      const token = await fetchTokenDetail({ address, chainId: DEFAULT_CHAIN_ID });
      if (!token) {
        sendJson(res, 404, { error: 'Token not found' });
        return;
      }
      setCache(cacheKey, token, CACHE_TTL_TOKEN_MS);
      sendJson(res, 200, token);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/auth/login') {
    const body = await parseJsonBody(req);
    const address = body?.address;
    const message = body?.message;
    const signature = body?.signature;
    if (!address || !message || !signature) {
      sendJson(res, 400, { error: 'Missing login payload' });
      return;
    }
    try {
      const recovered = verifyMessage(message, signature);
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        sendJson(res, 401, { error: 'Signature invalid' });
        return;
      }
      const username = `ink_${address.slice(2, 6)}`;
      await upsertUser({
        address,
        username,
        display_name: username,
        pfp_url: 'https://rosebud.ai/assets/avatar-1.webp?Vg8e'
      });
      try {
        await resolveInkName(address);
      } catch (error) {
        // Resolver failures should not block login.
      }
      const profile = await fetchProfile(address);
      const sessionToken = createSession(address);
      sendJson(res, 200, { sessionToken, profile });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/auth/logout') {
    const token = readSessionToken(req);
    if (token) removeSession(token);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/casts/feed') {
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
    const offset = Number(url.searchParams.get('offset') || 0);
    const session = getSession(readSessionToken(req));
    try {
      const items = await fetchFeed({ limit, offset, address: session?.address });
      sendJson(res, 200, { items });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/casts') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJsonBody(req);
    const { content, channel_id, parent_hash } = body || {};
    if (!content) {
      sendJson(res, 400, { error: 'Missing content' });
      return;
    }
    try {
      const cast = await createCast({
        address: session.address,
        content,
        channel_id,
        parent_hash
      });
      sendJson(res, 200, cast);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/casts/like') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJsonBody(req);
    const hash = body?.hash;
    if (!hash) {
      sendJson(res, 400, { error: 'Missing hash' });
      return;
    }
    try {
      const isLiked = await toggleReaction({ table: 'likes', address: session.address, hash });
      const counts = await fetchCounts(hash);
      sendJson(res, 200, { isLiked, likes: counts.like_count });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/casts/recast') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJsonBody(req);
    const hash = body?.hash;
    if (!hash) {
      sendJson(res, 400, { error: 'Missing hash' });
      return;
    }
    try {
      const isRecasted = await toggleReaction({ table: 'recasts', address: session.address, hash });
      const counts = await fetchCounts(hash);
      sendJson(res, 200, { isRecasted, recasts: counts.recast_count });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/profile') {
    const address = url.searchParams.get('address');
    if (!address) {
      sendJson(res, 400, { error: 'Missing address' });
      return;
    }
    try {
      try {
        await resolveInkName(address);
      } catch (error) {
        // Resolver failures should not block profile loads.
      }
      const profile = await fetchProfile(address);
      if (!profile) {
        sendJson(res, 404, { error: 'Profile not found' });
        return;
      }
      sendJson(res, 200, profile);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/resolve/name') {
    const address = url.searchParams.get('address');
    if (!address) {
      sendJson(res, 400, { error: 'Missing address' });
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      sendJson(res, 400, { error: 'Invalid address format' });
      return;
    }
    try {
      const result = await resolveInkName(address);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/profile/nonce') {
    const body = await parseJsonBody(req);
    const address = body?.address;
    if (!address) {
      sendJson(res, 400, { error: 'Missing address' });
      return;
    }
    const nonce = issueNonce(address);
    sendJson(res, 200, nonce);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/profile/save') {
    const body = await parseJsonBody(req);
    const {
      address,
      updates = {},
      uploads = [],
      nonce,
      issuedAt,
      payloadHash,
      signature,
      message
    } = body || {};

    if (!address || !nonce || !issuedAt || !payloadHash || !signature || !message) {
      sendJson(res, 400, { error: 'Missing required fields' });
      return;
    }

    const payload = {
      updates,
      uploads: uploads.map(({ kind, fileName, fileType, size }) => ({
        kind,
        fileName,
        fileType,
        size
      }))
    };
    const expectedHash = hashPayload(payload);
    if (expectedHash !== payloadHash) {
      sendJson(res, 400, { error: 'Payload mismatch' });
      return;
    }

    const expectedMessage = buildMessage({ address, nonce, issuedAt, payloadHash: expectedHash });
    if (expectedMessage !== message) {
      sendJson(res, 400, { error: 'Message mismatch' });
      return;
    }

    if (!consumeNonce(address, nonce)) {
      sendJson(res, 400, { error: 'Invalid or expired nonce' });
      return;
    }

    if (!verifySignature({ address, message, signature })) {
      sendJson(res, 401, { error: 'Signature invalid' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedKeys = new Set(['display_name', 'bio', 'website', 'location', 'pronouns', 'username']);
    const updated = Object.fromEntries(
      Object.entries(updates).filter(([key, value]) => allowedKeys.has(key) && value !== undefined)
    );
    Object.keys(updated).forEach((key) => {
      if (typeof updated[key] === 'string') {
        updated[key] = updated[key].trim();
      }
    });
    try {
      const existingProfile = await fetchProfile(address);
      if (!existingProfile) {
        sendJson(res, 404, { error: 'Profile not found' });
        return;
      }

      if (existingProfile.on_chain_tx_hash && updated.username && updated.username !== existingProfile.username) {
        sendJson(res, 400, { error: 'Username is locked on-chain' });
        return;
      }

      if (updated.username && !/^[a-zA-Z0-9_]{3,20}$/.test(updated.username)) {
        sendJson(res, 400, { error: 'Invalid username format' });
        return;
      }

      for (const upload of uploads) {
        if (!upload?.dataUrl) continue;
        if (!allowedTypes.includes(upload.fileType)) {
          throw new Error('Unsupported file type');
        }
        if (upload.kind === 'avatar' && upload.size > MAX_AVATAR_BYTES) {
          throw new Error('Avatar file too large');
        }
        if (upload.kind === 'banner' && upload.size > MAX_BANNER_BYTES) {
          throw new Error('Banner file too large');
        }
        const ext = upload.fileName?.split('.').pop() || 'png';
        const key = `${address.toLowerCase()}/${upload.kind}-${Date.now()}.${ext}`;
        const url = await uploadPublicObject({
          path: key,
          dataUrl: upload.dataUrl,
          contentTypeOverride: upload.fileType
        });
        if (upload.kind === 'avatar') updated.pfp_url = url;
        if (upload.kind === 'banner') updated.banner_url = url;
      }

      const profile = await updateProfile(address, updated);
      sendJson(res, 200, { profile });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/admin/tokens/sync') {
    const adminKey = process.env.ADMIN_API_KEY;
    const providedKey = readAdminKey(req);

    if (!adminKey || providedKey !== adminKey) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      const result = await syncTokens();
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[InkSocial API] Listening on :${PORT}`);
});
