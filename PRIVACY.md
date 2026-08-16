# Privacy model

Mogako Plugin follows data minimization, local-first storage, and explicit approval. These rules describe the implemented CLI contracts; pattern redaction is defense in depth, not a substitute for human review.

## Checkpoint v2: default AI integration contract

The `mogako checkpoint` command creates a v2 payload. Its root fields are exactly:

- `schemaVersion`
- `sourceRecordId`
- `sourceClient`
- `generatedAt`
- `timeZoneId`
- `localDate`
- `summary`
- `completed`
- `changedFiles`
- `nextActions`
- `blockers`

The summary input file must contain exactly these four fields, with no `title` or extension field:

```json
{
  "summary": "Reviewed work summary",
  "completed": ["Completed item"],
  "nextActions": ["Next item"],
  "blockers": []
}
```

The validator requires a non-empty `summary`, at most 20 items in each list, at most 300 characters per list item, at most 1,000 characters in the summary, and at most 100 changed-file paths. Changed-file paths must be repository-relative, use `/`, contain no `.` or `..` segments, and be at most 240 characters. Absolute paths, UNC paths, control characters, and sensitive paths are rejected or excluded.

The v2 path does not collect or submit source code, prompts, full AI responses, file contents, diffs, Git remote URLs, repository addresses, terminal output, environment values, device tokens, provider/model labels, or token counters. It sends only the validated summary fields and safe changed-file paths.

Known API-key, GitHub-token, AWS-key, JWT, environment-secret, local-path, and email patterns are redacted in summary text before validation. Users must still inspect the exact preview because pattern filtering cannot identify every secret.

## Local outbox and approval boundary

Automatic upload and automatic submission are disabled.

`mogako checkpoint` writes an immutable payload and a delivery sidecar under `~/.mogako/outbox/` before any submission. It prints the exact checkpoint JSON, payload path, delivery path, destination, and excluded-path count. Without `--submit`, it never makes a network request.

With `--submit`, an interactive terminal must confirm the exact payload. A non-interactive process must pass `--yes`; use that flag only after a separate user approval. `--yes` does not skip checkpoint validation, preview generation, or outbox creation.

```bash
mogako checkpoint --summary-file ./summary.json --repo . --target codex --submit
mogako checkpoint --summary-file ./summary.json --repo . --target codex --submit --yes
```

Cancellation leaves the immutable payload and sidecar unchanged and makes no request. Local validation failures are recorded as final failures when a sidecar exists. Network failures, timeouts, rate limits, and server errors keep the payload for retry and are recorded as retryable failures. `mogako submit <payload-path>` validates the saved payload and submits that exact file; a successful retry marks its sidecar delivered.

## Write-only connection

The CLI exchanges an 8-character, one-time code from the Mogako app for a revocable device credential. The app code expires after 10 minutes and can be exchanged once. The credential:

- has `worklog:write` scope;
- cannot read the user's profile or worklog history;
- is never printed by the CLI;
- is stored only in `~/.mogako/connection.json`;
- uses file mode `0600` and parent directory mode `0700` where the operating system supports it;
- can be invalidated from the app's connected-device screen.

`mogako disconnect` removes only the local connection file. It does not silently call an unrelated API or delete outbox records. Revoke the server credential in the app when immediate invalidation is required. Never paste the connection code or device token into an LLM, chat, issue, or log.

## Legacy Worklog v1 compatibility

The `record` and `wrap` commands remain for existing v1 consumers. They use a different payload contract:

- `METADATA_ONLY` records may include date, record ID, focus/session counts, provider/model labels, and user-supplied token counters, but no worklog content.
- `REVIEWED_SUMMARY` records require `mogako privacy reviewed-summary` and `mogako wrap --reviewed`; their worklog fields are `title`, `summary`, `completed`, `nextActions`, and `blockers`.
- v1 unknown fields are rejected, and known secret, path, and email patterns are redacted before the record is written.
- v1 submission still requires an explicit `mogako wrap --submit`, `mogako wrap --submit --yes`, or `mogako submit <record.json>` action.

Do not put v1 `title`, provider/model, or token fields into a v2 checkpoint summary. New Agent Skill integrations should use `mogako checkpoint`.

## Local deletion

Delete the local data directory to remove configuration, activity metadata, connection information, payloads, and delivery sidecars:

```bash
rm -rf ~/.mogako
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force "$HOME\\.mogako"
```
