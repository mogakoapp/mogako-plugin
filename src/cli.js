#!/usr/bin/env node
import { recordActivity, loadActivities, aggregateActivities } from "./activity.js";
import { parseArgs } from "./args.js";
import {
  initializeConfig,
  loadConfig,
  setPrivacyMode
} from "./config.js";
import { localDateString, validateDateString } from "./date.js";
import { installTarget, listInstallTargets } from "./install.js";
import { getPaths } from "./paths.js";
import { buildWorklog, writeWorklog } from "./worklog.js";

const HELP = `Mogako CLI v0.1

Usage:
  mogako init [--mode metadata-only|reviewed-summary] [--force]
  mogako privacy [metadata-only|reviewed-summary]
  mogako record --provider <name> [--model <name>] [--focus-seconds <n>]
                [--input-tokens <n>] [--output-tokens <n>]
                [--cached-input-tokens <n>]
  mogako status [--date YYYY-MM-DD] [--json]
  mogako wrap [--date YYYY-MM-DD] [--summary-file <path> --reviewed]
              [--dry-run]
  mogako install --target ${listInstallTargets().join("|")} [--force]

Privacy defaults:
  - METADATA_ONLY
  - no automatic upload
  - reviewed summary required
  - v0.1 writes JSON only to the local outbox
`;

function output(value, json = false) {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    console.log(value);
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

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0] || "help";

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return;

    case "init": {
      const config = await initializeConfig({
        mode: flags.mode,
        force: Boolean(flags.force)
      });
      output(
        {
          message: "Mogako initialized.",
          config,
          localData: getPaths().home
        },
        Boolean(flags.json)
      );
      return;
    }

    case "privacy": {
      const requestedMode = positional[1];
      if (!requestedMode) {
        const config = await loadConfig();
        output(config, Boolean(flags.json));
        return;
      }
      const config = await setPrivacyMode(requestedMode);
      output(config, Boolean(flags.json));
      return;
    }

    case "record": {
      if (!flags.provider) {
        throw new Error("record requires --provider.");
      }
      const activity = await recordActivity({
        provider: flags.provider,
        model: flags.model,
        focusSeconds: flags["focus-seconds"],
        inputTokens: flags["input-tokens"],
        outputTokens: flags["output-tokens"],
        cachedInputTokens: flags["cached-input-tokens"]
      });
      output(activity, Boolean(flags.json));
      return;
    }

    case "status": {
      const date = validateDateString(flags.date || localDateString());
      const config = await loadConfig();
      const aggregate = aggregateActivities(await loadActivities(date));
      const status = { date, config, aggregate, paths: getPaths() };
      output(
        flags.json ? status : formatStatus(status),
        Boolean(flags.json)
      );
      return;
    }

    case "wrap": {
      const worklog = await buildWorklog({
        date: flags.date || localDateString(),
        summaryFile: flags["summary-file"],
        reviewed: Boolean(flags.reviewed)
      });
      if (flags["dry-run"]) {
        output(worklog, true);
        return;
      }
      const filePath = await writeWorklog(worklog);
      output({ filePath, worklog }, Boolean(flags.json));
      return;
    }

    case "install": {
      const target = flags.target;
      if (!target) {
        throw new Error(`install requires --target (${listInstallTargets().join(", ")}).`);
      }
      const destination = await installTarget(String(target), {
        force: Boolean(flags.force)
      });
      output({ target, destination }, Boolean(flags.json));
      return;
    }

    default:
      throw new Error(`Unknown command '${command}'.\n\n${HELP}`);
  }
}

main().catch((error) => {
  console.error(`mogako: ${error.message}`);
  process.exitCode = 1;
});
