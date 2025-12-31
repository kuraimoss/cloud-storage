require('dotenv').config();

const { env } = require('./config/env');
const { createApp } = require('./app');

const app = createApp();

app.listen(env.port, env.host, () => {
  // eslint-disable-next-line no-console
  console.log(`Cloud Storage listening on http://${env.host}:${env.port}`);
});

