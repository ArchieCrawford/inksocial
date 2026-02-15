const crypto = require('node:crypto');
const { request, select } = require('./supabase');

const createHash = () => `0x${crypto.randomBytes(16).toString('hex')}`;

const fetchFeed = async ({ limit = 50, offset = 0, address }) => {
  const params = new URLSearchParams();
  params.set('select', 'hash,author_address,author_username,author_display_name,author_pfp_url,author_dns_name,content,channel_id,parent_hash,signature,timestamp,created_at,like_count,recast_count,reply_count');
  params.set('order', 'timestamp.desc');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  const items = await select('cast_feed', params);

  if (address && items.length) {
    const hashes = items.map((item) => item.hash).join(',');
    const likeParams = new URLSearchParams();
    likeParams.set('select', 'cast_hash');
    likeParams.set('cast_hash', `in.(${hashes})`);
    likeParams.set('user_address', `eq.${address.toLowerCase()}`);
    const liked = await select('likes', likeParams);
    const likedSet = new Set(liked.map((l) => l.cast_hash));

    const recastParams = new URLSearchParams();
    recastParams.set('select', 'cast_hash');
    recastParams.set('cast_hash', `in.(${hashes})`);
    recastParams.set('user_address', `eq.${address.toLowerCase()}`);
    const recasted = await select('recasts', recastParams);
    const recastSet = new Set(recasted.map((r) => r.cast_hash));

    return items.map((item) => ({
      ...item,
      is_liked: likedSet.has(item.hash),
      is_recasted: recastSet.has(item.hash)
    }));
  }

  return items;
};

const createCast = async ({ address, content, channel_id, parent_hash }) => {
  const hash = createHash();
  const timestamp = Date.now();
  const payload = {
    hash,
    author_address: address.toLowerCase(),
    content,
    channel_id: channel_id || 'all',
    parent_hash: parent_hash || null,
    signature: 'session',
    timestamp
  };

  const response = await request('/rest/v1/casts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: payload
  });

  const row = Array.isArray(response) ? response[0] : response;
  const params = new URLSearchParams();
  params.set('hash', `eq.${row.hash}`);
  params.set('select', 'hash,author_address,author_username,author_display_name,author_pfp_url,author_dns_name,content,channel_id,parent_hash,signature,timestamp,created_at,like_count,recast_count,reply_count');
  const feedRows = await select('cast_feed', params);
  return feedRows[0] || row;
};

const toggleReaction = async ({ table, address, hash }) => {
  const params = new URLSearchParams();
  params.set('cast_hash', `eq.${hash}`);
  params.set('user_address', `eq.${address.toLowerCase()}`);
  params.set('select', 'cast_hash');
  const existing = await select(table, params);

  if (existing.length) {
    await request(`/rest/v1/${table}?cast_hash=eq.${hash}&user_address=eq.${address.toLowerCase()}`, {
      method: 'DELETE'
    });
    return false;
  }

  await request(`/rest/v1/${table}`, {
    method: 'POST',
    body: {
      cast_hash: hash,
      user_address: address.toLowerCase()
    }
  });
  return true;
};

const fetchCounts = async (hash) => {
  const params = new URLSearchParams();
  params.set('hash', `eq.${hash}`);
  params.set('select', 'like_count,recast_count,reply_count');
  const rows = await select('cast_feed', params);
  return rows[0] || { like_count: 0, recast_count: 0, reply_count: 0 };
};

module.exports = { fetchFeed, createCast, toggleReaction, fetchCounts };
