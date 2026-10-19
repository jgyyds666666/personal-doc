import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeTextFile,
  EditableFileTooLargeError,
  encodeTextFile,
  UnsupportedTextFileError,
} from "../src/lib/text-file";

test("UTF-8 BOM and CRLF survive an edit round trip", () => {
  const original = Uint8Array.from([
    0xef,
    0xbb,
    0xbf,
    ...new TextEncoder().encode("第一行\r\nsecond line\r\n"),
  ]);
  const decoded = decodeTextFile(original);

  assert.equal(decoded.content, "第一行\nsecond line\n");
  assert.equal(decoded.hasBom, true);
  assert.equal(decoded.lineEnding, "crlf");
  assert.equal(decoded.hasFinalNewline, true);
  assert.deepEqual(
    encodeTextFile(decoded.content, decoded),
    original,
  );
});
test("line ending detection distinguishes LF, mixed, and no newline", () => {
  assert.equal(
    decodeTextFile(new TextEncoder().encode("a\nb\n")).lineEnding,
    "lf",
  );
  assert.equal(
    decodeTextFile(new TextEncoder().encode("a\r\nb\n")).lineEnding,
    "mixed",
  );
  assert.equal(
    decodeTextFile(new TextEncoder().encode("single line")).lineEnding,
    "none",
  );
});

test("binary, invalid UTF-8, and oversized content are rejected", () => {
  assert.throws(
    () => decodeTextFile(Uint8Array.from([65, 0, 66])),
    UnsupportedTextFileError,
  );
  assert.throws(
    () => decodeTextFile(Uint8Array.from([0xc3, 0x28])),
    UnsupportedTextFileError,
  );
  assert.throws(
    () => decodeTextFile(new TextEncoder().encode("too large"), 2),
    EditableFileTooLargeError,
  );
});

