const test = require("node:test");
const assert = require("node:assert/strict");

const { createAuthToken, verifyAuthToken } = require("./auth");
const { normalizeEmail, normalizePhone } = require("./server");

test("createAuthToken and verifyAuthToken round-trip a valid payload", () => {
  const token = createAuthToken({ role: "admin", sub: "admin" }, { secret: "test-secret", ttlSeconds: 60 });
  const payload = verifyAuthToken(token, { secret: "test-secret" });

  assert.equal(payload.role, "admin");
  assert.equal(payload.sub, "admin");
  assert.ok(payload.exp > payload.iat);
});

test("verifyAuthToken rejects tampered tokens", () => {
  const token = createAuthToken({ role: "member", sub: "abc" }, { secret: "test-secret", ttlSeconds: 60 });
  const [body, signature] = token.split(".");
  const tampered = `${body}.x${signature.slice(1)}`;

  assert.equal(verifyAuthToken(tampered, { secret: "test-secret" }), null);
});

test("verifyAuthToken rejects expired tokens", () => {
  const token = createAuthToken({ role: "member", sub: "abc" }, { secret: "test-secret", ttlSeconds: -1 });
  assert.equal(verifyAuthToken(token, { secret: "test-secret" }), null);
});

test("normalizeEmail and normalizePhone enforce consistent login inputs", () => {
  assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
  assert.equal(normalizePhone("+91 98765-43210"), "919876543210");
});
