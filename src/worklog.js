import crypto from "node:crypto";
import path from "node:path";
import { PRIVACY_MODES, WORKLOG_SCHEMA_VERSION } from "./constants.js";
import { aggregateActivities, loadActivities } from "./activity.js";
import { loadConfig } from "./config.js";
import { localDateString, validateDateString } from "./date.js";
import { readJson, writeJson } from "./files.js";
import { getPaths } from "./paths.js";
import { sanitizeSummary } from "./sanitize.js";

export async function buildWorklog({
  date = localDateString(),
  summaryFile,
  reviewed = false,
  env = process.env
} = {}) {
  validateDateString(date);
  const config = await loadConfig(env);
  const activities = await loadActivities(date, env);
  const aggregate = aggregateActivities(activities);

  let worklog;
  if (summaryFile) {
    if (config.privacyMode !== PRIVACY_MODES.REVIEWED_SUMMARY) {
      throw new Error(
        "Summary sharing is disabled. Run 'mogako privacy reviewed-summary' first."
      );
    }
    if (!reviewed) {
      throw new Error("Reviewed summary requires the --reviewed flag.");
    }
    worklog = sanitizeSummary(await readJson(path.resolve(summaryFile)));
  }

  const recordMode = worklog
    ? PRIVACY_MODES.REVIEWED_SUMMARY
    : PRIVACY_MODES.METADATA_ONLY;

  return {
    schemaVersion: WORKLOG_SCHEMA_VERSION,
    recordId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    date,
    recordMode,
    focus: {
      seconds: aggregate.focusSeconds,
      sessionCount: aggregate.sessionCount
    },
    usage: {
      providers: aggregate.providers
    },
    contentShared: Boolean(worklog),
    ...(worklog ? { worklog } : {}),
    consent: {
      summarySharingEnabled:
        config.privacyMode === PRIVACY_MODES.REVIEWED_SUMMARY,
      reviewedBeforeSubmission: Boolean(worklog && reviewed)
    },
    delivery: {
      status: "LOCAL_OUTBOX_ONLY",
      automaticUpload: false
    }
  };
}

export async function writeWorklog(worklog, env = process.env) {
  const fileName = `${worklog.date}-${worklog.recordId}.json`;
  const filePath = path.join(getPaths(env).outbox, fileName);
  await writeJson(filePath, worklog);
  return filePath;
}
