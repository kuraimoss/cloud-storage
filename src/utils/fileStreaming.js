const fs = require('fs');

const SAFE_FILENAME_RE = /[\r\n"]/g;

function buildContentDisposition(disposition, filename) {
  const safeFallback = String(filename || 'file').replaceAll(SAFE_FILENAME_RE, '_');
  const encoded = encodeURIComponent(String(filename || 'file'));
  return `${disposition}; filename="${safeFallback}"; filename*=UTF-8''${encoded}`;
}

function parseRangeHeader(rangeHeader, sizeBytes) {
  if (!rangeHeader || typeof rangeHeader !== 'string') return null;
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const startRaw = match[1];
  const endRaw = match[2];

  if (startRaw === '' && endRaw === '') return null;

  if (startRaw === '') {
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    const start = Math.max(0, sizeBytes - suffixLength);
    const end = sizeBytes - 1;
    return { start, end };
  }

  const start = Number(startRaw);
  const end = endRaw === '' ? sizeBytes - 1 : Number(endRaw);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < 0) return null;
  if (start > end) return null;
  if (start >= sizeBytes) return null;

  return { start, end: Math.min(end, sizeBytes - 1) };
}

async function streamFile(req, res, { filePath, mimeType, filename, disposition = 'inline' }) {
  const stat = await fs.promises.stat(filePath);
  const sizeBytes = stat.size;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', buildContentDisposition(disposition, filename));

  const range = parseRangeHeader(req.headers.range, sizeBytes);
  if (!range) {
    res.setHeader('Content-Length', sizeBytes);
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      stream.on('error', reject);
      res.on('finish', resolve);
      stream.pipe(res);
    });
  }

  res.status(206);
  res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${sizeBytes}`);
  res.setHeader('Content-Length', range.end - range.start + 1);

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
    stream.on('error', reject);
    res.on('finish', resolve);
    stream.pipe(res);
  });
}

async function streamFilePrefix(req, res, { filePath, filename, maxBytes, mimeType = 'text/plain; charset=utf-8' }) {
  const stat = await fs.promises.stat(filePath);
  const sizeBytes = stat.size;
  if (sizeBytes === 0) {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', buildContentDisposition('inline', filename));
    res.setHeader('Content-Length', 0);
    res.end();
    return;
  }

  const end = Math.max(0, Math.min(sizeBytes, Number(maxBytes || 0)) - 1);

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', buildContentDisposition('inline', filename));

  if (sizeBytes > end + 1) res.setHeader('X-Preview-Truncated', '1');

  res.setHeader('Content-Length', end + 1);
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { start: 0, end });
    stream.on('error', reject);
    res.on('finish', resolve);
    stream.pipe(res);
  });
}

module.exports = {
  buildContentDisposition,
  parseRangeHeader,
  streamFile,
  streamFilePrefix,
};
