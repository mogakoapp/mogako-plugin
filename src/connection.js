import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./files.js";
import { getPaths } from "./paths.js";
import { normalizeApiBaseUrl } from "./config.js";

const CONNECTION_FIELDS = new Set(["apiBaseUrl", "deviceId", "token"]);

export function validateConnection(connection) {
  if (!connection || typeof connection !== "object" || Array.isArray(connection)) {
    throw new Error("Invalid Mogako connection file.");
  }
  const unknown = Object.keys(connection).filter((key) => !CONNECTION_FIELDS.has(key));
  if (unknown.length > 0) {
    throw new Error("Invalid Mogako connection file.");
  }
  const apiBaseUrl = normalizeApiBaseUrl(connection.apiBaseUrl);
  const deviceId = requiredString(connection.deviceId, "deviceId");
  const token = requiredString(connection.token, "token");
  return { apiBaseUrl, deviceId, token };
}

export async function saveConnection(connection, env = process.env) {
  const validated = validateConnection(connection);
  const file = getPaths(env).connection;
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await chmodBestEffort(path.dirname(file), 0o700);
  await fs.writeFile(file, `${JSON.stringify(validated, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await chmodBestEffort(file, 0o600);
  return publicConnection(validated);
}

export async function loadConnection(env = process.env) {
  const file = getPaths(env).connection;
  if (!(await pathExists(file))) {
    throw new Error("Mogako is not connected. Run 'mogako connect <code>' first.");
  }
  const content = await fs.readFile(file, "utf8");
  let value;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error("Invalid Mogako connection file.");
  }
  return validateConnection(value);
}

export async function disconnect(env = process.env) {
  const file = getPaths(env).connection;
  try {
    await fs.unlink(file);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export function publicConnection(connection) {
  return {
    apiBaseUrl: connection.apiBaseUrl,
    deviceId: connection.deviceId
  };
}

async function chmodBestEffort(target, mode) {
  try {
    await fs.chmod(target, mode);
  } catch (error) {
    if (process.platform === "win32" && ["EPERM", "ENOSYS"].includes(error?.code)) {
      return;
    }
    throw error;
  }
}

function requiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid Mogako connection ${field}.`);
  }
  return value.trim();
}
