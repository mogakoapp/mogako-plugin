import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../src/cli.js";
import { getPaths } from "../src/paths.js";

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mogako-cli-"));
  const logs = [];
  const errors = [];
  return {
    directory,
    env: { MOGAKO_HOME: directory },
    logs,
    io: {
      isInteractive: false,
      log(value) {
        logs.push(String(value));
      },
      error(value) {
        errors.push(String(value));
      },
      async confirm() {
        throw new Error("confirm should not be called in non-interactive mode");
      }
    }
  };
}

test("connect command never prints the returned device token", async () => {
  const { env, logs, io } = await fixture();
  const token = "cli-private-device-token";

  await runCli(
    [
      "connect",
      "ABCD2345",
      "--device-name",
      "CLI Test",
      "--api-base-url",
      "http://localhost:8080/api/v1/",
      "--json"
    ],
    {
      env,
      io,
      fetch: async () => new Response(JSON.stringify({
        deviceId: "wkd_cli",
        token,
        scope: "worklog:write"
      }), { status: 200 })
    }
  );

  assert.match(logs.join("\n"), /wkd_cli/u);
  assert.equal(logs.join("\n").includes(token), false);
});

test("non-interactive wrap submit requires yes and preserves the outbox", async () => {
  const { env, logs, io } = await fixture();
  let fetched = false;

  await assert.rejects(
    () => runCli(["wrap", "--submit"], {
      env,
      io,
      fetch: async () => {
        fetched = true;
        throw new Error("must not fetch without explicit approval");
      }
    }),
    /requires an interactive confirmation or an explicit --yes/u
  );

  const outbox = await fs.readdir(getPaths(env).outbox);
  assert.equal(outbox.length, 1);
  assert.equal(fetched, false);
  assert.match(logs.join("\n"), /METADATA_ONLY/u);
  assert.match(logs.join("\n"), /"record"/u);
});

test("interactive rejection preserves the exact preview and skips network", async () => {
  const { env, logs, io } = await fixture();
  io.isInteractive = true;
  io.confirm = async () => false;
  let fetched = false;

  await runCli(["wrap", "--submit"], {
    env,
    io,
    fetch: async () => {
      fetched = true;
      throw new Error("must not fetch after rejection");
    }
  });

  const outbox = await fs.readdir(getPaths(env).outbox);
  assert.equal(outbox.length, 1);
  assert.equal(fetched, false);
  assert.match(logs.at(-1), /Submission cancelled/u);
});
