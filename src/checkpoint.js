import crypto from "node:crypto";
import path from "node:path";
import { collectChangedFiles } from "./changed-files.js";
import { validateCheckpoint } from "./checkpoint-validation.js";
import { localDateString, resolvedTimeZone } from "./date.js";
import { readJson } from "./files.js";
import { sanitizeCheckpointSummary } from "./sanitize.js";
import { sourceClientForTarget } from "./source-client.js";

export async function buildCheckpoint({
  summaryFile,
  repositoryRoot,
  target,
  reviewed = false,
  now = new Date(),
  changedFilesResult
} = {}) {
  if (!reviewed) {
    throw new Error("Checkpoint creation requires the --reviewed flag.");
  }
  if (typeof summaryFile !== "string" || summaryFile.trim() === "") {
    throw new Error("Checkpoint creation requires --summary-file.");
  }
  if (typeof repositoryRoot !== "string" || repositoryRoot.trim() === "") {
    throw new Error("Checkpoint creation requires a repository root.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Checkpoint creation requires a valid time.");
  }

  const summaryInput = sanitizeCheckpointSummary(
    await readJson(path.resolve(summaryFile))
  );
  const files = changedFilesResult ||
    await collectChangedFiles(path.resolve(repositoryRoot));
  if (!files || !Array.isArray(files.included)) {
    throw new Error("changedFilesResult is invalid.");
  }
  const timeZoneId = resolvedTimeZone();

  return validateCheckpoint({
    schemaVersion: 2,
    sourceRecordId: crypto.randomUUID(),
    sourceClient: sourceClientForTarget(target),
    generatedAt: now.toISOString(),
    timeZoneId,
    localDate: localDateString(now, timeZoneId),
    summary: summaryInput.summary,
    completed: summaryInput.completed,
    changedFiles: files.included,
    nextActions: summaryInput.nextActions,
    blockers: summaryInput.blockers
  });
}
