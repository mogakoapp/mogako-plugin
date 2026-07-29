import { DEFAULT_CONFIG, PRIVACY_MODES } from "./constants.js";
import { pathExists, readJson, writeJson } from "./files.js";
import { getPaths } from "./paths.js";

export function parsePrivacyMode(value) {
  const normalized = String(value || "")
    .trim()
    .replaceAll("_", "-")
    .toLowerCase();

  if (normalized === "metadata-only" || normalized === "metadata") {
    return PRIVACY_MODES.METADATA_ONLY;
  }
  if (normalized === "reviewed-summary" || normalized === "summary") {
    return PRIVACY_MODES.REVIEWED_SUMMARY;
  }

  throw new Error(
    "Privacy mode must be 'metadata-only' or 'reviewed-summary'."
  );
}

export function validateConfig(config) {
  if (!Object.values(PRIVACY_MODES).includes(config.privacyMode)) {
    throw new Error(`Unsupported privacy mode: ${config.privacyMode}`);
  }
  if (config.summaryReviewRequired !== true) {
    throw new Error("summaryReviewRequired must remain true in v0.1.");
  }
  if (config.automaticUpload !== false) {
    throw new Error("automaticUpload must remain false in v0.1.");
  }
  return config;
}

export async function loadConfig(env = process.env) {
  const { config: configPath } = getPaths(env);
  if (!(await pathExists(configPath))) {
    return { ...DEFAULT_CONFIG };
  }
  return validateConfig({ ...DEFAULT_CONFIG, ...(await readJson(configPath)) });
}

export async function saveConfig(config, env = process.env) {
  const { config: configPath } = getPaths(env);
  const validated = validateConfig(config);
  await writeJson(configPath, validated);
  return validated;
}

export async function initializeConfig({ mode, force = false, env = process.env } = {}) {
  const { config: configPath } = getPaths(env);
  if ((await pathExists(configPath)) && !force) {
    return loadConfig(env);
  }

  const config = {
    ...DEFAULT_CONFIG,
    privacyMode: mode ? parsePrivacyMode(mode) : DEFAULT_CONFIG.privacyMode
  };
  await saveConfig(config, env);
  return config;
}

export async function setPrivacyMode(mode, env = process.env) {
  const config = await loadConfig(env);
  config.privacyMode = parsePrivacyMode(mode);
  return saveConfig(config, env);
}
