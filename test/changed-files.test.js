import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  collectChangedFiles,
  parsePorcelainV1Z
} from "../src/changed-files.js";

const execFileAsync = promisify(execFile);

async function git(repository, args) {
  return execFileAsync("git", ["-C", repository, ...args]);
}

async function repositoryFixture() {
  const repository = await fs.mkdtemp(path.join(os.tmpdir(), "mogako-git-"));
  await git(repository, ["init"]);
  await git(repository, ["config", "user.name", "Mogako Test"]);
  await git(repository, ["config", "user.email", "test@mogako.invalid"]);
  return repository;
}

test("parser consumes rename fields and excludes unsafe paths", () => {
  const raw = Buffer.from(
    "?? lib/일반 파일.dart\0" +
      "?? lib/line\nbreak.dart\0" +
      "?? .env.local\0" +
      "?? secrets/key.pem\0" +
      "R  new name.dart\0old name.dart\0",
    "utf8"
  );
  const result = parsePorcelainV1Z(raw);
  assert.deepEqual(result.included, ["lib/일반 파일.dart", "new name.dart"]);
  assert.equal(result.excludedCount, 3);
});

test("collector reads an actual git rename destination", async () => {
  const repository = await repositoryFixture();
  await fs.writeFile(path.join(repository, "old name.dart"), "test\n");
  await git(repository, ["add", "old name.dart"]);
  await git(repository, ["commit", "-m", "fixture"]);
  await git(repository, ["mv", "old name.dart", "new name.dart"]);

  const result = await collectChangedFiles(repository);
  assert.deepEqual(result.included, ["new name.dart"]);
  assert.equal(result.excludedCount, 0);
});

test("collector rejects more than 100 included paths", () => {
  const raw = Buffer.from(
    Array.from({ length: 101 }, (_, index) => `?? lib/file-${index}.dart\0`).join(""),
    "utf8"
  );
  assert.throws(
    () => parsePorcelainV1Z(raw),
    /at most 100 paths/u
  );
});

test("collector rejects paths longer than 240 characters", () => {
  const raw = Buffer.from(`?? ${"a".repeat(241)}\0`, "utf8");
  assert.throws(
    () => parsePorcelainV1Z(raw),
    /at most 240 characters/u
  );
});
