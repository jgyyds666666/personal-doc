import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from "../src/lib/auth-core";

test("password hashes verify only the original password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("session tokens reject tampering and expiration", () => {
  const secret = "a-secure-test-secret-that-is-longer-than-32-characters";
  const token = createSessionToken(secret, new Date("2030-01-01T00:00:00Z"));

  assert.equal(
    verifySessionToken(token, secret, new Date("2029-01-01T00:00:00Z")),
    true,
  );
  assert.equal(
    verifySessionToken(`${token}x`, secret, new Date("2029-01-01T00:00:00Z")),
    false,
  );
  assert.equal(
    verifySessionToken(token, secret, new Date("2031-01-01T00:00:00Z")),
    false,
  );
});
