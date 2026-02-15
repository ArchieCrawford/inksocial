const { rpc } = require('../lib/supabase');

const DEFAULT_CHAIN_ID = Number(process.env.INK_CHAIN_ID || 57073);

const computeTrendingRanks = async () => {
  await rpc('refresh_token_trending', { p_chain_id: DEFAULT_CHAIN_ID });
  return { chainId: DEFAULT_CHAIN_ID };
};

module.exports = { computeTrendingRanks };

if (require.main === module) {
  computeTrendingRanks()
    .then((result) => {
      console.log('Trending ranks refreshed', result);
    })
    .catch((error) => {
      console.error('Trending rank refresh failed', error);
      process.exit(1);
    });
}
