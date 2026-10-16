import { S3Storage } from "coze-coding-dev-sdk";

let storage: S3Storage | undefined;

function getStorage(): S3Storage {
  if (!storage) {
    storage = new S3Storage({
      endpointUrl:
        process.env.S3_ENDPOINT_URL ?? process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: process.env.S3_ACCESS_KEY_ID ?? "",
      secretKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      bucketName: process.env.S3_BUCKET_NAME ?? process.env.COZE_BUCKET_NAME,
      region: process.env.S3_REGION ?? "cn-beijing",
    });
  }
  return storage;
}

export interface FileInfo {
  key: string;
  originalName: string;
  size: number;
  uploadTime: string;
}

/**
 * Sanitize filename: replace disallowed chars with underscore
 */
function sanitizeFileName(name: string): string {
  const sanitized = name
    .replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, "_")
    .slice(0, 180);
  return sanitized && !/^\.+$/.test(sanitized) ? sanitized : "file";
}

export function isAllowedStorageKey(key: string): boolean {
  return (
    key.length <= 512 &&
    /^uploads\/[^/\\\u0000-\u001f]+$/.test(key)
  );
}

/**
 * Parse file key to extract original name
 * Key format: uploads/{uuid}_{originalName}
 */
function parseOriginalName(key: string): string {
  const fileName = key.split("/").pop() || "";
  const uuidEnd = fileName.indexOf("_");
  if (uuidEnd === -1) return fileName;
  return fileName.slice(uuidEnd + 1);
}

/**
 * Upload a file to object storage
 */
export async function uploadFileToStorage(
  fileContent: Buffer,
  originalName: string,
  contentType: string
): Promise<{ key: string; originalName: string }> {
  const sanitized = sanitizeFileName(originalName);
  const uuid = crypto.randomUUID();
  const fileName = `uploads/${uuid}_${sanitized}`;

  const key = await getStorage().uploadFile({
    fileContent,
    fileName,
    contentType,
  });

  return { key, originalName };
}

/**
 * List all uploaded files
 */
export async function listFilesFromStorage(): Promise<FileInfo[]> {
  const result = await getStorage().listFiles({
    prefix: "uploads/",
    maxKeys: 100,
  });

  const files: FileInfo[] = result.keys.map((k: string) => ({
    key: k,
    originalName: parseOriginalName(k),
    size: 0,
    uploadTime: new Date().toISOString(),
  }));

  return files;
}

/**
 * Generate a presigned URL for downloading a file
 */
export async function getDownloadUrl(
  key: string,
  expireTime: number = 3600
): Promise<string> {
  return getStorage().generatePresignedUrl({ key, expireTime });
}

/**
 * Delete a file from storage
 */
export async function deleteFileFromStorage(key: string): Promise<boolean> {
  return getStorage().deleteFile({ fileKey: key });
}
