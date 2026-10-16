import { S3Storage } from "coze-coding-dev-sdk";

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

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
  return name.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, "_");
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
  const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const fileName = `uploads/${uuid}_${sanitized}`;

  const key = await storage.uploadFile({
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
  const result = await storage.listFiles({ prefix: "uploads/", maxKeys: 100 });

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
  return storage.generatePresignedUrl({ key, expireTime });
}

/**
 * Delete a file from storage
 */
export async function deleteFileFromStorage(key: string): Promise<boolean> {
  return storage.deleteFile({ fileKey: key });
}
