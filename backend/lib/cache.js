const cache = new Map();

const now = () => Date.now();

const getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const setCache = (key, value, ttlMs = 0) => {
  const expiresAt = ttlMs ? now() + ttlMs : null;
  cache.set(key, { value, expiresAt });
  return value;
};

module.exports = { getCache, setCache };
