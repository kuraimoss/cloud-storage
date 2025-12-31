const crypto = require('crypto');

function signShareId(shareId, secret) {
  const sig = crypto
    .createHmac('sha256', secret)
    .update(String(shareId), 'utf8')
    .digest('base64url');
  return `${shareId}.${sig}`;
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
  signShareId,
  verifyShareToken,
};
