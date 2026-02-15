const { URL } = require('node:url');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const request = async (path, { method = 'GET', headers = {}, body } = {}) => {
  const url = new URL(path, SUPABASE_URL);
  const response = await fetch(url.toString(), {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Supabase response parse failed: ${response.status} ${text}`);
  }
};

const rpc = async (fn, payload) => {
  return request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: payload });
};

const select = async (path, params) => {
  const query = params.toString();
  return request(`/rest/v1/${path}?${query}`);
};

const buildInFilter = (values) => {
  const sanitized = values
    .filter(Boolean)
    .map((value) => `"${String(value).replace(/"/g, '\\"')}"`);
  if (sanitized.length === 0) return null;
  return `in.(${sanitized.join(',')})`;
};

const selectByValues = async (path, field, values, extraParams = {}) => {
  const filter = buildInFilter(values);
  if (!filter) return [];
  const params = new URLSearchParams();
  params.set(field, filter);
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  });
  return select(path, params);
};

const upsertTokens = async (tokens, chunkSize = 500) => {
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    await request('/rest/v1/tokens?on_conflict=chain_id,address', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: chunk
    });
  }
};

const upsertMarketData = async (entries, chunkSize = 500) => {
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    await request('/rest/v1/token_market_data?on_conflict=chain_id,token_address', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: chunk
    });
  }
};

const upsertPriceHistory = async (entries, chunkSize = 500) => {
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    await request('/rest/v1/token_price_history?on_conflict=chain_id,token_address,timestamp', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: chunk
    });
  }
};

module.exports = {
  rpc,
  select,
  selectByValues,
  upsertTokens,
  upsertMarketData,
  upsertPriceHistory,
  request
};
