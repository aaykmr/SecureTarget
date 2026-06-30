import test from "node:test";
import assert from "node:assert/strict";
import { createDb } from "../src/db/client.js";
import { createDeviceDb } from "../src/db/deviceClient.js";
import { insertPendingClick, extractClickIdFromReferrer } from "../src/routes/clickRedirect.js";
import { persistBootstrapSnapshot } from "../src/services/deviceIdentity.js";
import { resolveInstallAttribution } from "../src/services/installAttribution.js";
import { createTrackingLink } from "../src/services/trackingLinks.js";
import type { InstallEvent } from "../../packages/contracts/src/events.js";

test("extractClickIdFromReferrer parses Play referrer", () => {
  const ref = "st_click_id=550e8400-e29b-41d4-a716-446655440000&pid=meta";
  assert.equal(extractClickIdFromReferrer(ref), "550e8400-e29b-41d4-a716-446655440000");
});

test("install attribution matches click_id from pending click", () => {
  const customerDb = createDb(":memory:");
  const deviceDb = createDeviceDb(":memory:");
  const companyId = "cmp-test-1";
  const sessionId = "sess_test_1";
  const clickId = "550e8400-e29b-41d4-a716-446655440000";

  createTrackingLink(customerDb, {
    companyId,
    name: "Test",
    slug: "test",
    destinationType: "web",
    webUrl: "https://example.com"
  });

  insertPendingClick(deviceDb, {
    companyId,
    params: { mediaSource: "facebook", campaignId: "summer", clickId },
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    ip: "203.0.113.1",
    userAgent: "TestAgent/1.0"
  });

  persistBootstrapSnapshot(deviceDb, {
    companyId,
    sessionId,
    device: { platform: "android", advertisingId: "gaid-test" },
    occurredAt: new Date().toISOString(),
    ip: "203.0.113.1",
    userAgent: "TestAgent/1.0"
  });

  const installEvent: InstallEvent = {
    actionType: "install",
    eventId: "evt-install-1",
    companyId,
    occurredAt: new Date().toISOString(),
    token: sessionId,
    clickId
  };

  const result = resolveInstallAttribution(customerDb, deviceDb, installEvent, sessionId);
  assert.equal(result.attributed, true);
  assert.equal(result.isOrganic, false);
  assert.equal(result.mediaSource, "facebook");
  assert.equal(result.campaignId, "summer");
  assert.equal(result.confidence, 1.0);

  const clickRow = customerDb.prepare(`SELECT COUNT(*) AS c FROM click_events`).get() as { c: number };
  assert.equal(clickRow.c, 1);
  const attrRow = customerDb.prepare(`SELECT COUNT(*) AS c FROM attribution_events`).get() as { c: number };
  assert.equal(attrRow.c, 1);
});

test("install attribution returns organic when no match", () => {
  const customerDb = createDb(":memory:");
  const deviceDb = createDeviceDb(":memory:");
  const companyId = "cmp-test-2";
  const sessionId = "sess_test_2";

  persistBootstrapSnapshot(deviceDb, {
    companyId,
    sessionId,
    device: { platform: "web" },
    occurredAt: new Date().toISOString()
  });

  const installEvent: InstallEvent = {
    actionType: "install",
    eventId: "evt-install-2",
    companyId,
    occurredAt: new Date().toISOString(),
    token: sessionId
  };

  const result = resolveInstallAttribution(customerDb, deviceDb, installEvent, sessionId);
  assert.equal(result.attributed, false);
  assert.equal(result.isOrganic, true);
});
