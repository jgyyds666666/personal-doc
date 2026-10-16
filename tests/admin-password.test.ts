import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareAdminPasswordHash,
  readAdminPasswordConfig,
} from "../src/lib/admin-password";
import { hashPassword, verifyPassword } from "../src/lib/auth-core";

test("plain mode reads one GUI password variable", () => {
  const config = readAdminPasswordConfig({
    ADMIN_PASSWORD: "simple-deploy-password",
    ADMIN_PASSWORD_MODE: "plain",
    ADMIN_PASSWORD_HASH: "",
  });

  assert.deepEqual(config, {
    mode: "plain",
    source: "ADMIN_PASSWORD",
    value: "simple-deploy-password",
  });
});

test("plain mode converts the configured password to a verifiable hash", async () => {
  const config = readAdminPasswordConfig({
    ADMIN_PASSWORD: "simple-deploy-password",
    ADMIN_PASSWORD_MODE: "plain",
  });
  const hash = await prepareAdminPasswordHash(config);

  assert.equal(await verifyPassword("simple-deploy-password", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("hash mode accepts the hash in ADMIN_PASSWORD", async () => {
  const hash = await hashPassword("simple-deploy-password");
  const config = readAdminPasswordConfig({
    ADMIN_PASSWORD: hash,
    ADMIN_PASSWORD_MODE: "hash",
  });

  assert.equal(await prepareAdminPasswordHash(config), hash);
});

test("legacy ADMIN_PASSWORD_HASH remains compatible", async () => {
  const hash = await hashPassword("legacy-password");
  const config = readAdminPasswordConfig({
    ADMIN_PASSWORD: "",
    ADMIN_PASSWORD_HASH: hash,
  });

  assert.equal(config.source, "ADMIN_PASSWORD_HASH");
  assert.equal(config.mode, "hash");
  assert.equal(await prepareAdminPasswordHash(config), hash);
});

test("invalid password mode and invalid hashes fail closed", async () => {
  assert.throws(
    () =>
      readAdminPasswordConfig({
        ADMIN_PASSWORD: "simple-deploy-password",
        ADMIN_PASSWORD_MODE: "automatic",
      }),
    /plain 或 hash/,
  );

  await assert.rejects(
    prepareAdminPasswordHash({
      mode: "hash",
      source: "ADMIN_PASSWORD",
      value: "not-a-hash",
    }),
    /不是有效的 scrypt 哈希/,
  );
});
