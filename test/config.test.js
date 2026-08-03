import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initializeConfig, loadConfig, setPrivacyMode } from "../src/config.js";
import { PRIVACY_MODES } from "../src/constants.js";

async function temporaryEnv() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mogako-test-"));
  return { MOGAKO_HOME: directory };
}

test("initialization defaults to metadata-only and no upload", async () => {
  const env = await temporaryEnv();
  const config = await initializeConfig({ env });
  assert.equal(config.privacyMode, PRIVACY_MODES.METADATA_ONLY);
  assert.equal(config.summaryReviewRequired, true);
  assert.equal(config.automaticUpload, false);
  assert.equal(config.apiBaseUrl, "https://api.mogako.xyz/api/v1/");
  assert.deepEqual(await loadConfig(env), config);
});

test("privacy mode can be explicitly changed", async () => {
  const env = await temporaryEnv();
  await initializeConfig({ env });
  const config = await setPrivacyMode("reviewed-summary", env);
  assert.equal(config.privacyMode, PRIVACY_MODES.REVIEWED_SUMMARY);
});
