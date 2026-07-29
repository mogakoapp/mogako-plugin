---
name: mogako
description: Close or inspect a Mogako coding session. Use only when the user explicitly invokes $mogako, asks to save today's coding activity, create a Mogako worklog, or inspect Mogako privacy settings.
---

# Mogako

1. Run `mogako status --json`. If unavailable, ask the user to install or link `mogako-plugin`; do not invent activity or token usage.
2. If `privacyMode` is `METADATA_ONLY`, do not read or summarize code, prompts, terminal output, file names, repository names, or paths. Run `mogako wrap` and return its local outbox path.
3. If `privacyMode` is `REVIEWED_SUMMARY`, create only `title`, `summary`, `completed`, `nextActions`, and `blockers` from work already described in this session.
4. Exclude raw prompts, code, diffs, environment variables, credentials, personal data, absolute paths, remote URLs, and customer data.
5. Show the exact JSON and obtain explicit approval before writing it.
6. After approval, write it to a temporary JSON file, run `mogako wrap --summary-file <file> --reviewed`, and delete the temporary file.
7. Version 0.1 creates a local outbox record only; never claim that the record was uploaded.
