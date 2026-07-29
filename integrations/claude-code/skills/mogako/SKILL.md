---
name: mogako
description: Close or inspect a Mogako coding session. Use only when the user explicitly asks to run Mogako, save today's coding activity, create a worklog, or check Mogako privacy settings.
disable-model-invocation: true
---

# Mogako

1. Run `mogako status --json`. If unavailable, ask the user to install or link `mogako-plugin`; do not invent activity or token usage.
2. When `privacyMode` is `METADATA_ONLY`, do not inspect, quote, or summarize source code, prompts, terminal output, file names, repository names, or paths. Run `mogako wrap` and report the local outbox path.
3. When `privacyMode` is `REVIEWED_SUMMARY`, prepare only this allowlisted JSON from work already described in the current session: `title`, `summary`, `completed`, `nextActions`, `blockers`.
4. Never include raw prompts, source code, diffs, environment variables, credentials, personal data, absolute paths, remote URLs, or customer data.
5. Show the exact summary JSON and ask the user to approve it. Do not write or wrap it before approval.
6. After approval, save the JSON to a temporary file, run `mogako wrap --summary-file <file> --reviewed`, then delete the temporary file.
7. Mogako v0.1 writes to a local outbox only. Never claim it was uploaded to the Mogako service.
