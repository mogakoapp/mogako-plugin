import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  disconnect,
  loadConnection,
  saveConnection
} from "../src/connection.js";
import { getPaths } from "../src/paths.js";

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mogako-connection-"));
  return { directory, env: { MOGAKO_HOME: directory } };
}

test("connection is stored privately and public result omits token", async () => {
  const { env } = await fixture();
  const connection = {
    apiBaseUrl: "http://localhost:8080/api/v1/",
    deviceId: "wkd_test",
    token: "private-device-token"
  };

  const publicValue = await saveConnection(connection, env);
  assert.deepEqual(publicValue, {
    apiBaseUrl: "http://localhost:8080/api/v1/",
    deviceId: "wkd_test"
  });
  assert.equal("token" in publicValue, false);
  assert.deepEqual(await loadConnection(env), connection);

  const raw = JSON.parse(await fs.readFile(getPaths(env).connection, "utf8"));
  assert.deepEqual(Object.keys(raw).sort(), ["apiBaseUrl", "deviceId", "token"]);

  if (process.platform !== "win32") {
    const homeMode = (await fs.stat(getPaths(env).home)).mode & 0o777;
    const fileMode = (await fs.stat(getPaths(env).connection)).mode & 0o777;
    assert.equal(homeMode, 0o700);
    assert.equal(fileMode, 0o600);
  }
});

test("disconnect removes only the local connection", async () => {
  const { env } = await fixture();
  await saveConnection(
    {
      apiBaseUrl: "https://api.mogako.app/api/v1/",
      deviceId: "wkd_disconnect",
      token: "private-device-token"
    },
    env
  );

  assert.equal(await disconnect(env), true);
  assert.equal(await disconnect(env), false);
  await assert.rejects(() => loadConnection(env), /not connected/u);
});

test("connection files reject additional fields", async () => {
  const { env } = await fixture();
  await assert.rejects(
    () => saveConnection(
      {
        apiBaseUrl: "https://api.mogako.app/api/v1/",
        deviceId: "wkd_invalid",
        token: "token",
        refreshToken: "must-not-be-stored"
      },
      env
    ),
    /Invalid Mogako connection file/u
  );
});
