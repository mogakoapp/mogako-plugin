const SECRET_PATTERNS = [
  [/\b(?:sk|rk|pk)-[A-Za-z0-9_-]{16,}\b/gu, "[REDACTED_API_KEY]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu, "[REDACTED_GITHUB_TOKEN]"],
  [/\bAKIA[0-9A-Z]{16}\b/gu, "[REDACTED_AWS_KEY]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[REDACTED_JWT]"],
  [/\b[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)\s*=\s*[^\s,;]+/gu, "[REDACTED_ENV_SECRET]"],
  [/[A-Z]:\\(?:[^\\\r\n]+\\)*[^\\\r\n]*/gu, "[REDACTED_LOCAL_PATH]"],
  [/(?:^|\s)\/(?:Users|home)\/[A-Za-z0-9._-]+(?:\/[^\s]*)?/gu, " [REDACTED_LOCAL_PATH]"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, "[REDACTED_EMAIL]"]
];

export function sanitizeText(value, maxLength = 1000) {
  let sanitized = String(value ?? "").trim().slice(0, maxLength);
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

function sanitizeList(value, fieldName, maxItems = 20) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }
  return value
    .slice(0, maxItems)
    .map((item) => sanitizeText(item, 300))
    .filter(Boolean);
}

export function sanitizeSummary(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Summary must be a JSON object.");
  }

  const allowedKeys = new Set([
    "title",
    "summary",
    "completed",
    "nextActions",
    "blockers"
  ]);
  const unexpected = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new Error(`Summary contains unsupported fields: ${unexpected.join(", ")}`);
  }

  const title = sanitizeText(input.title, 120);
  const summary = sanitizeText(input.summary, 1000);
  if (!title || !summary) {
    throw new Error("Summary requires non-empty title and summary fields.");
  }

  return {
    title,
    summary,
    completed: sanitizeList(input.completed, "completed"),
    nextActions: sanitizeList(input.nextActions, "nextActions"),
    blockers: sanitizeList(input.blockers, "blockers")
  };
}
