import os from "node:os";
import path from "node:path";
import { loadConfig, normalizeApiBaseUrl } from "./config.js";
import {
  loadConnection,
  publicConnection,
  saveConnection
} from "./connection.js";
import { PRIVACY_MODES, WORKLOG_SCHEMA_VERSION } from "./constants.js";
import { validateDateString } from "./date.js";
import { readJson } from "./files.js";

const ROOT_FIELDS = new Set([
  "schemaVersion",
  "recordId",
  "generatedAt",
  "date",
  "recordMode",
  "focus",
  "usage",
  "contentShared",
  "worklog",
  "consent",
  "delivery"
]);
const FOCUS_FIELDS = new Set(["seconds", "sessionCount"]);
const USAGE_FIELDS = new Set(["providers"]);
const PROVIDER_FIELDS = new Set([
  "provider",
  "model",
  "sessionCount",
  "inputTokens",
  "outputTokens",
  "cachedInputTokens"
]);
const WORKLOG_FIELDS = new Set([
  "title",
  "summary",
  "completed",
  "nextActions",
  "blockers"
]);
const CONSENT_FIELDS = new Set([
  "summarySharingEnabled",
  "reviewedBeforeSubmission"
]);
const DELIVERY_FIELDS = new Set(["status", "automaticUpload"]);

export class MogakoTransportError extends Error {
  constructor(message, { status, code, details, cause } = {}) {
    super(message, { cause });
    this.name = "MogakoTransportError";
    this.status = status;
    this.code = code;
    this.details = redactSensitive(details || {});
  }
}

export async function connect(userCode, {
  env = process.env,
  fetch = globalThis.fetch,
  apiBaseUrl,
  deviceName = os.hostname()
} = {}) {
  const config = await loadConfig(env);
  const resolvedBaseUrl = normalizeApiBaseUrl(
    apiBaseUrl || env.MOGAKO_API_BASE_URL || config.apiBaseUrl
  );
  const code = requiredString(userCode, "Connection code");
  const name = requiredString(deviceName, "Device name");
  if (name.length > 80) {
    throw new Error("Device name must be 80 characters or fewer.");
  }

  const response = await requestJson(
    new URL("worklog-device-tokens/exchange", resolvedBaseUrl),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userCode: code, deviceName: name })
    },
    fetch
  );
  const connection = {
    apiBaseUrl: resolvedBaseUrl,
    deviceId: requiredString(response.deviceId, "deviceId"),
    token: requiredString(response.token, "device token")
  };
  if (response.scope !== "worklog:write") {
    throw new MogakoTransportError("Mogako returned an unsupported device scope.");
  }
  await saveConnection(connection, env);
  return publicConnection(connection);
}

