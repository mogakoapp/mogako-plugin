export const PRIVACY_MODES = Object.freeze({
  METADATA_ONLY: "METADATA_ONLY",
  REVIEWED_SUMMARY: "REVIEWED_SUMMARY"
});

export const CONFIG_VERSION = 1;
export const WORKLOG_SCHEMA_VERSION = "1.0";

export const DEFAULT_CONFIG = Object.freeze({
  schemaVersion: CONFIG_VERSION,
  privacyMode: PRIVACY_MODES.METADATA_ONLY,
  summaryReviewRequired: true,
  automaticUpload: false
});
