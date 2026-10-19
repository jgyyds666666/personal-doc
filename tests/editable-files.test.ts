import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MAX_EDITABLE_FILE_BYTES,
  detectEditableFile,
} from "../src/lib/editable-files";

test("editable text and source formats are detected from file names", () => {
  assert.deepEqual(detectEditableFile("notes.md", 20), {
    kind: "markdown",
    language: "markdown",
    editable: true,
  });
  assert.deepEqual(detectEditableFile("component.tsx", 20), {
    kind: "source-code",
    language: "tsx",
    editable: true,
  });
  assert.deepEqual(detectEditableFile(".env.production", 20), {
    kind: "config",
    language: "properties",
    editable: true,
  });
  assert.deepEqual(detectEditableFile("Dockerfile", 20), {
    kind: "source-code",
    language: "dockerfile",
    editable: true,
  });
});

test("binary and oversized files are not editable", () => {
  assert.equal(detectEditableFile("archive.zip", 20).editable, false);
  assert.deepEqual(
    detectEditableFile("large.txt", DEFAULT_MAX_EDITABLE_FILE_BYTES + 1),
    {
      kind: "plain-text",
      language: null,
      editable: false,
      reason: "file-too-large",
    },
  );
  assert.equal(detectEditableFile("private.pem", 20).editable, false);
  assert.equal(detectEditableFile("private.key", 20).editable, false);
});
