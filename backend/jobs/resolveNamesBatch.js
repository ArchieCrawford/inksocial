const { syncNames } = require('./syncNames');

if (require.main === module) {
  syncNames()
    .then((result) => {
      console.log('Name resolution batch complete', result);
    })
    .catch((error) => {
      console.error('Name resolution batch failed', error);
      process.exit(1);
    });
}

module.exports = { syncNames };
