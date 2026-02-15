const { request, select, selectByValues } = require('./supabase');

const BLOCKSCOUT_BASE =
  process.env.BLOCKSCOUT_BASE_URL ||
  process.env.INK_BLOCKSCOUT_API_BASE ||
  'https://explorer.inkonchain.com';
const INK_API_KEY = process.env.INK_API_KEY;
const TTL_HOURS = Number(process.env.NAME_RESOLUTION_TTL_HOURS || 24);

const normalizeAddress = (address) => (address ? String(address).toLowerCase() : null);
const normalizeName = (name) => {
  if (!name) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return withoutAt.toLowerCase();
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const isStale = (lastChecked) => {
  if (!lastChecked) return true;
  const checked = new Date(lastChecked).getTime();
  if (Number.isNaN(checked)) return true;
  return Date.now() - checked > TTL_HOURS * 60 * 60 * 1000;
};

const fetchCacheRow = async (address) => {
  const params = new URLSearchParams();
  params.set('wallet_address', `eq.${address}`);
  params.set('limit', '1');
  const rows = await select('name_resolution_cache', params);
  return rows[0] || null;
};

const upsertCache = async ({ address, dnsName, source, lastChecked }) => {
  const payload = {
    wallet_address: address,
    dns_name: dnsName,
    source: source || 'blockscout',
    last_checked: lastChecked || new Date().toISOString()
  };
  const response = await request('/rest/v1/name_resolution_cache?on_conflict=wallet_address', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: payload
  });
  return Array.isArray(response) ? response[0] : response;
};

const updateUserDns = async ({ address, dnsName, source, lastChecked }) => {
  await request(`/rest/v1/users?address=eq.${address}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: {
      dns_name: dnsName,
      dns_last_updated: lastChecked || new Date().toISOString(),
      resolver_source: source || 'blockscout'
    }
  });
};

const fetchBlockscoutName = async (address) => {
  if (!BLOCKSCOUT_BASE) return null;
  const url = new URL(`/api/v2/addresses/${address}`, BLOCKSCOUT_BASE);
  if (INK_API_KEY) {
    url.searchParams.set('apikey', INK_API_KEY);
  }
  const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Blockscout name lookup failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  const name =
    data?.ens_domain_name ||
    data?.ens_domain ||
    data?.name ||
    data?.primary_name ||
    null;
  return normalizeName(name);
};

const resolveInkName = async (address, { force = false, cached } = {}) => {
  const normalized = normalizeAddress(address);
  if (!normalized) {
    throw new Error('Invalid address for name resolution');
  }
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error('Invalid address format');
  }

  let cacheRow = cached || (await fetchCacheRow(normalized));
  if (cacheRow && !force && !isStale(cacheRow.last_checked)) {
    return { address: normalized, dnsName: cacheRow.dns_name || null, source: 'cache' };
  }

  let resolved = null;
  let source = 'blockscout';
  const now = new Date().toISOString();

  try {
    resolved = await fetchBlockscoutName(normalized);
  } catch (error) {
    const fallback = cacheRow?.dns_name || null;
    await upsertCache({ address: normalized, dnsName: fallback, source, lastChecked: now });
    return { address: normalized, dnsName: fallback, source: 'cache' };
  }

  await upsertCache({ address: normalized, dnsName: resolved, source, lastChecked: now });
  await updateUserDns({ address: normalized, dnsName: resolved, source, lastChecked: now });

  return { address: normalized, dnsName: resolved, source };
};

const resolveInkNames = async (addresses, { force = false, maxResolves = 50 } = {}) => {
  const unique = Array.from(new Set((addresses || []).map(normalizeAddress).filter(Boolean)));
  if (unique.length === 0) return {};

  const cachedRows = [];
  const batches = chunkArray(unique, 200);
  for (const batch of batches) {
    const rows = await selectByValues('name_resolution_cache', 'wallet_address', batch);
    cachedRows.push(...rows);
  }
  const cacheMap = new Map(
    cachedRows.map((row) => [normalizeAddress(row.wallet_address), row])
  );

  const results = {};
  const toResolve = [];

  unique.forEach((addr) => {
    const cached = cacheMap.get(addr);
    if (cached && !force && !isStale(cached.last_checked)) {
      results[addr] = cached.dns_name || null;
    } else {
      toResolve.push({ address: addr, cached });
    }
  });

  const limited = toResolve.slice(0, maxResolves);
  for (const item of limited) {
    const resolved = await resolveInkName(item.address, { force: true, cached: item.cached });
    results[item.address] = resolved.dnsName || null;
  }

  return results;
};

module.exports = { resolveInkName, resolveInkNames };
