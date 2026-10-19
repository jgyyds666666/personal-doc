import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthenticatedMutation,
  requireAuthentication,
} from "@/lib/api-security";
import {
  EditableFileConflictError,
  EditableFileNotFoundError,
  readEditableObject,
  writeEditableObject,
} from "@/lib/editable-storage";
import {
  DEFAULT_MAX_EDITABLE_FILE_BYTES,
  detectEditableFile,
} from "@/lib/editable-files";
import { isAllowedStorageKey, parseOriginalName } from "@/lib/storage";
import {
  decodeTextFile,
  encodeTextFile,
  UnsupportedTextFileError,
  type LineEnding,
} from "@/lib/text-file";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = DEFAULT_MAX_EDITABLE_FILE_BYTES * 3;

function noStoreJson(
  body: object,
  status: number = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isLineEnding(value: unknown): value is LineEnding {
  return (
    value === "lf" ||
    value === "crlf" ||
    value === "mixed" ||
    value === "none"
  );
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof EditableFileNotFoundError) {
    return noStoreJson({ error: "文件不存在" }, 404);
  }
  if (error instanceof EditableFileConflictError) {
    return noStoreJson(
      { error: "文件已经被其他页面修改，请重新加载或另存为新文件" },
      409,
    );
  }
  if (error instanceof UnsupportedTextFileError) {
    return noStoreJson({ error: error.message }, 415);
  }
  if (
    error instanceof Error &&
    error.name === "EditableFileTooLargeError"
  ) {
    return noStoreJson({ error: "文件超过 2 MiB 编辑限制" }, 413);
  }
  console.error("Editable file error:", error);
  return noStoreJson({ error: "文件处理失败" }, 500);
}

export async function GET(request: NextRequest) {
  const authenticationError = await requireAuthentication();
  if (authenticationError) {
    return authenticationError;
  }

  const key = request.nextUrl.searchParams.get("key");
  if (!key || !isAllowedStorageKey(key)) {
    return noStoreJson({ error: "文件 key 不合法" }, 400);
  }

  const originalName = parseOriginalName(key);
  const preliminaryDetection = detectEditableFile(originalName, 0);
  if (preliminaryDetection.kind === "unsupported") {
    return noStoreJson({ error: "该文件格式不支持在线编辑" }, 415);
  }

  try {
    const object = await readEditableObject(key);
    const detection = detectEditableFile(originalName, object.size);
    if (!detection.editable) {
      return noStoreJson(
        {
          error:
            detection.reason === "file-too-large"
              ? "文件超过 2 MiB 编辑限制"
              : "该文件格式不支持在线编辑",
        },
        detection.reason === "file-too-large" ? 413 : 415,
      );
    }
    const decoded = decodeTextFile(object.bytes);

    return noStoreJson({
      success: true,
      data: {
        key,
        originalName,
        content: decoded.content,
        kind: detection.kind,
        language: detection.language,
        encoding: decoded.encoding,
        hasBom: decoded.hasBom,
        lineEnding: decoded.lineEnding,
        hasFinalNewline: decoded.hasFinalNewline,
        size: object.size,
        etag: object.etag,
        lastModified: object.lastModified,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: NextRequest) {
  const securityError = await requireAuthenticatedMutation(request);
  if (securityError) {
    return securityError;
  }

  const contentLength = Number.parseInt(
    request.headers.get("content-length") ?? "0",
    10,
  );
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return noStoreJson({ error: "请求体过大" }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "请求格式不正确" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return noStoreJson({ error: "请求格式不正确" }, 400);
  }

  const record = body as Record<string, unknown>;
  const key = typeof record.key === "string" ? record.key : "";
  const content = typeof record.content === "string" ? record.content : null;
  const baseEtag =
    typeof record.baseEtag === "string" ? record.baseEtag.trim() : "";
  const hasBom = record.hasBom;
  const lineEnding = record.lineEnding;
  const encoding = record.encoding;

  if (
    !key ||
    !isAllowedStorageKey(key) ||
    content === null ||
    !baseEtag ||
    baseEtag.length > 256 ||
    encoding !== "utf-8" ||
    typeof hasBom !== "boolean" ||
    !isLineEnding(lineEnding)
  ) {
    return noStoreJson({ error: "保存参数不正确" }, 400);
  }
  if (content.length > DEFAULT_MAX_EDITABLE_FILE_BYTES) {
    return noStoreJson({ error: "文件超过 2 MiB 编辑限制" }, 413);
  }

  const originalName = parseOriginalName(key);
  const detection = detectEditableFile(originalName, 0);
  if (detection.kind === "unsupported") {
    return noStoreJson({ error: "该文件格式不支持在线编辑" }, 415);
  }

  const encoded = encodeTextFile(content, { hasBom, lineEnding });
  if (encoded.byteLength > DEFAULT_MAX_EDITABLE_FILE_BYTES) {
    return noStoreJson({ error: "文件超过 2 MiB 编辑限制" }, 413);
  }

  try {
    const saved = await writeEditableObject({
      key,
      bytes: encoded,
      baseEtag,
    });
    return noStoreJson({
      success: true,
      data: {
        etag: saved.etag,
        size: saved.size,
        lastModified: saved.lastModified,
        versionId: saved.versionId,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

