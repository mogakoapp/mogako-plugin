import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, pathExists } from "./files.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDirectory, "..");

const TARGETS = {
  codex: {
    source: path.join(packageRoot, "integrations", "codex", "mogako"),
    destination: path.join(os.homedir(), ".agents", "skills", "mogako")
  },
  "claude-code": {
    source: path.join(packageRoot, "integrations", "claude-code", "skills", "mogako"),
    destination: path.join(os.homedir(), ".claude", "skills", "mogako")
  },
  antigravity: {
    source: path.join(packageRoot, "integrations", "antigravity", "mogako"),
    destination: path.join(os.homedir(), ".gemini", "config", "skills", "mogako")
  },
  "antigravity-cli": {
    source: path.join(packageRoot, "integrations", "antigravity", "mogako"),
    destination: path.join(
      os.homedir(),
      ".gemini",
      "antigravity-cli",
      "skills",
      "mogako"
    )
  }
};

export function listInstallTargets() {
  return Object.keys(TARGETS);
}

export async function installTarget(target, { force = false } = {}) {
  const definition = TARGETS[target];
  if (!definition) {
    throw new Error(
      `Unknown target '${target}'. Use one of: ${listInstallTargets().join(", ")}.`
    );
  }

  if ((await pathExists(definition.destination)) && !force) {
    throw new Error(
      `${definition.destination} already exists. Re-run with --force to replace it.`
    );
  }

  if (force) {
    await fs.rm(definition.destination, { recursive: true, force: true });
  }
  await ensureDir(path.dirname(definition.destination));
  await fs.cp(definition.source, definition.destination, { recursive: true });
  return definition.destination;
}
