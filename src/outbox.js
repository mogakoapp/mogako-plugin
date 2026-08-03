import path from "node:path";
import { getPaths } from "./paths.js";
import {
  pathExists,
  readJson,
  writeJsonAtomic,
  writeJsonExclusive
} from "./files.js";

export const DELIVERY_STATUSES = Object.freeze({
  PENDING: "PENDING",
  SUBMITTING: "SUBMITTING",
  DELIVERED: "DELIVERED",
  FAILED_RETRYABLE: "FAILED_RETRYABLE",
  FAILED_FINAL: "FAILED_FINAL"
});

export async function writeCheckpointOutbox(
  payload,
  { env = process.env, now = new Date() } = {}
) {
  if (!payload || typeof payload.sourceRecordId !== "string") {
    throw new Error("Checkpoint payload requires sourceRecordId.");
  }
  const { outbox } = getPaths(env);
  const payloadPath = path.join(outbox, `${payload.sourceRecordId}.json`);
  const deliveryPath = deliveryPathFor(payloadPath);
  await writeJsonExclusive(payloadPath, payload);
  await writeJsonAtomic(deliveryPath, initialDelivery(now));
  return { payloadPath, deliveryPath };
}

export async function readCheckpointDelivery(payloadPath) {
  const deliveryPath = deliveryPathFor(payloadPath);
  if (!(await pathExists(deliveryPath))) {
    throw new Error("Checkpoint delivery sidecar is missing.");
  }
  return readJson(deliveryPath);
}

export async function markCheckpointSubmitting(
  payloadPath,
  { now = new Date() } = {}
) {
  const current = await readCheckpointDelivery(payloadPath);
  return updateDelivery(payloadPath, {
    status: DELIVERY_STATUSES.SUBMITTING,
    attemptCount: requiredAttemptCount(current) + 1,
    lastErrorCode: null,
    updatedAt: now.toISOString()
  });
}

export async function markCheckpointDelivered(
  payloadPath,
  { now = new Date() } = {}
) {
  const current = await readCheckpointDelivery(payloadPath);
  return updateDelivery(payloadPath, {
    status: DELIVERY_STATUSES.DELIVERED,
    attemptCount: requiredAttemptCount(current),
    lastErrorCode: null,
    updatedAt: now.toISOString()
  });
}

export async function markCheckpointFailed(
  payloadPath,
  { retryable, errorCode, now = new Date() }
) {
  const current = await readCheckpointDelivery(payloadPath);
  return updateDelivery(payloadPath, {
    status: retryable
      ? DELIVERY_STATUSES.FAILED_RETRYABLE
      : DELIVERY_STATUSES.FAILED_FINAL,
    attemptCount: requiredAttemptCount(current),
    lastErrorCode:
      typeof errorCode === "string" && errorCode.trim() !== ""
        ? errorCode
        : null,
    updatedAt: now.toISOString()
  });
}

export function deliveryPathFor(payloadPath) {
  const resolved = path.resolve(payloadPath);
  if (!resolved.endsWith(".json") || resolved.endsWith(".delivery.json")) {
    throw new Error("Checkpoint payload path must end with .json.");
  }
  return `${resolved.slice(0, -5)}.delivery.json`;
}

function initialDelivery(now) {
  return {
    status: DELIVERY_STATUSES.PENDING,
    attemptCount: 0,
    lastErrorCode: null,
    updatedAt: now.toISOString()
  };
}

async function updateDelivery(payloadPath, delivery) {
  const deliveryPath = deliveryPathFor(payloadPath);
  await writeJsonAtomic(deliveryPath, delivery);
  return delivery;
}

function requiredAttemptCount(delivery) {
  if (!Number.isSafeInteger(delivery.attemptCount) || delivery.attemptCount < 0) {
    throw new Error("Checkpoint delivery attemptCount is invalid.");
  }
  return delivery.attemptCount;
}
