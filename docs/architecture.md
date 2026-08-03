# Architecture

## Goals

- One deterministic CLI shared by Claude Code, Codex, Antigravity, and shell users.
- Thin integrations that never invent their own payload or transport.
- Schema v1 compatibility during migration.
- Reviewed immutable checkpoint schema v2 for same-day append.
- Explicit preview and user approval before every network submission.
- No transcript, code, diff, absolute path, model, provider, or token usage in schema v2.

The shared schema v2 contract is documented in [worklog-checkpoint-v2.md](./worklog-checkpoint-v2.md).

## Component Flow

```text
Claude Code / Codex / Antigravity / shell
                    |
                    v
Thin integration adapter
- prepares reviewed summary-file input
- chooses target identifier only
                    |
                    v
Mogako CLI common checkpoint command
- redacts secrets
- maps sourceClient
- validates exact v2 fields and limits
- calculates generatedAt/timeZoneId/localDate
- collects Git status path names only
- excludes sensitive paths
- creates immutable payload and delivery sidecar
- prints exact JSON preview
                    |
                    v
Local outbox
                    |
          explicit user approval
                    |
                    v
Shared transport
- schema v1 daily endpoint
- schema v2 checkpoint endpoint
                    |
                    v
Mogako backend
```

Every integration calls the same common checkpoint command. It may not contain its own schema object or call the backend directly.

## Responsibility Boundaries

### Integration adapters

Adapters may:

- prepare the current reviewed work result using the exact summary-file input
- call the common CLI
- identify the integration target

Adapters must not:

- construct a separate JSON schema or wire payload
- create their own UUID, timestamp, timezone, or local date
- collect changed files
- read file contents or diffs
- call the Mogako backend directly
- handle device tokens
- submit without the CLI preview and approval gate
- install automatic, startup, periodic, or session-end submit hooks

### Common CLI

The common CLI owns:

- schema v1 and v2 validation
- v2 summary-file redaction and strict validation
- source-client mapping
- privacy allowlists
- safe changed-file collection
- immutable payload persistence
- atomic delivery sidecar updates
- exact JSON preview
- user approval
- write-only device-token transport
- retry and delivery status

### Mogako backend

The backend owns:

- device connection and token validation
- immutable checkpoint persistence
- idempotency by user and source record ID
- timezone and path defense-in-depth validation
- legacy v1 checkpoint bridge
- daily projection and mobile timeline responses

## Source Client Mapping

```text
claude-code       -> CLAUDE_CODE
codex             -> CODEX
antigravity       -> ANTIGRAVITY
antigravity-cli   -> ANTIGRAVITY
manual            -> MANUAL_CLI
target omitted    -> MANUAL_CLI
```

`sourceClient` is display provenance only. It is never a security authority.

## Schema v2 Summary Input

The common checkpoint command accepts an exact summary-file object:

```json
{
  "summary": "required reviewed work summary",
  "completed": [],
  "nextActions": [],
  "blockers": []
}
```

All four fields are required. `title` and unknown fields are rejected. The CLI keeps existing secret redaction, then checks trim state and v2 limits without using schema v1 truncation.

## Local Files

```text
~/.mogako/
├── config.json
├── connection.json
├── activity/
│   └── YYYY-MM-DD.jsonl
└── outbox/
    ├── <sourceRecordId>.json
    └── <sourceRecordId>.delivery.json
```

Set `MOGAKO_HOME` to override this path in tests or controlled environments.

The payload file is created once and is never changed after creation. Delivery state is stored only in the sidecar:

```json
{
  "status": "PENDING",
  "attemptCount": 0,
  "lastErrorCode": null,
  "updatedAt": "2026-08-03T06:20:00Z"
}
```

Allowed delivery states:

```text
PENDING
SUBMITTING
DELIVERED
FAILED_RETRYABLE
FAILED_FINAL
```

A retry keeps the original payload bytes and `sourceRecordId`. Sidecars and logs must not copy the payload body, device token, or API error body.

## Shared Transport

Both schemas use the existing connection file and authorization scheme:

```text
Authorization: Worklog <device-token>
```

Dispatch:

```text
schema v1 -> PUT /api/v1/worklog-imports/daily/{date}
schema v2 -> POST /api/v1/worklog-imports/checkpoints
```

Schema v1 `wrap` and `submit` remain available during migration. Schema v2 `CREATED` and `UNCHANGED` are both successful delivery results.

## Schema Compatibility

### Schema v1

- existing metadata-only and reviewed-summary flow
- provider/model/token fields may exist in legacy local records
- retained temporarily for compatibility
- may continue to use daily replacement semantics
- not used as the source for new reviewed checkpoint cards after checkpoint projection launches

### Schema v2

- reviewed checkpoint only
- same-day append instead of daily replacement
- common payload for every supported client
- exact 11 required wire fields
- includes `sourceClient`
- excludes provider, model and token usage
- submits to `/api/v1/worklog-imports/checkpoints`

The plugin must not infer a legacy source client from v1 provider or model values. Backend `LEGACY_METADATA` records remain countable timeline entries but do not provide representative summary or summary/list content.

## Privacy and Changed-File Collection

The only Git command used for changed files is:

```text
git status --porcelain=v1 -z --untracked-files=all
```

The CLI reads NUL-delimited path fields only. For rename/copy entries it consumes both path fields and keeps the destination path. It does not call `git diff`, inspect file bodies, or read Git remote URLs.

The collector normalizes repository-relative paths to `/`, excludes sensitive patterns, and rejects absolute, drive, UNC, `.`, `..`, empty-segment, and control-character paths. Limits are 100 paths and 240 characters per path; values are rejected rather than truncated.

Network submission occurs only after the exact outgoing JSON is shown and the user approves it. `--yes` may only represent a user's explicit action in the same interaction. Automatic upload, periodic upload and session-end upload remain out of scope.

## Locked Limits

```text
summary: 1..1000
completed: 0..20 items, each 1..300
nextActions: 0..20 items, each 1..300
blockers: 0..20 items, each 1..300
changedFiles: 0..100 paths, each 1..240
timeZoneId: 1..64
future generatedAt skew: 5 minutes
additionalProperties: false
```

These values must remain identical in the plugin JSON Schema, fixtures, Mogako OpenAPI, backend DTO validation, and cross-repository tests.

## Contract Change Rule

The plugin JSON Schema, fixtures and this architecture must remain aligned with the Mogako backend spec and OpenAPI contract.

When a field, enum, limit, summary input, or authorization scheme changes:

1. update the shared design documents in both repositories
2. update backend contract tests and OpenAPI
3. update plugin JSON Schema, fixtures and validator tests
4. verify that plugin fixtures deserialize without translation on the backend
5. verify that the obsolete contract string no longer exists

Do not merge a contract change in only one repository.
