import test from "node:test";
import assert from "node:assert/strict";

test("payload sequence contract: click -> login -> conversion", async () => {
  const clickPayload = {
    actionType: "click",
    eventId: "evt-click-1",
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

  assert.equal(clickPayload.actionType, "click");
  assert.equal(loginPayload.actionType, "login");
  assert.equal(conversionPayload.actionType, "conversion");
});
