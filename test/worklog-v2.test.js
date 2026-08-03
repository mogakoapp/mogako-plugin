import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { buildCheckpoint } from "../src/checkpoint.js";
import { validateCheckpoint } from "../src/checkpoint-validation.js";
import { sourceClientForTarget } from "../src/source-client.js";

const execFileAsync = promisify(execFile);

async function setup() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mogako-v2-"));
  const repository = path.join(directory, "repository");
  await fs.mkdir(repository);
  await execFileAsync("git", ["init", repository]);
  return { directory, repository };
}

async function summaryFixture(directory, overrides = {}) {
  const value = {
    summary: "Reviewed checkpoint",
    completed: [],
    nextActions: [],
    blockers: [],
    ...overrides
  };
  const file = path.join(directory, `summary-${crypto.randomUUID()}.json`);
  await fs.writeFile(file, `${JSON.stringify(value)}\n`, "utf8");
  return file;
}

test("v2 payload has the exact required field set", async () => {
  const { directory, repository } = await setup();
  const summaryFile = await summaryFixture(directory);
  const record = await buildCheckpoint({
    summaryFile,
    repositoryRoot: repository,
    target: "codex",
    reviewed: true,
    now: new Date("2026-08-03T06:20:00Z")
  });

  assert.deepEqual(Object.keys(record).sort(), [
    "blockers",
    "changedFiles",
    "completed",
    "generatedAt",
    "localDate",
    "nextActions",
    "schemaVersion",
    "sourceClient",
    "sourceRecordId",
    "summary",
    "timeZoneId"
  ]);
  assert.equal(record.schemaVersion, 2);
  assert.equal(record.sourceClient, "CODEX");
  assert.deepEqual(record.blockers, []);
});

test("v2 rejects rather than truncates contract limits", async () => {
  const { directory, repository } = await setup();
  const summaryFile = await summaryFixture(directory, {
    summary: "x".repeat(1001)
  });
  await assert.rejects(
    () => buildCheckpoint({
      summaryFile,
      repositoryRoot: repository,
      target: "manual",
      reviewed: true
    }),
    /checkpoint\.summary must be a trimmed string of 1-1000 characters/u
  );
});

test("v2 rejects title and unknown summary-file keys", async () => {
  const { directory, repository } = await setup();
  const titleFile = await summaryFixture(directory, { title: "v1 title" });
  await assert.rejects(
    () => buildCheckpoint({
      summaryFile: titleFile,
      repositoryRoot: repository,
      reviewed: true
    }),
    /unsupported field 'title'/u
  );

  const extraFile = await summaryFixture(directory, { extra: "not allowed" });
  await assert.rejects(
    () => buildCheckpoint({
      summaryFile: extraFile,
      repositoryRoot: repository,
      reviewed: true
    }),
    /unsupported field 'extra'/u
  );
});

test("v2 redacts secrets before producing the preview payload", async () => {
  const { directory, repository } = await setup();
  const summaryFile = await summaryFixture(directory, {
    summary: "sk-1234567890abcdefghijkl C:\\Users\\Kwon\\secret.txt user@example.com"
  });
  const record = await buildCheckpoint({
    summaryFile,
    repositoryRoot: repository,
    reviewed: true
  });
  assert.doesNotMatch(
    record.summary,
    /sk-1234567890abcdefghijkl|C:\\Users|user@example\.com/u
  );
  assert.match(record.summary, /REDACTED/u);
});

test("manual target is the default and explicit manual mapping", () => {
  assert.equal(sourceClientForTarget(undefined), "MANUAL_CLI");
  assert.equal(sourceClientForTarget("manual"), "MANUAL_CLI");
  assert.equal(sourceClientForTarget("claude-code"), "CLAUDE_CODE");
  assert.equal(sourceClientForTarget("antigravity-cli"), "ANTIGRAVITY");
});

test("all source-client fixtures satisfy the same v2 validator", async () => {
  const names = ["codex", "claude-code", "antigravity", "manual-cli"];
  for (const name of names) {
    const file = new URL(`./fixtures/worklog-v2-${name}.json`, import.meta.url);
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    assert.equal(validateCheckpoint(value), value);
  }
});
