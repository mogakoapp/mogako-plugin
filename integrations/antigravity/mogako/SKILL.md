---
name: mogako
description: Close or inspect a Mogako coding session. Use only when the user explicitly asks to run Mogako, save today's coding activity, create a worklog, or check Mogako privacy settings.
---

# Mogako

1. Run `mogako status --json`. If the command is unavailable, ask the user to install or link `mogako-plugin`; never fabricate activity or token data.
2. In `METADATA_ONLY`, do not inspect or summarize code, prompts, terminal output, file names, repository names, or paths. Run `mogako wrap` and show the local outbox path.
3. In `REVIEWED_SUMMARY`, generate only `title`, `summary`, `completed`, `nextActions`, and `blockers` from the current session's already stated outcomes.
4. Never include raw prompts, code, diffs, secrets, personal data, absolute paths, repository URLs, or customer data.
5. Display the exact JSON and require explicit approval before writing it.
6. After approval, write a temporary JSON file, run `mogako wrap --summary-file <file> --reviewed`, then remove the temporary file.
7. Version 0.1 is local-only. Do not say the worklog was uploaded.
