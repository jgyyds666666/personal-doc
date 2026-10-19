import { S3Client } from "@aws-sdk/client-s3";

interface StorageConfig {
  bucketName: string;
  endpoint?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  forcePathStyle: boolean;
}

let client: S3Client | undefined;

function getNonEmptyEnvironmentValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function readStorageConfig(): StorageConfig {
  const bucketName = getNonEmptyEnvironmentValue(
    "S3_BUCKET_NAME",
    "COZE_BUCKET_NAME",
  );
  if (!bucketName) {
    throw new Error("缺少 S3_BUCKET_NAME 或 COZE_BUCKET_NAME");
  }

  const accessKeyId = getNonEmptyEnvironmentValue(
    "S3_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
  );
  const secretAccessKey = getNonEmptyEnvironmentValue(
    "S3_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
  );
  if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
    throw new Error("S3_ACCESS_KEY_ID 与 S3_SECRET_ACCESS_KEY 必须同时配置");
  }

  return {
    bucketName,
    endpoint: getNonEmptyEnvironmentValue(
      "S3_ENDPOINT_URL",
      "COZE_BUCKET_ENDPOINT_URL",
    ),
    region: getNonEmptyEnvironmentValue("S3_REGION") ?? "cn-beijing",
    accessKeyId,
    secretAccessKey,
    sessionToken: getNonEmptyEnvironmentValue(
      "S3_SESSION_TOKEN",
      "AWS_SESSION_TOKEN",
    ),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

export function getS3Client(): S3Client {
  if (!client) {
    const config = readStorageConfig();
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
              sessionToken: config.sessionToken,
            }
          : undefined,
    });
  }
  return client;
}

export function getStorageBucketName(): string {
  return readStorageConfig().bucketName;
}

export function normalizeEtag(etag: string | undefined): string {
  return etag?.replace(/^"|"$/g, "") ?? "";
}
