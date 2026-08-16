#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { recordActivity, loadActivities, aggregateActivities } from "./activity.js";
import { booleanFlag, parseArgs, stringFlag } from "./args.js";
import { buildCheckpoint } from "./checkpoint.js";
import { collectChangedFiles } from "./changed-files.js";
import {
  initializeConfig,
  loadConfig,
  setPrivacyMode
} from "./config.js";
import { disconnect } from "./connection.js";
import { localDateString, validateDateString } from "./date.js";
import { readJson } from "./files.js";
import { installTarget, listInstallTargets } from "./install.js";
import { writeCheckpointOutbox } from "./outbox.js";
import { getPaths } from "./paths.js";
import { connect, submitCheckpoint, submitRecord } from "./transport.js";
import { buildWorklog, writeWorklog } from "./worklog.js";

const HELP = `Mogako CLI v0.1

Usage:
  mogako init [--mode metadata-only|reviewed-summary] [--force]
  mogako privacy [metadata-only|reviewed-summary]
  mogako connect <code> [--device-name <name>] [--api-base-url <url>]
  mogako disconnect
  mogako record --provider <name> [--model <name>] [--focus-seconds <n>]
                [--input-tokens <n>] [--output-tokens <n>]
                [--cached-input-tokens <n>]
  mogako status [--date YYYY-MM-DD] [--json]
  mogako wrap [--date YYYY-MM-DD] [--summary-file <path> --reviewed]
              [--dry-run] [--submit] [--yes]
  mogako checkpoint [--summary-file <path> | --summary "<text>"] [--repo <root>]
                    [--target codex|claude-code|antigravity|antigravity-cli|manual]
                    [--submit] [--yes]
  mogako submit <record.json>
  mogako install --target ${listInstallTargets().join("|")} [--force]

Privacy defaults:
  - METADATA_ONLY
  - no automatic upload
  - reviewed summary required
  - records stay in the local outbox until an explicit submit command
`;

function output(value, json, io) {
  if (json) {
    io.log(JSON.stringify(value, null, 2));
  } else {
    io.log(value);
  }
}

function formatStatus({ config, aggregate, date, paths }) {
  const lines = [
    `Date: ${date}`,
    `Privacy mode: ${config.privacyMode}`,
    `Automatic upload: ${config.automaticUpload ? "ON" : "OFF"}`,
    `Recorded sessions: ${aggregate.sessionCount}`,
    `Focused seconds: ${aggregate.focusSeconds}`,
    `Local data: ${paths.home}`
  ];
  if (aggregate.providers.length > 0) {
    lines.push("Providers:");
    for (const provider of aggregate.providers) {
      const tokens =
        provider.inputTokens !== undefined
          ? `, input ${provider.inputTokens}, output ${provider.outputTokens}`
          : "";
      lines.push(
        `  - ${provider.provider}${provider.model ? `/${provider.model}` : ""}: ${provider.sessionCount} session(s)${tokens}`
      );
    }
  }
  return lines.join("\n");
}

