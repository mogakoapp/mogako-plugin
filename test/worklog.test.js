import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { recordActivity } from "../src/activity.js";
import { initializeConfig, setPrivacyMode } from "../src/config.js";
import { writeJson } from "../src/files.js";
import { buildWorklog } from "../src/worklog.js";

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mogako-test-"));
  const env = { MOGAKO_HOME: directory };
  await initializeConfig({ env });
  await recordActivity(
    {
      provider: "codex",
      model: "test-model",
      focusSeconds: 1500,
      inputTokens: 100,
      outputTokens: 20
    },
    env
  );
  return { directory, env };
}

test("metadata worklog excludes content", async () => {
  const { env } = await fixture();
  const worklog = await buildWorklog({ env });
  assert.equal(worklog.recordMode, "METADATA_ONLY");
  assert.equal(worklog.contentShared, false);
  assert.equal("worklog" in worklog, false);
  assert.equal(worklog.focus.seconds, 1500);
  assert.equal(worklog.usage.providers[0].inputTokens, 100);
});

test("summary is rejected while metadata-only", async () => {
  const { directory, env } = await fixture();
  const summaryFile = path.join(directory, "summary.json");
  await writeJson(summaryFile, {
    title: "Test",
    summary: "Test summary"
  });
  await assert.rejects(
    () => buildWorklog({ env, summaryFile, reviewed: true }),
    /Summary sharing is disabled/u
  );
});

test("reviewed summary is sanitized and included", async () => {
  const { directory, env } = await fixture();
  await setPrivacyMode("reviewed-summary", env);
  const summaryFile = path.join(directory, "summary.json");
  await writeJson(summaryFile, {
    title: "Auth work",
    summary: "Contact dev@example.com and use OPENAI_API_KEY=secret-value",
    completed: ["Updated C:\\Users\\Kwon\\private\\Auth.java"],
    nextActions: [],
    blockers: []
  });
  const worklog = await buildWorklog({ env, summaryFile, reviewed: true });
  assert.equal(worklog.recordMode, "REVIEWED_SUMMARY");
  assert.equal(worklog.contentShared, true);
  assert.match(worklog.worklog.summary, /\[REDACTED_EMAIL\]/u);
  assert.match(worklog.worklog.summary, /\[REDACTED_ENV_SECRET\]/u);
  assert.match(worklog.worklog.completed[0], /\[REDACTED_LOCAL_PATH\]/u);
});

test("review flag is mandatory", async () => {
  const { directory, env } = await fixture();
  await setPrivacyMode("reviewed-summary", env);
  const summaryFile = path.join(directory, "summary.json");
  await writeJson(summaryFile, { title: "Test", summary: "Summary" });
  await assert.rejects(
    () => buildWorklog({ env, summaryFile }),
    /--reviewed/u
  );
});
