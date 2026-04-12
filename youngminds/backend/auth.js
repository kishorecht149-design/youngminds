const crypto = require("crypto");

const DEFAULT_TTL_SECONDS = 60 * 60 * 12;

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getSecret() {
  return process.env.AUTH_SECRET || "youngminds-dev-secret-change-me";
}

function sign(payload, secret = getSecret()) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createAuthToken(payload, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = options.ttlSeconds || DEFAULT_TTL_SECONDS;
  const body = {
    ...payload,
    iat: now,
    exp: now + ttl
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signature = sign(encodedPayload, options.secret || getSecret());
  return `${encodedPayload}.${signature}`;
}

function verifyAuthToken(token, options = {}) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload, options.secret || getSecret());
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  createAuthToken,
  verifyAuthToken
};
