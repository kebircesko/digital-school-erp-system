import { test } from "node:test";
import assert from "node:assert/strict";
import password from "../apps/api/dist/auth/password.js";
test("password hashes are salted, validate correct passwords and reject incorrect passwords", () => {
  const hash = password.hashPassword("synthetic-password-only");
  assert.notEqual(hash, password.hashPassword("synthetic-password-only"));
  assert.equal(password.verifyPassword("synthetic-password-only", hash), true);
  assert.equal(password.verifyPassword("incorrect", hash), false);
  assert.equal(password.verifyPassword("anything", "invalid"), false);
  assert.equal(password.hashToken("token").length, 64);
});
