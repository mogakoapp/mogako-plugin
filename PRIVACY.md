# Privacy model

Mogako Plugin is designed around data minimization.

## Default: `METADATA_ONLY`

The initial configuration does not allow a work summary. A record can contain only:

- date and generated record identifier;
- focused seconds and session count;
- provider and model labels supplied by the host or user;
- token counters supplied by the host or user.

It does not collect source code, prompts, answers, file names, paths, repository names, Git remotes, diffs, terminal output, environment variables, or customer data.

## Optional: `REVIEWED_SUMMARY`

The user must explicitly enable summary sharing:

```bash
mogako privacy reviewed-summary
```

A summary still cannot be included unless `mogako wrap` receives both an allowlisted summary file and `--reviewed`. The accepted fields are:

- `title`
- `summary`
- `completed`
- `nextActions`
- `blockers`

Unknown fields are rejected. Known secret, path, and email patterns are redacted as defense in depth. Pattern filtering is not a guarantee, so the user must review the exact summary before it is processed.

## Explicit network delivery only

Automatic upload remains disabled. Network delivery occurs only after one of these explicit user actions:

```bash
mogako submit <record.json>
mogako wrap --submit
mogako wrap --submit --yes
```

`wrap --submit` prints the exact privacy mode and JSON record before sending. Interactive use requires affirmative confirmation unless `--yes` is supplied. Non-interactive use requires `--yes`. A rejected confirmation, validation failure, network failure, or server failure leaves the local outbox file unchanged.

## Dedicated write-only connection

The CLI exchanges a short, one-time code from the Mogako app for a revocable device credential. The credential:

- has worklog-write-only scope;
- cannot read the user's profile or worklog history;
- is never printed by the CLI;
- is stored only in `~/.mogako/connection.json`;
- uses file mode `0600` and parent directory mode `0700` on Unix-like systems;
- can be invalidated from the Mogako app's connected-device screen.

`mogako disconnect` removes only the local connection file. It does not silently call unrelated APIs or delete outbox records. Users should revoke the device in the app when the server credential must be invalidated immediately.

## Transport validation

Before submission, the CLI allowlists the Mogako Worklog v1 structure and rejects unknown fields. Raw prompts, answers, source code, diffs, file paths, repository URLs, terminal output, environment values, and arbitrary extension fields cannot be submitted through the supported transport.

API and network errors are reported without including the connection token. Sensitive keys in structured error details are redacted. The original outbox file remains available for inspection and safe retry.

## Local deletion

Delete the local data directory to remove configuration, activity metadata, connection information, and outbox records:

```bash
rm -rf ~/.mogako
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force "$HOME\\.mogako"
```
