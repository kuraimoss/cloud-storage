const { HttpError } = require('../utils/httpError');
const { env } = require('../config/env');

function buildErrorUi(req, statusCode, message) {
  const path = String(req.path || '');
  const isShare = path.startsWith('/f/') || path.startsWith('/s/');
  const isLoggedIn = Boolean(req.session?.userId);

  let heading = statusCode >= 500 ? 'Terjadi kesalahan' : 'Tidak bisa membuka halaman';
  let subtitle = message || 'Terjadi error.';
  let icon = statusCode >= 500 ? 'shield' : 'lock';

  if (isShare) {
    heading = 'Link tidak dapat diakses';
    icon = statusCode === 404 ? 'search' : 'lock';

    const m = String(message || '').toLowerCase();
    if (statusCode === 404) subtitle = 'Link tidak ditemukan atau sudah tidak valid.';
    else if (statusCode === 403 && m.includes('revoked')) subtitle = 'Link ini sudah dibuat private oleh pemilik.';
    else if (statusCode === 403 && m.includes('expired')) subtitle = 'Link ini sudah kedaluwarsa.';
    else if (statusCode === 403) subtitle = 'Akses ditolak.';
  } else if (statusCode === 404) {
    icon = 'search';
    subtitle = 'Halaman tidak ditemukan.';
  } else if (statusCode === 403) {
    icon = 'lock';
    subtitle = 'Akses ditolak.';
  }

  const actions = [];
  if (isLoggedIn) actions.push({ label: 'My Files', href: '/files', primary: true });
  else actions.push({ label: 'Login', href: '/login', primary: true });
  actions.push({ label: 'Beranda', href: '/', primary: false });

  return { heading, subtitle, icon, actions };
}

function errorHandler(err, req, res, _next) {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  let message = statusCode >= 500 ? 'Internal server error' : err.message;

  if (env.nodeEnv !== 'production') {
    if (err?.code === '42703') {
      message = 'Database schema belum ter-update. Jalankan: npm run db:migrate';
    }
  }

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[${new Date().toISOString()}] ${err?.code || 'ERR'} ${err?.message || 'Internal error'}`);
    if (env.nodeEnv !== 'production' && process.env.DEBUG_STACK === '1') {
      // eslint-disable-next-line no-console
      console.error(err?.stack || err);
    }
  }

  const wantsHtml = Boolean(req.accepts(['html', 'json', 'text']) === 'html');
  const isApi = req.path.startsWith('/api');

  if (wantsHtml && !isApi) {
    if (statusCode === 401) return res.redirect('/login');
    const ui = buildErrorUi(req, statusCode, err?.message || message);
    return res.status(statusCode).render('pages/error', {
      title: `Error ${statusCode}`,
      statusCode,
      heading: ui.heading,
      subtitle: ui.subtitle,
      icon: ui.icon,
      actions: ui.actions,
      details: null,
      bodyClass: 'public',
    });
  }

  const wantsJson = Boolean(req.accepts(['json', 'text']) === 'json');
  if (wantsJson || isApi) return res.status(statusCode).json({ error: message });
  return res.status(statusCode).type('text').send(message);
}

module.exports = { errorHandler };
