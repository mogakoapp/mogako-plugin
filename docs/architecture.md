# Architecture

## Goals

- One deterministic CLI shared by Claude Code, Codex, and Antigravity.
- Metadata-only behavior without asking an LLM to summarize.
- Optional reviewed summaries with a strict allowlist.
- No Mogako backend dependency until the worklog API contract is ready.

## Flow

```text
Agent skill or shell
        |
        v
Mogako CLI
  - config gate
  - activity aggregation
  - allowlist validation
  - redaction
        |
        v
Local outbox JSON
```

The agent integration is intentionally thin. It must never directly call the Mogako backend or construct a different payload schema.

## Local files

```text
~/.mogako/
├── config.json
├── activity/
│   └── YYYY-MM-DD.jsonl
└── outbox/
    └── YYYY-MM-DD-<uuid>.json
```

Set `MOGAKO_HOME` to override this path in tests or controlled environments.

## Future API transport

A later version can add `mogako submit <record>` after the Mogako backend exposes a device authorization flow and a write-only worklog endpoint. Automatic upload remains out of scope unless the user explicitly enables it in a future consent flow.
