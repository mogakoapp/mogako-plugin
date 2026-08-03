import { localDateString, validateDateString, validateTimeZoneId } from "./date.js";
import { SOURCE_CLIENTS } from "./source-client.js";

const ROOT_FIELDS = Object.freeze([
  "schemaVersion",
  "sourceRecordId",
  "sourceClient",
  "generatedAt",
  "timeZoneId",
  "localDate",
  "summary",
  "completed",
  "changedFiles",
  "nextActions",
  "blockers"
]);

const SENSITIVE_PATH_PATTERNS = [
  /(^|\/)\.env(?:\.|$)/iu,
  /\.pem$/iu,
  /\.key$/iu,
  /(^|\/)credentials[^/]*$/iu,
  /(^|\/)\.ssh(?:\/|$)/iu,
  /(^|\/)secrets(?:\/|$)/iu
];

export function validateCheckpoint(value) {
  assertObject(value, "checkpoint");
  const keys = Object.keys(value);
  const unknown = keys.filter((key) => !ROOT_FIELDS.includes(key));
  if (unknown.length > 0) {
    throw new Error(`checkpoint contains unsupported field '${unknown[0]}'.`);
  }
  for (const field of ROOT_FIELDS) {
    if (!(field in value)) {
      throw new Error(`checkpoint.${field} is required.`);
    }
  }
  if (value.schemaVersion !== 2) {
    throw new Error("checkpoint.schemaVersion must be 2.");
  }
  if (!isUuid(value.sourceRecordId)) {
    throw new Error("checkpoint.sourceRecordId must be a UUID.");
  }
  if (!SOURCE_CLIENTS.includes(value.sourceClient)) {
    throw new Error(`Unsupported checkpoint sourceClient: ${value.sourceClient}`);
  }
  const generatedAt = validateGeneratedAt(value.generatedAt);
  const timeZoneId = validateTimeZoneId(value.timeZoneId);
  validateDateString(value.localDate);
  if (localDateString(generatedAt, timeZoneId) !== value.localDate) {
    throw new Error("checkpoint.localDate does not match generatedAt and timeZoneId.");
  }
  validateTrimmedString(value.summary, "checkpoint.summary", 1000);
  validateTextItems(value.completed, "checkpoint.completed", 20, 300);
  validateChangedFiles(value.changedFiles);
  validateTextItems(value.nextActions, "checkpoint.nextActions", 20, 300);
  validateTextItems(value.blockers, "checkpoint.blockers", 20, 300);
  return value;
}

export function validateChangedFilePath(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 240) {
    throw new Error("changed file path must be 1-240 characters.");
  }
  if (value.includes("\\")) {
    throw new Error("changed file path must use '/' separators.");
  }
  if (/^[A-Za-z]:/u.test(value) || value.startsWith("/") || value.startsWith("//")) {
    throw new Error("changed file path must be repository-relative.");
  }
  if (/[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error("changed file path must not contain control characters.");
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("changed file path contains an invalid segment.");
  }
  if (isSensitivePath(value)) {
    throw new Error("changed file path is sensitive.");
  }
  return value;
}

export function isSensitivePath(value) {
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(value));
}

function validateChangedFiles(value) {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error("checkpoint.changedFiles must contain at most 100 paths.");
  }
  value.forEach((item, index) => {
    try {
      validateChangedFilePath(item);
    } catch (error) {
      throw new Error(`checkpoint.changedFiles[${index}]: ${error.message}`);
    }
  });
}

function validateTextItems(value, pathName, maxItems, maxLength) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${pathName} must contain at most ${maxItems} items.`);
  }
  value.forEach((item, index) =>
    validateTrimmedString(item, `${pathName}[${index}]`, maxLength)
  );
}

function validateTrimmedString(value, pathName, maxLength) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > maxLength
  ) {
    throw new Error(`${pathName} must be a trimmed string of 1-${maxLength} characters.`);
  }
}

function validateGeneratedAt(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  ) {
    throw new Error("checkpoint.generatedAt must be a UTC RFC 3339 instant.");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("checkpoint.generatedAt must be a valid instant.");
  }
  return parsed;
}

function assertObject(value, pathName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${pathName} must be an object.`);
  }
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
