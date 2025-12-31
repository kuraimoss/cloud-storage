const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const connectPgSimple = require('connect-pg-simple');

const { env } = require('./config/env');
const { getPool } = require('./db/pool');
const { apiRouter } = require('./routes/api');
const { webRouter } = require('./routes/web');
const { errorHandler } = require('./middlewares/errorHandler');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));

  const PgSessionStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgSessionStore({
        pool: getPool(),
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: env.sessionSecret || 'dev-only-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.nodeEnv === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 14,
      },
    }),
  );

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'web', 'views'));

  app.get('/favicon.ico', (_req, res) => res.redirect(302, '/favicon.svg'));
  app.get('/favicon.svg', (_req, res) =>
    res.sendFile(path.join(__dirname, '..', 'public', 'favicon.svg')),
  );

  app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));

  app.use('/api', apiRouter);
  app.use('/', webRouter);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
