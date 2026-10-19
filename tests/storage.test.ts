import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedStorageKey,
  parseOriginalName,
} from "../src/lib/storage";

test("storage keys are restricted to one object inside uploads", () => {
  assert.equal(isAllowedStorageKey("uploads/abc_document.pdf"), true);
  assert.equal(isAllowedStorageKey("private/secret.txt"), false);
  assert.equal(isAllowedStorageKey("uploads/folder/file.txt"), false);
  assert.equal(isAllowedStorageKey("uploads/..\\secret.txt"), false);
  assert.equal(isAllowedStorageKey("uploads/"), false);
});

test("original file names are parsed from generated object keys", () => {
  assert.equal(
    parseOriginalName("uploads/123e4567-e89b-12d3-a456-426614174000_notes.md"),
    "notes.md",
  );
  assert.equal(parseOriginalName("uploads/plain.txt"), "plain.txt");
});
