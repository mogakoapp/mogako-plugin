import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConnection, saveConnection } from "../src/connection.js";
import { writeJson } from "../src/files.js";
import {
  MogakoTransportError,
  connect,
  submitRecord,
  validateWorklog
} from "../src/transport.js";

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mogako-transport-"));
  return { directory, env: { MOGAKO_HOME: directory } };
}

function metadataRecord(overrides = {}) {
  return {
    schemaVersion: "1.0",
    recordId: "00000000-0000-4000-8000-000000000001",
    generatedAt: "2026-07-30T10:00:00.000Z",
    date: "2026-07-30",
    recordMode: "METADATA_ONLY",
    focus: { seconds: 1800, sessionCount: 2 },
    usage: {
      providers: [
        {
          provider: "codex",
          model: "gpt-5",
          sessionCount: 2,
          inputTokens: 1000,
          outputTokens: 200
        }
      ]
    },
    contentShared: false,
    consent: {
      summarySharingEnabled: false,
      reviewedBeforeSubmission: false
    },
    delivery: {
      status: "LOCAL_OUTBOX_ONLY",
      automaticUpload: false
    },
    ...overrides
  };
}

async function writeRecord(directory, record = metadataRecord()) {
  const filePath = path.join(directory, "record.json");
  await writeJson(filePath, record);
  return filePath;
}

test("connect exchanges a short code and stores only the device credential", async () => {
  const { env } = await fixture();
  let request;
  const fetch = async (url, options) => {
    request = { url: url.toString(), options };
    return new Response(JSON.stringify({
      deviceId: "wkd_connected",
      token: "server-private-token",
      scope: "worklog:write"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const result = await connect("ABCD2345", {
    env,
    fetch,
    apiBaseUrl: "http://localhost:8080/api/v1/",
    deviceName: "Windows Development PC"
  });

  assert.deepEqual(result, {
    apiBaseUrl: "http://localhost:8080/api/v1/",
    deviceId: "wkd_connected"
  });
  assert.equal(request.url, "http://localhost:8080/api/v1/worklog-device-tokens/exchange");
  assert.deepEqual(JSON.parse(request.options.body), {
    userCode: "ABCD2345",
    deviceName: "Windows Development PC"
  });
  assert.deepEqual(await loadConnection(env), {
    apiBaseUrl: "http://localhost:8080/api/v1/",
    deviceId: "wkd_connected",
    token: "server-private-token"
  });
});

test("submit sends the exact outbox record with the write-only credential", async () => {
  const { directory, env } = await fixture();
  const filePath = await writeRecord(directory);
  await saveConnection(
    {
      apiBaseUrl: "http://localhost:8080/api/v1/",
      deviceId: "wkd_submit",
      token: "private-submit-token"
    },
    env
  );
  let request;
  const fetch = async (url, options) => {
    request = { url: url.toString(), options };
    return new Response(JSON.stringify({
      result: "CREATED",
      recordId: metadataRecord().recordId,
      date: "2026-07-30",
      sourceGeneratedAt: "2026-07-30T10:00:00Z",
      importedAt: "2026-07-30T10:01:00Z"
    }), { status: 200 });
  };

  const result = await submitRecord(filePath, { env, fetch });

  assert.equal(request.url, "http://localhost:8080/api/v1/worklog-imports/daily/2026-07-30");
  assert.equal(request.options.method, "PUT");
  assert.equal(request.options.headers.Authorization, "Worklog private-submit-token");
  assert.deepEqual(JSON.parse(request.options.body), metadataRecord());
  assert.equal(result.result, "CREATED");
  assert.equal(await fs.readFile(filePath, "utf8").then(Boolean), true);
});

test("network failure preserves the outbox and never exposes the token", async () => {
  const { directory, env } = await fixture();
  const filePath = await writeRecord(directory);
  const token = "never-print-this-token";
  await saveConnection(
    {
      apiBaseUrl: "https://api.mogako.app/api/v1/",
      deviceId: "wkd_network",
      token
    },
    env
  );

  await assert.rejects(
    () => submitRecord(filePath, {
      env,
      fetch: async () => {
        throw new Error(`socket failed with ${token}`);
      }
    }),
    (error) => {
      assert.equal(error instanceof MogakoTransportError, true);
      assert.equal(error.message, "Unable to reach the Mogako API.");
      assert.equal(error.message.includes(token), false);
      return true;
    }
  );
  assert.equal(await fs.readFile(filePath, "utf8").then(Boolean), true);
});

test("server errors preserve stable codes and redact sensitive details", async () => {
  const { directory, env } = await fixture();
  const filePath = await writeRecord(directory);
  await saveConnection(
    {
      apiBaseUrl: "https://api.mogako.app/api/v1/",
      deviceId: "wkd_stale",
      token: "private-stale-token"
    },
    env
  );

  await assert.rejects(
    () => submitRecord(filePath, {
      env,
      fetch: async () => new Response(JSON.stringify({
        error: {
          code: "WORKLOG_STALE_IMPORT",
          message: "stale",
          details: {
            currentGeneratedAt: "2026-07-30T11:00:00Z",
            token: "accidental-server-echo"
          }
        }
      }), { status: 409 })
    }),
    (error) => {
      assert.equal(error instanceof MogakoTransportError, true);
      assert.equal(error.status, 409);
      assert.equal(error.code, "WORKLOG_STALE_IMPORT");
      assert.equal(error.details.token, "[REDACTED]");
      assert.equal(error.message.includes("accidental-server-echo"), false);
      return true;
    }
  );
  assert.equal(await fs.readFile(filePath, "utf8").then(Boolean), true);
});

test("submit validation rejects unsupported raw fields before fetch", async () => {
  const record = metadataRecord({ repositoryUrl: "https://example.invalid/private" });
  assert.throws(
    () => validateWorklog(record),
    /unsupported field 'repositoryUrl'/u
  );
});