export async function submitRecord(filePath, {
  env = process.env,
  fetch = globalThis.fetch
} = {}) {
  const resolvedPath = path.resolve(requiredString(filePath, "Record path"));
  const record = validateWorklog(await readJson(resolvedPath));
  const connection = await loadConnection(env);
  const response = await requestJson(
    new URL(`worklog-imports/daily/${record.date}`, connection.apiBaseUrl),
    {
      method: "PUT",
      headers: {
        Authorization: `Worklog ${connection.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(record)
    },
    fetch
  );
  return {
    result: requiredString(response.result, "import result"),
    recordId: requiredString(response.recordId, "recordId"),
    date: requiredString(response.date, "date"),
    sourceGeneratedAt: requiredString(
      response.sourceGeneratedAt,
      "sourceGeneratedAt"
    ),
    importedAt: requiredString(response.importedAt, "importedAt")
  };
}

export function validateWorklog(value) {
  assertObject(value, "record");
  rejectUnknown(value, ROOT_FIELDS, "record");
  requireFields(value, [
    "schemaVersion",
    "recordId",
    "generatedAt",
    "date",
    "recordMode",
    "focus",
    "usage",
    "contentShared",
    "consent",
    "delivery"
  ], "record");

  if (value.schemaVersion !== WORKLOG_SCHEMA_VERSION) {
    throw new Error(`Unsupported worklog schemaVersion: ${value.schemaVersion}`);
  }
  if (!isUuid(value.recordId)) {
    throw new Error("record.recordId must be a UUID.");
  }
  if (typeof value.generatedAt !== "string" || Number.isNaN(Date.parse(value.generatedAt))) {
    throw new Error("record.generatedAt must be an ISO-8601 timestamp.");
  }
  validateDateString(value.date);
  if (!Object.values(PRIVACY_MODES).includes(value.recordMode)) {
    throw new Error(`Unsupported worklog recordMode: ${value.recordMode}`);
  }
  assertBoolean(value.contentShared, "record.contentShared");

  validateFocus(value.focus);
  validateUsage(value.usage);
  validateConsent(value.consent);
  validateDelivery(value.delivery);

  if (value.recordMode === PRIVACY_MODES.METADATA_ONLY) {
    if (value.contentShared !== false || "worklog" in value) {
      throw new Error("METADATA_ONLY records cannot contain worklog content.");
    }
    if (value.consent.reviewedBeforeSubmission !== false) {
      throw new Error("METADATA_ONLY records cannot claim summary review.");
    }
  } else {
    if (value.contentShared !== true || !("worklog" in value)) {
      throw new Error("REVIEWED_SUMMARY requires worklog content.");
    }
    validateReviewedWorklog(value.worklog);
    if (
      value.consent.summarySharingEnabled !== true ||
      value.consent.reviewedBeforeSubmission !== true
    ) {
      throw new Error("REVIEWED_SUMMARY requires explicit review and sharing consent.");
    }
  }
  return value;
}

async function requestJson(url, options, fetchImplementation) {
  if (typeof fetchImplementation !== "function") {
    throw new Error("This Node.js runtime does not provide fetch.");
  }
  let response;
  try {
    response = await fetchImplementation(url, options);
  } catch (cause) {
    throw new MogakoTransportError("Unable to reach the Mogako API.", { cause });
  }

  const payload = await parseResponseBody(response);
  if (!response.ok) {
    const apiError = payload?.error;
    const code = typeof apiError?.code === "string" ? apiError.code : undefined;
    throw new MogakoTransportError(
      code
        ? `Mogako API rejected the request (${code}).`
        : `Mogako API rejected the request (HTTP ${response.status}).`,
      {
        status: response.status,
        code,
        details: apiError?.details
      }
    );
  }
  assertObject(payload, "Mogako API response");
  return payload;
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new MogakoTransportError("Mogako API returned invalid JSON.", {
      status: response.status
    });
  }
}

function validateFocus(value) {
  assertObject(value, "record.focus");
  rejectUnknown(value, FOCUS_FIELDS, "record.focus");
  requireFields(value, ["seconds", "sessionCount"], "record.focus");
  assertNonNegativeInteger(value.seconds, "record.focus.seconds");
  assertNonNegativeInteger(value.sessionCount, "record.focus.sessionCount");
}

function validateUsage(value) {
  assertObject(value, "record.usage");
  rejectUnknown(value, USAGE_FIELDS, "record.usage");
  requireFields(value, ["providers"], "record.usage");
  if (!Array.isArray(value.providers) || value.providers.length > 50) {
    throw new Error("record.usage.providers must be an array of at most 50 items.");
  }
  for (const [index, provider] of value.providers.entries()) {
    const pathName = `record.usage.providers[${index}]`;
    assertObject(provider, pathName);
    rejectUnknown(provider, PROVIDER_FIELDS, pathName);
    requireFields(provider, ["provider", "sessionCount"], pathName);
    if (!/^[a-z0-9-]{1,32}$/u.test(provider.provider)) {
      throw new Error(`${pathName}.provider is invalid.`);
    }
    if (provider.model !== undefined && provider.model !== null) {
      assertString(provider.model, `${pathName}.model`, 80);
    }
    assertNonNegativeInteger(provider.sessionCount, `${pathName}.sessionCount`);
    for (const field of ["inputTokens", "outputTokens", "cachedInputTokens"]) {
      if (provider[field] !== undefined && provider[field] !== null) {
        assertNonNegativeInteger(provider[field], `${pathName}.${field}`);
      }
    }
  }
}

function validateReviewedWorklog(value) {
  assertObject(value, "record.worklog");
  rejectUnknown(value, WORKLOG_FIELDS, "record.worklog");
  requireFields(value, WORKLOG_FIELDS, "record.worklog");
  assertString(value.title, "record.worklog.title", 120);
  assertString(value.summary, "record.worklog.summary", 1000);
  validateTextItems(value.completed, "record.worklog.completed");
  validateTextItems(value.nextActions, "record.worklog.nextActions");
  validateTextItems(value.blockers, "record.worklog.blockers");
}

function validateTextItems(value, pathName) {
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error(`${pathName} must be an array of at most 20 items.`);
  }
  value.forEach((item, index) => assertString(item, `${pathName}[${index}]`, 300));
}

function validateConsent(value) {
  assertObject(value, "record.consent");
  rejectUnknown(value, CONSENT_FIELDS, "record.consent");
  requireFields(value, CONSENT_FIELDS, "record.consent");
  assertBoolean(value.summarySharingEnabled, "record.consent.summarySharingEnabled");
  assertBoolean(value.reviewedBeforeSubmission, "record.consent.reviewedBeforeSubmission");
}

function validateDelivery(value) {
  assertObject(value, "record.delivery");
  rejectUnknown(value, DELIVERY_FIELDS, "record.delivery");
  requireFields(value, DELIVERY_FIELDS, "record.delivery");
  if (value.status !== "LOCAL_OUTBOX_ONLY" || value.automaticUpload !== false) {
    throw new Error("Worklogs must remain local-outbox-only until explicit submit.");
  }
}

function assertObject(value, pathName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${pathName} must be an object.`);
  }
}

function rejectUnknown(value, allowed, pathName) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(`${pathName} contains unsupported field '${unknown[0]}'.`);
  }
}

function requireFields(value, fields, pathName) {
  for (const field of fields) {
    if (!(field in value)) {
      throw new Error(`${pathName}.${field} is required.`);
    }
  }
}

function assertNonNegativeInteger(value, pathName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${pathName} must be a non-negative integer.`);
  }
}

function assertBoolean(value, pathName) {
  if (typeof value !== "boolean") {
    throw new Error(`${pathName} must be a boolean.`);
  }
}

function assertString(value, pathName, maxLength) {
  if (typeof value !== "string" || value.trim() === "" || value.length > maxLength) {
    throw new Error(`${pathName} must be a non-empty string of at most ${maxLength} characters.`);
  }
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function redactSensitive(value) {
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      /(token|authorization|secret|credential)/iu.test(key)
        ? "[REDACTED]"
        : redactSensitive(nested)
    ])
  );
}
