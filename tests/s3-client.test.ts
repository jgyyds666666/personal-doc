import assert from "node:assert/strict";
import test from "node:test";
import { readStorageConfig } from "../src/lib/s3-client";

test("Coze proxy variables select the Coze-managed storage client", () => {
  const config = readStorageConfig({
    COZE_BUCKET_ENDPOINT_URL:
      "https://integration.coze.cn/coze-coding-s3proxy/v1",
    COZE_BUCKET_NAME: "bucket_test",
  });

  assert.equal(config.provider, "coze");
  assert.equal(config.bucketName, "bucket_test");
  assert.equal(
    config.endpoint,
    "https://integration.coze.cn/coze-coding-s3proxy/v1",
  );
  assert.equal(config.accessKeyId, undefined);
});

test("explicit S3 credentials select the native S3 client", () => {
  const config = readStorageConfig({
    COZE_BUCKET_ENDPOINT_URL:
      "https://integration.coze.cn/coze-coding-s3proxy/v1",
    COZE_BUCKET_NAME: "bucket_coze",
    S3_ENDPOINT_URL: "https://storage.example.com",
    S3_BUCKET_NAME: "bucket_external",
    S3_ACCESS_KEY_ID: "access-key",
    S3_SECRET_ACCESS_KEY: "secret-key",
    S3_FORCE_PATH_STYLE: "true",
  });

  assert.equal(config.provider, "s3");
  assert.equal(config.bucketName, "bucket_external");
  assert.equal(config.endpoint, "https://storage.example.com");
  assert.equal(config.forcePathStyle, true);
});

test("an explicit S3 endpoint keeps the native default credential chain", () => {
  const config = readStorageConfig({
    S3_ENDPOINT_URL: "https://storage.example.com",
    S3_BUCKET_NAME: "bucket_external",
  });

  assert.equal(config.provider, "s3");
  assert.equal(config.accessKeyId, undefined);
});

test("partial explicit S3 credentials fail closed", () => {
  assert.throws(
    () =>
      readStorageConfig({
        S3_BUCKET_NAME: "bucket_external",
        S3_ACCESS_KEY_ID: "access-key",
      }),
    /必须同时配置/,
  );
});
