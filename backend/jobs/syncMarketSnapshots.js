const { syncMarketData } = require('./syncMarketData');

if (require.main === module) {
  syncMarketData()
    .then((result) => {
      console.log('Market snapshots sync complete', result);
    })
    .catch((error) => {
      console.error('Market snapshots sync failed', error);
      process.exit(1);
    });
}

module.exports = { syncMarketData };
