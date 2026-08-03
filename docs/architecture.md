# Architecture

## Goals

- One deterministic CLI shared by Claude Code, Codex, Antigravity, and shell users.
- Thin integrations that never invent their own payload or transport.
- Metadata-only schema v1 compatibility during migration.
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
- chooses target identifier only
                    |
                    v
Mogako CLI
- maps sourceClient
- validates reviewed fields
- calculates generatedAt/timeZoneId/localDate
- collects Git status path names only
- excludes sensitive paths
- creates and previews outbox JSON
- manages submit and retry state
                    |
                    v
Local outbox
                    |
          explicit user approval
                    |
                    v
Mogako checkpoint API
```

## Responsibility Boundaries

### Integration adapters

Adapters may:

- prepare the current reviewed work result
- call the common CLI
- identify the integration target

Adapters must not:

- construct a separate JSON schema
- create their own UUID or date contract
- read file contents or diffs
- call the Mogako backend directly
- handle device tokens
- submit without the CLI approval gate

### Common CLI

The common CLI owns:

- schema v1 and v2 validation
- source-client mapping
- privacy allowlists
- safe changed-file collection
- local outbox persistence
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
- daily projection and mobile timeline responses

## Source Client Mapping

```text
claude-code       -> CLAUDE_CODE
codex             -> CODEX
antigravity       -> ANTIGRAVITY
antigravity-cli   -> ANTIGRAVITY
manual shell      -> MANUAL_CLI
```

`sourceClient` is display provenance only. It is never a security authority.

## Local Files

```text
~/.mogako/
├── config.json
├── connection.json
├── activity/
│   └── YYYY-MM-DD.jsonl
└── outbox/
    └── YYYY-MM-DD-<uuid>.json
```

Set `MOGAKO_HOME` to override this path in tests or controlled environments.

Outbox state is stored without replacing the payload identity:

```text
PENDING
SUBMITTING
DELIVERED
FAILED_RETRYABLE
FAILED_FINAL
```

A retry always keeps the original `sourceRecordId`.

## Schema Compatibility

### Schema v1

- existing metadata-only and reviewed-summary flow
- provider/model/token fields may exist in legacy local records
- retained temporarily for compatibility
- not used as the source for new checkpoint cards

### Schema v2

- reviewed checkpoint only
- same-day append instead of daily replacement
- common payload for every supported client
- includes `sourceClient`
- excludes provider, model and token usage
- submits to `/api/v1/worklog-imports/checkpoints`

The plugin must not infer a legacy source client from v1 provider or model values.

## Privacy and Collection

The only Git command used for changed files is:

```text
git status --porcelain=v1 -z
```

The CLI reads path fields only. It does not call `git diff`, inspect file bodies, or read Git remote URLs.

Network submission occurs only after the exact outgoing JSON is shown and the user approves it. Automatic upload, periodic upload and session-end upload remain out of scope.

## Contract Change Rule

The plugin JSON Schema, fixtures and this architecture must remain aligned with the Mogako backend spec and OpenAPI contract.

When a field, enum or limit changes:

1. update the shared design documents in both repositories
2. update backend contract tests
3. update plugin fixtures and validator tests
4. verify that one plugin fixture deserializes without translation on the backend

Do not merge a contract change in only one repository.
