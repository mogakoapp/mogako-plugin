import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validateChangedFilePath } from "./checkpoint-validation.js";

const execFileAsync = promisify(execFile);

export async function collectChangedFiles(repositoryRoot) {
  if (typeof repositoryRoot !== "string" || repositoryRoot.trim() === "") {
    throw new Error("repositoryRoot is required.");
  }
  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      "git",
      [
        "-C",
        repositoryRoot,
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all"
      ],
      { encoding: "buffer", maxBuffer: 1024 * 1024 }
    ));
  } catch (error) {
    throw new Error(`Unable to collect changed files: ${error.message}`);
  }
  return parsePorcelainV1Z(stdout);
}

export function parsePorcelainV1Z(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Git status output must be a Buffer.");
  }
  const fields = buffer.toString("utf8").split("\0");
  if (fields.at(-1) === "") fields.pop();

  const included = [];
  const seen = new Set();
  let excludedCount = 0;

  for (let index = 0; index < fields.length; index += 1) {
    const entry = fields[index];
    if (entry.length < 4 || entry[2] !== " ") {
      throw new Error("Malformed git status --porcelain=v1 -z output.");
    }
    const status = entry.slice(0, 2);
    const destination = entry.slice(3);
    if (isRenameOrCopy(status)) {
      index += 1;
      if (index >= fields.length) {
        throw new Error("Malformed rename/copy entry in git status output.");
      }
    }

    const normalized = destination.replaceAll("\\", "/");
    if (normalized.length > 240) {
      throw new Error("changed file path must be at most 240 characters.");
    }
    try {
      validateChangedFilePath(normalized);
    } catch {
      excludedCount += 1;
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      included.push(normalized);
    }
  }

  if (included.length > 100) {
    throw new Error("changedFiles must contain at most 100 paths.");
  }
  return { included, excludedCount };
}

function isRenameOrCopy(status) {
  return status.includes("R") || status.includes("C");
}
