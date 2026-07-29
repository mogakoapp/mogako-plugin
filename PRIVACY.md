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

## No network delivery in v0.1

Version 0.1 never uploads automatically. Generated records are stored under `~/.mogako/outbox` (or `%USERPROFILE%\\.mogako\\outbox` on Windows) with file permissions limited where the operating system supports them.

The future Mogako API transport must remain opt-in and use a dedicated, revocable device token with worklog-write-only scope.

## Local deletion

Delete the local data directory to remove configuration, activity metadata, and outbox records:

```bash
rm -rf ~/.mogako
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force "$HOME\\.mogako"
```
