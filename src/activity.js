import path from "node:path";
import { appendJsonLine, readJsonLines } from "./files.js";
import { getPaths } from "./paths.js";
import { localDateString, validateDateString } from "./date.js";

function optionalNonNegativeInteger(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return parsed;
}

export function normalizeActivity(input) {
  const provider = String(input.provider || "unknown").trim().toLowerCase();
  if (!/^[a-z0-9-]{1,32}$/u.test(provider)) {
    throw new Error("provider must contain only letters, digits, and hyphens.");
  }

  const focusSeconds = optionalNonNegativeInteger(input.focusSeconds, "focusSeconds") ?? 0;
  const inputTokens = optionalNonNegativeInteger(input.inputTokens, "inputTokens");
  const outputTokens = optionalNonNegativeInteger(input.outputTokens, "outputTokens");
  const cachedInputTokens = optionalNonNegativeInteger(
    input.cachedInputTokens,
    "cachedInputTokens"
  );

  const activity = {
    schemaVersion: 1,
    occurredAt: input.occurredAt || new Date().toISOString(),
    provider,
    focusSeconds
  };

  if (input.model) {
    activity.model = String(input.model).trim().slice(0, 80);
  }
  if ([inputTokens, outputTokens, cachedInputTokens].some((value) => value !== undefined)) {
    activity.usage = {};
    if (inputTokens !== undefined) activity.usage.inputTokens = inputTokens;
    if (outputTokens !== undefined) activity.usage.outputTokens = outputTokens;
    if (cachedInputTokens !== undefined) {
      activity.usage.cachedInputTokens = cachedInputTokens;
    }
  }

  return activity;
}

export async function recordActivity(input, env = process.env) {
  const activity = normalizeActivity(input);
  const date = localDateString(new Date(activity.occurredAt));
  const filePath = path.join(getPaths(env).activity, `${date}.jsonl`);
  await appendJsonLine(filePath, activity);
  return activity;
}

export async function loadActivities(date = localDateString(), env = process.env) {
  validateDateString(date);
  const filePath = path.join(getPaths(env).activity, `${date}.jsonl`);
  return readJsonLines(filePath);
}

export function aggregateActivities(activities) {
  const usageMap = new Map();
  let focusSeconds = 0;

  for (const activity of activities) {
    focusSeconds += Number(activity.focusSeconds || 0);
    const key = `${activity.provider}\u0000${activity.model || ""}`;
    const current = usageMap.get(key) || {
      provider: activity.provider,
      ...(activity.model ? { model: activity.model } : {}),
      sessionCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      hasUsage: false
    };

    current.sessionCount += 1;
    if (activity.usage) {
      current.hasUsage = true;
      current.inputTokens += activity.usage.inputTokens || 0;
      current.outputTokens += activity.usage.outputTokens || 0;
      current.cachedInputTokens += activity.usage.cachedInputTokens || 0;
    }
    usageMap.set(key, current);
  }

  const providers = [...usageMap.values()].map((entry) => {
    const result = {
      provider: entry.provider,
      ...(entry.model ? { model: entry.model } : {}),
      sessionCount: entry.sessionCount
    };
    if (entry.hasUsage) {
      result.inputTokens = entry.inputTokens;
      result.outputTokens = entry.outputTokens;
      if (entry.cachedInputTokens > 0) {
        result.cachedInputTokens = entry.cachedInputTokens;
      }
    }
    return result;
  });

  return {
    focusSeconds,
    sessionCount: activities.length,
    providers
  };
}
