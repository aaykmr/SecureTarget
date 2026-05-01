import test from "node:test";
import assert from "node:assert/strict";
import { hashToken } from "../src/services/attribution.js";

test("hashToken is deterministic for same token and salt", () => {
  const first = hashToken("session-123", "company-salt");
  const second = hashToken("session-123", "company-salt");
  assert.equal(first, second);
});

test("hashToken changes when salt changes", () => {
  const first = hashToken("session-123", "company-salt-a");
  const second = hashToken("session-123", "company-salt-b");
  assert.notEqual(first, second);
});
