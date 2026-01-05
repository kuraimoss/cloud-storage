const crypto = require('crypto');

function base64urlEncode(buf) {
  return Buffer.from(buf).toString('base64url');
}

function base64urlDecode(str) {
  return Buffer.from(String(str), 'base64url');
}

function signPayload(payload, secret) {
  const data = base64urlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(data, 'utf8').digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  const expected = crypto.createHmac('sha256', secret).update(data, 'utf8').digest('base64url');
  try {
    const ok = crypto.timingSafeEqual(base64urlDecode(sig), base64urlDecode(expected));
    if (!ok) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(base64urlDecode(data).toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

module.exports = {
  signPayload,
  verifyToken,
};

