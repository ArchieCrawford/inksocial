const { syncPriceHistory } = require('./syncMarketData');

if (require.main === module) {
  syncPriceHistory()
    .then((result) => {
      console.log('OHLCV sync complete', result);
    })
    .catch((error) => {
      console.error('OHLCV sync failed', error);
      process.exit(1);
    });
}

module.exports = { syncPriceHistory };
