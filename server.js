const app = require('./bot');
require('dotenv').config();

(async () => {
  await app.start();
  console.log('⚡️ VisionBot Slack app is running (Socket Mode)');
})();