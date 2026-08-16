import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { runCli } from "../src/cli.js";
import { saveConnection } from "../src/connection.js";
import { readJson } from "../src/files.js";

const execFileAsync = promisify(execFile);

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mogako-command-"));
  const home = path.join(directory, "home");
  const repository = path.join(directory, "repository");
  const summaryFile = path.join(directory, "summary.json");
  await fs.mkdir(repository, { recursive: true });
  await execFileAsync("git", ["init", repository]);
  await fs.writeFile(summaryFile, JSON.stringify({
    summary: "Reviewed current checkpoint",
    completed: ["Added checkpoint command"],
    nextActions: ["Run Node CI"],
    blockers: []
  }));
  return {
    directory,
    repository,
    summaryFile,
    env: { MOGAKO_HOME: home }
  };
}

function interactiveIo(approved) {
  const logs = [];
  return {
    logs,
    isInteractive: true,
    log(value) {
      logs.push(value);
    },
    error() {},
    async confirm() {
      return approved;
    }
  };
}

function previewFrom(io) {
  return JSON.parse(io.logs[0]);
}

test("checkpoint makes no request before final approval", async () => {
  const { env, repository, summaryFile } = await fixture();
  const io = interactiveIo(false);
  let requests = 0;

  await runCli([
    "checkpoint",
    "--summary-file", summaryFile,
    "--repo", repository,
    "--target", "codex",
    "--submit"
  ], {
    env,
    io,
    fetch: async () => {
      requests += 1;
      throw new Error("fetch must not run");
    }
  });

  assert.equal(requests, 0);
  const preview = previewFrom(io);
  assert.equal(preview.sourceClient, "CODEX");
  assert.equal(preview.checkpoint.schemaVersion, 2);
  assert.equal(preview.excludedPathCount, 0);
  assert.equal((await readJson(preview.deliveryPath)).status, "PENDING");
  assert.equal(await fs.readFile(preview.payloadPath, "utf8").then(Boolean), true);
  assert.match(String(io.logs.at(-1)), /cancelled/u);
});

test("checkpoint without submit creates only a pending immutable outbox", async () => {
  const { env, repository, summaryFile } = await fixture();
  const io = interactiveIo(true);
  let requests = 0;

  await runCli([
    "checkpoint",
    "--summary-file", summaryFile,
    "--repo", repository,
    "--target", "manual"
  ], {
    env,
    io,
    fetch: async () => {
      requests += 1;
    }
  });

  assert.equal(requests, 0);
  const preview = previewFrom(io);
  assert.equal(preview.sourceClient, "MANUAL_CLI");
  assert.equal((await readJson(preview.deliveryPath)).status, "PENDING");
});

test("explicit approval submits the exact previewed checkpoint", async () => {
  const { env, repository, summaryFile } = await fixture();
  await saveConnection({
    apiBaseUrl: "http://localhost:8080/api/v1/",
    deviceId: "wkd_checkpoint",
    token: "checkpoint-private-token"
  }, env);
  const io = interactiveIo(true);
  let request;

  await runCli([
    "checkpoint",
    "--summary-file", summaryFile,
    "--repo", repository,
    "--target", "claude-code",
    "--submit",
    "--yes"
  ], {
    env,
    io,
    fetch: async (url, options) => {
      request = { url: url.toString(), options };
      const body = JSON.parse(options.body);
      return new Response(JSON.stringify({
        result: "CREATED",
        checkpointId: "wcp_created",
        sourceRecordId: body.sourceRecordId,
        workDate: body.localDate,
        importedAt: "2026-08-03T08:00:00Z"
      }), { status: 201 });
    }
  });

  const preview = previewFrom(io);
  assert.equal(request.url, "http://localhost:8080/api/v1/worklog-imports/checkpoints");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Worklog checkpoint-private-token");
  assert.deepEqual(JSON.parse(request.options.body), preview.checkpoint);
  const delivery = await readJson(preview.deliveryPath);
  assert.equal(delivery.status, "DELIVERED");
  assert.equal(delivery.attemptCount, 1);
});

test("checkpoint supports inline --summary flag", async () => {
  const { env, repository } = await fixture();
  const io = interactiveIo(true);

  await runCli([
    "checkpoint",
    "--summary", "Inline summary test",
    "--repo", repository,
    "--target", "antigravity"
  ], {
    env,
    io
  });

  const preview = previewFrom(io);
  assert.equal(preview.sourceClient, "ANTIGRAVITY");
  assert.equal(preview.checkpoint.summary, "Inline summary test");
  assert.deepEqual(preview.checkpoint.completed, []);
});
