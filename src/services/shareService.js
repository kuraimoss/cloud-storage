const crypto = require('crypto');

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function signShareId(shareId, secret) {
  const sig = crypto
    .createHmac('sha256', secret)
    .update(String(shareId), 'utf8')
    .digest('base64url');
  return `${shareId}.${sig}`;
}

function generateShareCode(length = 6) {
  const targetLen = Math.max(4, Math.min(16, Number(length) || 6));
  let out = '';

  while (out.length < targetLen) {
    const buf = crypto.randomBytes(32);
    for (const b of buf) {
      if (out.length >= targetLen) break;
      const max = 62 * 4; // 248 (reduce modulo bias)
      if (b >= max) continue;
      out += BASE62_ALPHABET[b % 62];
    }
  }

  return out;
}

function verifyShareToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [shareId, sig] = parts;
  if (!shareId || !sig) return null;
  const expected = signShareId(shareId, secret).split('.')[1];
  try {
    const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    return ok ? shareId : null;
  } catch {
    return null;
  }
}

module.exports = {
  generateShareCode,
  signShareId,
  verifyShareToken,
};
