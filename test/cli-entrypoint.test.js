import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { isSameCliEntrypoint } from "../src/cli.js";

test("recognizes an npm-link path that resolves to the CLI source", () => {
  const linkedPath = path.resolve(
    "C:/Users/Kwon/AppData/Roaming/npm/node_modules/mogako-plugin/src/cli.js"
  );
  const sourcePath = path.resolve(
    "C:/Users/Kwon/Desktop/mogako-plugin/src/cli.js"
  );
  const realPaths = new Map([
    [linkedPath, sourcePath],
    [sourcePath, sourcePath]
  ]);

  assert.equal(
    isSameCliEntrypoint(linkedPath, sourcePath, (value) => realPaths.get(value)),
    true
  );
});

test("does not treat an unrelated file as the CLI entrypoint", () => {
  const sourcePath = path.resolve(
    "C:/Users/Kwon/Desktop/mogako-plugin/src/cli.js"
  );
  const otherPath = path.resolve(
    "C:/Users/Kwon/Desktop/mogako-plugin/src/checkpoint.js"
  );

  assert.equal(
    isSameCliEntrypoint(otherPath, sourcePath, (value) => value),
    false
  );
});
