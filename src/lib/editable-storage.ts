import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { DEFAULT_MAX_EDITABLE_FILE_BYTES } from "@/lib/editable-files";
import {
  getS3Client,
  getStorageBucketName,
  normalizeEtag,
} from "@/lib/s3-client";

export class EditableFileNotFoundError extends Error {
  constructor() {
    super("文件不存在");
    this.name = "EditableFileNotFoundError";
  }
}

export class EditableFileConflictError extends Error {
  constructor() {
    super("文件已经被其他页面修改");
    this.name = "EditableFileConflictError";
  }
}

export interface EditableObjectMetadata {
  etag: string;
  size: number;
  lastModified: string;
  contentType: string;
  versionId?: string;
}

export interface EditableObject extends EditableObjectMetadata {
  bytes: Uint8Array;
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

async function headEditableObject(key: string): Promise<HeadObjectCommandOutput> {
  try {
    return await getS3Client().send(
      new HeadObjectCommand({ Bucket: getStorageBucketName(), Key: key }),
    );
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new EditableFileNotFoundError();
    }
    throw error;
  }
}

export async function readEditableObject(
  key: string,
  maxBytes: number = DEFAULT_MAX_EDITABLE_FILE_BYTES,
): Promise<EditableObject> {
  const head = await headEditableObject(key);
  if ((head.ContentLength ?? 0) > maxBytes) {
    const error = new Error("文件超过可编辑大小限制");
    error.name = "EditableFileTooLargeError";
    throw error;
  }

  const result = await getS3Client().send(
    new GetObjectCommand({ Bucket: getStorageBucketName(), Key: key }),
  );
  if (!result.Body) {
    throw new EditableFileNotFoundError();
  }
  const bytes = await result.Body.transformToByteArray();
  if (bytes.byteLength > maxBytes) {
    const error = new Error("文件超过可编辑大小限制");
    error.name = "EditableFileTooLargeError";
    throw error;
  }

  return {
    bytes,
    etag: normalizeEtag(result.ETag ?? head.ETag),
    size: bytes.byteLength,
    lastModified: (result.LastModified ?? head.LastModified)?.toISOString() ?? "",
    contentType:
      result.ContentType ?? head.ContentType ?? "text/plain; charset=utf-8",
    versionId: result.VersionId ?? head.VersionId,
  };
}
export async function writeEditableObject(options: {
  key: string;
  bytes: Uint8Array;
  baseEtag: string;
  maxBytes?: number;
}): Promise<EditableObjectMetadata> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_EDITABLE_FILE_BYTES;
  if (options.bytes.byteLength > maxBytes) {
    const error = new Error("文件超过可编辑大小限制");
    error.name = "EditableFileTooLargeError";
    throw error;
  }

  const current = await headEditableObject(options.key);
  if (
    !options.baseEtag ||
    normalizeEtag(current.ETag) !== normalizeEtag(options.baseEtag)
  ) {
    throw new EditableFileConflictError();
  }

  const result = await getS3Client().send(
    new PutObjectCommand({
      Bucket: getStorageBucketName(),
      Key: options.key,
      Body: options.bytes,
      ContentType: current.ContentType ?? "text/plain; charset=utf-8",
      CacheControl: current.CacheControl,
      ContentDisposition: current.ContentDisposition,
      Metadata: current.Metadata,
    }),
  );

  return {
    etag: normalizeEtag(result.ETag),
    size: options.bytes.byteLength,
    lastModified: new Date().toISOString(),
    contentType: current.ContentType ?? "text/plain; charset=utf-8",
    versionId: result.VersionId,
  };
}

