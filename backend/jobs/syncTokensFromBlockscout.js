const { syncTokens } = require('./syncTokens');

if (require.main === module) {
  syncTokens()
    .then((result) => {
      console.log('Token sync complete', result);
    })
    .catch((error) => {
      console.error('Token sync failed', error);
      process.exit(1);
    });
}

module.exports = { syncTokens };