export async function runCli(
  argv,
  {
    env = process.env,
    fetch = globalThis.fetch,
    io = createDefaultIo()
  } = {}
) {
  const { positional, flags } = parseArgs(argv);
  const command = positional[0] || "help";

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      io.log(HELP);
      return;

    case "init": {
      const config = await initializeConfig({
        mode: flags.mode,
        force: booleanFlag(flags, "force"),
        env
      });
      output(
        {
          message: "Mogako initialized.",
          config,
          localData: getPaths(env).home
        },
        booleanFlag(flags, "json"),
        io
      );
      return;
    }

    case "privacy": {
      const requestedMode = positional[1];
      if (!requestedMode) {
        const config = await loadConfig(env);
        output(config, booleanFlag(flags, "json"), io);
        return;
      }
      const config = await setPrivacyMode(requestedMode, env);
      output(config, booleanFlag(flags, "json"), io);
      return;
    }

    case "connect": {
      const code = positional[1] || stringFlag(flags, "code");
      if (!code) {
        throw new Error("connect requires a one-time code from the Mogako app.");
      }
      const connection = await connect(code, {
        env,
        fetch,
        apiBaseUrl: stringFlag(flags, "api-base-url"),
        deviceName: stringFlag(flags, "device-name")
      });
      output(
        { message: "Mogako coding tool connected.", ...connection },
        booleanFlag(flags, "json"),
        io
      );
      return;
    }

    case "disconnect": {
      const removed = await disconnect(env);
      output(
        {
          message: removed
            ? "Local Mogako connection removed. Revoke the device in the app to invalidate it on the server."
            : "No local Mogako connection was present.",
          connected: false
        },
        booleanFlag(flags, "json"),
        io
      );
      return;
    }

    case "record": {
      if (!flags.provider) {
        throw new Error("record requires --provider.");
      }
      const activity = await recordActivity(
        {
          provider: flags.provider,
          model: flags.model,
          focusSeconds: flags["focus-seconds"],
          inputTokens: flags["input-tokens"],
          outputTokens: flags["output-tokens"],
          cachedInputTokens: flags["cached-input-tokens"]
        },
        env
      );
      output(activity, booleanFlag(flags, "json"), io);
      return;
    }

    case "status": {
      const date = validateDateString(flags.date || localDateString());
      const config = await loadConfig(env);
      const aggregate = aggregateActivities(await loadActivities(date, env));
      const status = { date, config, aggregate, paths: getPaths(env) };
      output(
        flags.json ? status : formatStatus(status),
        booleanFlag(flags, "json"),
        io
      );
      return;
    }

    case "wrap": {
      const worklog = await buildWorklog({
        date: flags.date || localDateString(),
        summaryFile: flags["summary-file"],
        reviewed: booleanFlag(flags, "reviewed"),
        env
      });
      if (booleanFlag(flags, "dry-run")) {
        output(worklog, true, io);
        return;
      }
      const filePath = await writeWorklog(worklog, env);
      const shouldSubmit = booleanFlag(flags, "submit");
      if (!shouldSubmit) {
        output({ filePath, worklog }, booleanFlag(flags, "json"), io);
        return;
      }

      output(
        {
          filePath,
          privacyMode: worklog.recordMode,
          record: worklog
        },
        true,
        io
      );
      let approved = booleanFlag(flags, "yes");
      if (!approved) {
        if (!io.isInteractive) {
          throw new Error(
            "wrap --submit requires an interactive confirmation or an explicit --yes flag. The outbox file was preserved."
          );
        }
        approved = await io.confirm(
          `Submit this exact ${worklog.recordMode} record to Mogako? [y/N] `
        );
      }
      if (!approved) {
        output("Submission cancelled. The outbox file was preserved.", false, io);
        return;
      }
      const submission = await submitRecord(filePath, { env, fetch });
      output({ filePath, submission }, booleanFlag(flags, "json"), io);
      return;
    }

    case "checkpoint": {
      const summaryFile = stringFlag(flags, "summary-file");
      const inlineSummary = stringFlag(flags, "summary");
      if (!summaryFile && !inlineSummary) {
        throw new Error("checkpoint requires --summary-file or inline --summary.");
      }
      const repositoryRoot = stringFlag(flags, "repo") || process.cwd();
      const changedFilesResult = await collectChangedFiles(
        path.resolve(repositoryRoot)
      );
      const summaryInput = inlineSummary
        ? { summary: inlineSummary, completed: [], nextActions: [], blockers: [] }
        : undefined;
      const checkpoint = await buildCheckpoint({
        summaryFile,
        summaryInput,
        repositoryRoot,
        target: stringFlag(flags, "target"),
        reviewed: true,
        changedFilesResult
      });
      const { payloadPath, deliveryPath } = await writeCheckpointOutbox(
        checkpoint,
        { env }
      );
      const config = await loadConfig(env);
      const destination = new URL(
        "worklog-imports/checkpoints",
        config.apiBaseUrl
      ).toString();
      output(
        {
          payloadPath,
          deliveryPath,
          sourceClient: checkpoint.sourceClient,
          excludedPathCount: changedFilesResult.excludedCount,
          destination,
          checkpoint
        },
        true,
        io
      );

      if (!booleanFlag(flags, "submit")) {
        return;
      }
      let approved = booleanFlag(flags, "yes");
      if (!approved) {
        if (!io.isInteractive) {
          throw new Error(
            "checkpoint --submit requires interactive confirmation or explicit --yes. The immutable payload was preserved."
          );
        }
        approved = await io.confirm(
          `Submit this exact ${checkpoint.sourceClient} checkpoint to Mogako? [y/N] `
        );
      }
      if (!approved) {
        output(
          "Submission cancelled. The immutable payload and sidecar were preserved.",
          false,
          io
        );
        return;
      }
      const submission = await submitCheckpoint(payloadPath, { env, fetch });
      output(
        { payloadPath, deliveryPath, submission },
        booleanFlag(flags, "json"),
        io
      );
      return;
    }

    case "submit": {
      const filePath = positional[1] || stringFlag(flags, "file");
      if (!filePath) {
        throw new Error("submit requires a local worklog JSON path.");
      }
      const resolvedPath = path.resolve(filePath);
      const record = await readJson(resolvedPath);
      const submission = record.schemaVersion === 2
        ? await submitCheckpoint(resolvedPath, { env, fetch })
        : await submitRecord(resolvedPath, { env, fetch });
      output(
        { filePath: resolvedPath, submission },
        booleanFlag(flags, "json"),
        io
      );
      return;
    }

    case "install": {
      const target = flags.target;
      if (!target) {
        throw new Error(`install requires --target (${listInstallTargets().join(", ")}).`);
      }
      const destination = await installTarget(String(target), {
        force: booleanFlag(flags, "force")
      });
      output({ target, destination }, booleanFlag(flags, "json"), io);
      return;
    }

    default:
      throw new Error(`Unknown command '${command}'.\n\n${HELP}`);
  }
}

export function createDefaultIo() {
  return {
    isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    log(value) {
      console.log(value);
    },
    error(value) {
      console.error(value);
    },
    async confirm(message) {
      const readline = createInterface({
        input: process.stdin,
        output: process.stdout
      });
      try {
        const answer = await readline.question(message);
        return /^(y|yes)$/iu.test(answer.trim());
      } finally {
        readline.close();
      }
    }
  };
}

export function isSameCliEntrypoint(
  invokedPath,
  currentPath,
  resolvePath = fs.realpathSync.native
) {
  if (!invokedPath || !currentPath) return false;
  try {
    return resolvePath(path.resolve(invokedPath)) === resolvePath(path.resolve(currentPath));
  } catch {
    return false;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (isSameCliEntrypoint(process.argv[1], currentFile)) {
  const io = createDefaultIo();
  runCli(process.argv.slice(2), { io }).catch((error) => {
    io.error(`mogako: ${error.message}`);
    process.exitCode = 1;
  });
}
