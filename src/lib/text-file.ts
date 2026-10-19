import { DEFAULT_MAX_EDITABLE_FILE_BYTES } from "@/lib/editable-files";

export type LineEnding = "lf" | "crlf" | "mixed" | "none";

export interface DecodedTextFile {
  content: string;
  encoding: "utf-8";
  hasBom: boolean;
  lineEnding: LineEnding;
  hasFinalNewline: boolean;
}

export class UnsupportedTextFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedTextFileError";
  }
}

export class EditableFileTooLargeError extends Error {
  constructor() {
    super("文件超过可编辑大小限制");
    this.name = "EditableFileTooLargeError";
  }
}

function detectLineEnding(content: string): LineEnding {
  const crlfCount = content.match(/\r\n/g)?.length ?? 0;
  const lfCount = content.match(/(?<!\r)\n/g)?.length ?? 0;
  const crCount = content.match(/\r(?!\n)/g)?.length ?? 0;

  if (crlfCount === 0 && lfCount === 0 && crCount === 0) {
    return "none";
  }
  if (crlfCount > 0 && lfCount === 0 && crCount === 0) {
    return "crlf";
  }
  if (crlfCount === 0 && crCount === 0) {
    return "lf";
  }
  return "mixed";
}

export function decodeTextFile(
  input: Uint8Array,
  maxBytes: number = DEFAULT_MAX_EDITABLE_FILE_BYTES,
): DecodedTextFile {
  if (input.byteLength > maxBytes) {
    throw new EditableFileTooLargeError();
  }
  if (input.includes(0)) {
    throw new UnsupportedTextFileError("检测到二进制内容");
  }

  const hasBom =
    input.byteLength >= 3 &&
    input[0] === 0xef &&
    input[1] === 0xbb &&
    input[2] === 0xbf;
  const contentBytes = hasBom ? input.subarray(3) : input;

  let originalContent: string;
  try {
    originalContent = new TextDecoder("utf-8", { fatal: true }).decode(
      contentBytes,
    );
  } catch {
    throw new UnsupportedTextFileError("第一版仅支持 UTF-8 文本");
  }

  const lineEnding = detectLineEnding(originalContent);
  const hasFinalNewline = /(?:\r\n|\r|\n)$/.test(originalContent);
  const content = originalContent.replace(/\r\n?/g, "\n");

  return {
    content,
    encoding: "utf-8",
    hasBom,
    lineEnding,
    hasFinalNewline,
  };
}

export function encodeTextFile(
  content: string,
  options: { hasBom: boolean; lineEnding: LineEnding },
): Uint8Array {
  const normalized = content.replace(/\r\n?/g, "\n");
  const withLineEndings =
    options.lineEnding === "crlf"
      ? normalized.replace(/\n/g, "\r\n")
      : normalized;
  const encoded = new TextEncoder().encode(withLineEndings);

  if (!options.hasBom) {
    return encoded;
  }

  const result = new Uint8Array(encoded.byteLength + 3);
  result.set([0xef, 0xbb, 0xbf], 0);
  result.set(encoded, 3);
  return result;
}
