import { S3Storage } from "coze-coding-dev-sdk";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { detectEditableFile } from "@/lib/editable-files";
import {
  getS3Client,
  getStorageBucketName,
  normalizeEtag,
} from "@/lib/s3-client";

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
  etag: string;
  editable: boolean;
  editableReason?: "unsupported-format" | "file-too-large";
  language: string | null;
}

export interface FileListResult {
  files: FileInfo[];
  nextCursor?: string;
  isTruncated: boolean;
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
  return key.length <= 512 && /^uploads\/[^/\\\u0000-\u001f]+$/.test(key);
}

/**
 * Parse file key to extract original name
 * Key format: uploads/{uuid}_{originalName}
 */
export function parseOriginalName(key: string): string {
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
export async function listFilesFromStorage(options: {
  cursor?: string;
  maxKeys?: number;
} = {}): Promise<FileListResult> {
  const maxKeys = Math.min(Math.max(options.maxKeys ?? 50, 1), 100);
  const result = await getS3Client().send(
    new ListObjectsV2Command({
      Bucket: getStorageBucketName(),
      Prefix: "uploads/",
      MaxKeys: maxKeys,
      ContinuationToken: options.cursor,
    }),
  );

  const files: FileInfo[] = [];
  for (const item of result.Contents ?? []) {
    const key = item.Key;
    if (!key || !isAllowedStorageKey(key)) {
      continue;
    }
    const originalName = parseOriginalName(key);
    const size = item.Size ?? 0;
    const detection = detectEditableFile(originalName, size);
    files.push({
      key,
      originalName,
      size,
      uploadTime: item.LastModified?.toISOString() ?? "",
      etag: normalizeEtag(item.ETag),
      editable: detection.editable,
      editableReason: detection.reason,
      language: detection.language,
    });
  }

  return {
    files,
    nextCursor: result.NextContinuationToken,
    isTruncated: result.IsTruncated ?? false,
  };
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
