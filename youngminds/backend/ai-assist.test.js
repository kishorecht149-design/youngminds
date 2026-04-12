const test = require("node:test");
const assert = require("node:assert/strict");
const { buildLocalAssistReply, normalizeMessage, getPasswordCoachReply } = require("./ai-assist");

test("normalizeMessage lowercases and strips punctuation", () => {
  assert.equal(normalizeMessage("Hello, PAYOUTS!!!"), "hello payouts");
});

test("landing local assist covers pricing intent", () => {
  const r = buildLocalAssistReply("landing", "How much for web development and content?", {});
  assert.match(r, /₹|web|content|price/i);
});

test("member local assist covers payouts and requests", () => {
  const r = buildLocalAssistReply(
    "member",
    "payouts pending and new requests",
    { pendingRequests: 2, payoutPending: 1500 }
  );
  assert.match(r, /payout|request/i);
});

test("admin local assist covers pipeline", () => {
  const r = buildLocalAssistReply("admin", "project pipeline assigning payments", { appsNew: 1, projectsNew: 2, resetPending: 0 });
  assert.match(r, /project|payment|assign/i);
});

test("password coach returns local guidance when no API key", async () => {
  const r = await getPasswordCoachReply("");
  assert.match(r, /YoungMinds|password/i);
});
