import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { saveConnection } from "../src/connection.js";
import { readJson } from "../src/files.js";
import {
  readCheckpointDelivery,
  writeCheckpointOutbox
} from "../src/outbox.js";
import {
  MogakoTransportError,
  submitCheckpoint
} from "../src/transport.js";

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mogako-checkpoint-transport-"));
  const env = { MOGAKO_HOME: directory };
  const source = new URL("./fixtures/worklog-v2-codex.json", import.meta.url);
  const payload = JSON.parse(await fs.readFile(source, "utf8"));
  const paths = await writeCheckpointOutbox(payload, {
    env,
    now: new Date("2026-08-03T06:20:00Z")
  });
  await saveConnection({
    apiBaseUrl: "http://localhost:8080/api/v1/",
    deviceId: "wkd_checkpoint",
    token: "private-checkpoint-token"
  }, env);
  return { env, payload, ...paths };
}

function unchangedResponse(payload) {
  return new Response(JSON.stringify({
    result: "UNCHANGED",
    checkpointId: "wcp_existing",
    sourceRecordId: payload.sourceRecordId,
    workDate: payload.localDate,
    importedAt: "2026-08-03T06:21:00Z"
  }), { status: 200 });
}

test("retry sends identical payload bytes and changes only the sidecar", async () => {
  const { env, payload, payloadPath, deliveryPath } = await fixture();
  const before = await fs.readFile(payloadPath, "utf8");

  await assert.rejects(
    () => submitCheckpoint(payloadPath, {
      env,
      fetch: async () => {
        throw new TypeError("network failure");
      },
      now: new Date("2026-08-03T06:22:00Z")
    }),
    MogakoTransportError
  );

  assert.equal(await fs.readFile(payloadPath, "utf8"), before);
  assert.deepEqual(await readJson(payloadPath), payload);
  const failed = await readCheckpointDelivery(payloadPath);
  assert.equal(failed.status, "FAILED_RETRYABLE");
  assert.equal(failed.attemptCount, 1);
  assert.equal(failed.lastErrorCode, "NETWORK_ERROR");

  let submittedBody;
  const result = await submitCheckpoint(payloadPath, {
    env,
    fetch: async (_url, options) => {
      submittedBody = options.body;
      return unchangedResponse(payload);
    },
    now: new Date("2026-08-03T06:23:00Z")
  });

  assert.equal(submittedBody, JSON.stringify(payload));
  assert.equal(await fs.readFile(payloadPath, "utf8"), before);
  assert.equal(result.result, "UNCHANGED");
  const delivered = await readJson(deliveryPath);
  assert.equal(delivered.status, "DELIVERED");
  assert.equal(delivered.attemptCount, 2);
  assert.equal(delivered.lastErrorCode, null);
});

test("revoked connection is final while preserving immutable payload", async () => {
  const { env, payloadPath } = await fixture();
  const before = await fs.readFile(payloadPath, "utf8");

  await assert.rejects(
    () => submitCheckpoint(payloadPath, {
      env,
      fetch: async () => new Response(JSON.stringify({
        error: {
          code: "WORKLOG_DEVICE_REVOKED",
          message: "revoked"
        }
      }), { status: 401 }),
      now: new Date("2026-08-03T06:24:00Z")
    }),
    (error) => {
      assert.equal(error instanceof MogakoTransportError, true);
      assert.equal(error.status, 401);
      assert.equal(error.code, "WORKLOG_DEVICE_REVOKED");
      return true;
    }
  );

  assert.equal(await fs.readFile(payloadPath, "utf8"), before);
  const delivery = await readCheckpointDelivery(payloadPath);
  assert.equal(delivery.status, "FAILED_FINAL");
  assert.equal(delivery.attemptCount, 1);
  assert.equal(delivery.lastErrorCode, "WORKLOG_DEVICE_REVOKED");
});

test("validation failure never calls fetch and records no payload body in sidecar", async () => {
  const { env, payloadPath } = await fixture();
  const invalid = await readJson(payloadPath);
  invalid.summary = " x ";
  await fs.writeFile(payloadPath, `${JSON.stringify(invalid, null, 2)}\n`, "utf8");
  let requests = 0;

  await assert.rejects(
    () => submitCheckpoint(payloadPath, {
      env,
      fetch: async () => {
        requests += 1;
      }
    }),
    /checkpoint\.summary/u
  );

  assert.equal(requests, 0);
  const delivery = await readCheckpointDelivery(payloadPath);
  assert.equal(delivery.status, "FAILED_FINAL");
  assert.equal(delivery.attemptCount, 0);
  assert.equal(delivery.lastErrorCode, "LOCAL_VALIDATION_FAILED");
  assert.deepEqual(Object.keys(delivery).sort(), [
    "attemptCount",
    "lastErrorCode",
    "status",
    "updatedAt"
  ]);
});
