const SOURCE_CLIENT_BY_TARGET = Object.freeze({
  codex: "CODEX",
  "claude-code": "CLAUDE_CODE",
  antigravity: "ANTIGRAVITY",
  "antigravity-cli": "ANTIGRAVITY",
  manual: "MANUAL_CLI"
});

export const SOURCE_CLIENTS = Object.freeze([
  "CODEX",
  "CLAUDE_CODE",
  "ANTIGRAVITY",
  "MANUAL_CLI"
]);

export function sourceClientForTarget(target) {
  if (target === undefined || target === null || target === "") {
    return "MANUAL_CLI";
  }
  const normalized = String(target).trim().toLowerCase();
  const sourceClient = SOURCE_CLIENT_BY_TARGET[normalized];
  if (!sourceClient) {
    throw new Error(`Unsupported checkpoint target: ${target}`);
  }
  return sourceClient;
}
