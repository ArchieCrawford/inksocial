const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { syncTokens } = require('./syncTokens');
const { syncMarketData, syncPriceHistory } = require('./syncMarketData');
const { computeTrendingRanks } = require('./computeTrending');
const { syncNames } = require('./resolveNamesBatch');

const JOBS = {
  tokens: async () => syncTokens(),
  market: async () => syncMarketData(),
  ohlcv: async () => syncPriceHistory(),
  trending: async () => computeTrendingRanks(),
  names: async () => syncNames()
};

const runJobs = async (jobNames) => {
  const results = {};
  for (const name of jobNames) {
    const job = JOBS[name];
    if (!job) {
      throw new Error(`Unknown job "${name}". Use: ${Object.keys(JOBS).join(', ')}`);
    }
    const started = Date.now();
    results[name] = await job();
    results[`${name}_ms`] = Date.now() - started;
  }
  return results;
};

const normalizeArgs = (args) => {
  if (!args.length || args.includes('all')) return Object.keys(JOBS);
  return args;
};

if (require.main === module) {
  const args = process.argv.slice(2).map((arg) => arg.trim().toLowerCase()).filter(Boolean);
  const jobNames = normalizeArgs(args);
  runJobs(jobNames)
    .then((results) => {
      console.log('Jobs complete', results);
    })
    .catch((error) => {
      console.error('Job runner failed', error);
      process.exit(1);
    });
}

module.exports = { runJobs };
