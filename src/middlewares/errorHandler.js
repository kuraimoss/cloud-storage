const { HttpError } = require('../utils/httpError');

function errorHandler(err, req, res, _next) {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const message = statusCode >= 500 ? 'Internal server error' : err.message;

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  const wantsHtml = Boolean(req.accepts(['html', 'json']) === 'html');
  const isApi = req.path.startsWith('/api');

  if (wantsHtml && !isApi) {
    if (statusCode === 401) return res.redirect('/login');
    return res.status(statusCode).send(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Error</title></head><body><h1>${statusCode}</h1><p>${message}</p></body></html>`,
    );
  }

  return res.status(statusCode).json({ error: message });
}

module.exports = { errorHandler };
