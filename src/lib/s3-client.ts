import { S3Storage } from "coze-coding-dev-sdk";
import { S3Client } from "@aws-sdk/client-s3";

export type StorageProvider = "coze" | "s3";
type StorageEnvironment = Readonly<Record<string, string | undefined>>;

export interface StorageConfig {
  provider: StorageProvider;
  bucketName: string;
  endpoint?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  forcePathStyle: boolean;
}

let client: S3Client | undefined;
let storage: S3Storage | undefined;

function getNonEmptyEnvironmentValue(
  environment: StorageEnvironment,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = environment[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function readStorageConfig(
  environment: StorageEnvironment = process.env,
): StorageConfig {
  const bucketName = getNonEmptyEnvironmentValue(
    environment,
    "S3_BUCKET_NAME",
    "COZE_BUCKET_NAME",
  );
  if (!bucketName) {
    throw new Error("缺少 S3_BUCKET_NAME 或 COZE_BUCKET_NAME");
  }

  const accessKeyId = getNonEmptyEnvironmentValue(
    environment,
    "S3_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
  );
  const secretAccessKey = getNonEmptyEnvironmentValue(
    environment,
    "S3_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
  );
  if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
    throw new Error("S3_ACCESS_KEY_ID 与 S3_SECRET_ACCESS_KEY 必须同时配置");
  }

  const explicitS3Endpoint = getNonEmptyEnvironmentValue(
    environment,
    "S3_ENDPOINT_URL",
  );
  const cozeEndpoint = getNonEmptyEnvironmentValue(
    environment,
    "COZE_BUCKET_ENDPOINT_URL",
  );
  const provider: StorageProvider =
    !accessKeyId && !secretAccessKey && !explicitS3Endpoint && cozeEndpoint
      ? "coze"
      : "s3";

  return {
    provider,
    bucketName,
    endpoint: explicitS3Endpoint ?? cozeEndpoint,
    region:
      getNonEmptyEnvironmentValue(environment, "S3_REGION") ?? "cn-beijing",
    accessKeyId,
    secretAccessKey,
    sessionToken: getNonEmptyEnvironmentValue(
      environment,
      "S3_SESSION_TOKEN",
      "AWS_SESSION_TOKEN",
    ),
    forcePathStyle: environment.S3_FORCE_PATH_STYLE === "true",
  };
}

export function getS3Storage(): S3Storage {
  if (!storage) {
    const config = readStorageConfig();
    storage = new S3Storage({
      endpointUrl: config.endpoint,
      accessKey: config.accessKeyId ?? "",
      secretKey: config.secretAccessKey ?? "",
      bucketName: config.bucketName,
      region: config.region,
    });
  }
  return storage;
}

function getCozeManagedS3Client(): S3Client {
  const cozeStorage = getS3Storage();
  const internalStorage = cozeStorage as unknown as {
    getClient?: () => unknown;
  };
  if (typeof internalStorage.getClient !== "function") {
    throw new Error(
      "当前 coze-coding-dev-sdk 不支持对象元数据访问，请检查 SDK 版本",
    );
  }

  // S3Storage uses this client to add the Coze proxy headers and non-empty
  // placeholder credentials. Keeping the bridge here prevents other modules
  // from accidentally creating an incompatible credential-less S3Client.
  return internalStorage.getClient.call(cozeStorage) as S3Client;
}

export function getS3Client(): S3Client {
  if (!client) {
    const config = readStorageConfig();
    if (config.provider === "coze") {
      client = getCozeManagedS3Client();
    } else {
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
  }
  return client;
}

export function getStorageBucketName(): string {
  return readStorageConfig().bucketName;
}

export function normalizeEtag(etag: string | undefined): string {
  return etag?.replace(/^"|"$/g, "") ?? "";
}
