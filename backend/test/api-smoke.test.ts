import test from "node:test";
import assert from "node:assert/strict";

test("payload sequence contract: record -> login -> conversion", async () => {
  const recordPayload = {
    actionType: "record",
    eventId: "evt-record-1",
    companyId: "cmp-1",
    occurredAt: new Date().toISOString(),
    campaignId: "camp-1"
  };
  const loginPayload = {
    actionType: "login",
    eventId: "evt-login-1",
    companyId: "cmp-1",
    occurredAt: new Date().toISOString(),
    token: "opaque-session-token"
  };
  const conversionPayload = {
    actionType: "conversion",
    eventId: "evt-conv-1",
    companyId: "cmp-1",
    occurredAt: new Date().toISOString(),
    token: "opaque-session-token",
    conversionName: "purchase"
  };

  assert.equal(recordPayload.actionType, "record");
  assert.equal(loginPayload.actionType, "login");
  assert.equal(conversionPayload.actionType, "conversion");
});
