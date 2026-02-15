const { select } = require('../lib/supabase');
const { resolveInkNames } = require('../lib/nameResolver');

const MAX_RESOLVES = Number(process.env.NAME_RESOLUTION_MAX_PER_RUN || 200);

const fetchUserAddresses = async () => {
  const params = new URLSearchParams();
  params.set('select', 'address');
  params.set('limit', '10000');
  const rows = await select('users', params);
  return rows
    .map((row) => row.address)
    .filter((address) => /^0x[a-fA-F0-9]{40}$/.test(String(address || '')));
};

const syncNames = async () => {
  const addresses = await fetchUserAddresses();
  const results = await resolveInkNames(addresses, { force: false, maxResolves: MAX_RESOLVES });
  return {
    total: addresses.length,
    processed: Object.keys(results).length
  };
};

module.exports = { syncNames };

if (require.main === module) {
  syncNames()
    .then((result) => {
      console.log('Name sync complete', result);
    })
    .catch((error) => {
      console.error('Name sync failed', error);
      process.exit(1);
    });
}
