const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const pino = require('pino');
const pinoHttp = require('pino-http');
const connectPgSimple = require('connect-pg-simple');

const { env } = require('./config/env');
const { getPool } = require('./db/pool');
const { apiRouter } = require('./routes/api');
const { webRouter } = require('./routes/web');
const { errorHandler } = require('./middlewares/errorHandler');

function shouldIgnoreAccessLog(req) {
  const url = String(req.url || '');
  if (url.startsWith('/assets/')) return true;
  if (url === '/favicon.svg' || url === '/favicon.ico') return true;
  return false;
}

function buildLogger() {
  const isProd = env.nodeEnv === 'production';
  const opts = {
    level: isProd ? 'info' : 'debug',
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  };

  if (isProd) return pino(opts);

  try {
    require.resolve('pino-pretty');
    return pino({
      ...opts,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: true,
          ignore: 'pid,hostname',
        },
      },
    });
  } catch {
    return pino(opts);
  }
}

function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  const logger = buildLogger();

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: shouldIgnoreAccessLog,
      },
      customLogLevel: (req, res, err) => {
        if (shouldIgnoreAccessLog(req)) return 'silent';
        if (res.statusCode === 304) return 'silent';
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req() {
          return undefined;
        },
        res() {
          return undefined;
        },
      },
      customSuccessObject: (req, res) => ({
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTimeMs: res.responseTime,
      }),
      customErrorObject: (req, res, err) => ({
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTimeMs: res.responseTime,
        err: err
          ? {
              type: err.name,
              message: err.message,
            }
          : undefined,
      }),
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${res.responseTime}ms`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${res.responseTime}ms${
          err?.message ? ` (${err.message})` : ''
        }`,
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
