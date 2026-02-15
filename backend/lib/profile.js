const { select, request } = require('./supabase');
const crypto = require('node:crypto');

const fetchProfile = async (address) => {
  const params = new URLSearchParams();
  params.set('address', `eq.${address.toLowerCase()}`);
  params.set('select', 'fid,address,username,display_name,pfp_url,banner_url,bio,website,location,pronouns,on_chain_tx_hash,dns_name,dns_last_updated,resolver_source');
  const results = await select('user_profiles_with_dns', params);
  return results[0] || null;
};

const updateProfile = async (address, updates) => {
  const response = await request(`/rest/v1/users?address=eq.${address.toLowerCase()}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation'
    },
    body: updates
  });
  return Array.isArray(response) ? response[0] : response;
};

const generateFid = () => {
  const buf = crypto.randomBytes(6);
  return parseInt(buf.toString('hex'), 16);
};

const upsertUser = async ({ address, username, display_name, pfp_url }) => {
  const payload = {
    fid: generateFid(),
    address: address.toLowerCase(),
    username,
    display_name,
    pfp_url
  };
  const response = await request('/rest/v1/users?on_conflict=address', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: payload
  });
  return Array.isArray(response) ? response[0] : response;
};

module.exports = { fetchProfile, updateProfile, upsertUser };
