import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedStorageKey } from "../src/lib/storage";

test("storage keys are restricted to one object inside uploads", () => {
  assert.equal(isAllowedStorageKey("uploads/abc_document.pdf"), true);
  assert.equal(isAllowedStorageKey("private/secret.txt"), false);
  assert.equal(isAllowedStorageKey("uploads/folder/file.txt"), false);
  assert.equal(isAllowedStorageKey("uploads/..\\secret.txt"), false);
  assert.equal(isAllowedStorageKey("uploads/"), false);
});
