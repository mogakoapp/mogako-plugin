---
name: mogako
description: Create or inspect a Mogako work checkpoint. Use only when the user explicitly asks to run Mogako, save the current coding progress, or check Mogako privacy settings.
---

# Mogako

1. Run `mogako status --json`. If unavailable, ask the user to install or link `mogako-plugin`; do not invent activity, model, or token usage.
2. For a reviewed checkpoint, prepare only this exact JSON shape from outcomes already stated in the current interaction:

```json
{
  "summary": "concise reviewed result",
  "completed": [],
  "nextActions": [],
  "blockers": []
}
```

3. Do not include title, raw prompts, source code, diffs, environment variables, credentials, personal data, absolute paths, remote URLs, customer data, provider, model, or token usage.
4. Show the summary input to the user. After the user approves preparing it, write it to a temporary JSON file.
5. Run `mogako checkpoint --summary-file <file> --repo <repository-root> --target antigravity --submit`.
6. The common CLI collects changed file names, excludes sensitive paths, creates an immutable outbox payload, displays the exact wire JSON and destination, and asks for final submission approval. Do not bypass that approval or call the backend directly.
7. Delete the temporary summary file after the command finishes. Report the payload path and the actual submission result. If the user declines final submission, report that the local immutable payload remains pending.
8. Never add automatic, startup, periodic, or session-end submission behavior.
