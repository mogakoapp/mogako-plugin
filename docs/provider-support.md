# Provider support

All supported hosts use the same `mogako checkpoint` CLI contract. The host skill prepares a four-field summary, shows it to the user, and invokes the common CLI only after approval. No integration installs automatic hooks, calls the Mogako API directly, or submits without the common preview and approval boundary.

| Provider | Invocation | Installation target | Destination |
|---|---|---|---|
| Claude Code | `/mogako` | `claude-code` | `~/.claude/skills/mogako` |
| Codex CLI / IDE | `$mogako` or skill selection | `codex` | `~/.agents/skills/mogako` |
| Antigravity IDE | skill selection | `antigravity` | `~/.gemini/config/skills/mogako` |
| Antigravity CLI | skill selection | `antigravity-cli` | `~/.gemini/antigravity-cli/skills/mogako` |

Every host ultimately runs the corresponding command:

```bash
mogako checkpoint --summary-file <file> --repo <repository-root> --target <target> --submit
```

The CLI collects only the v2 summary fields (`summary`, `completed`, `nextActions`, `blockers`) and safe repository-relative changed-file paths. It prints the exact payload before network delivery, requires final approval, and keeps the payload in the local outbox when submission is cancelled or retryable delivery fails.

## Legacy token counters

Token counters belong to the Worklog v1 `record`/`wrap` compatibility path. Checkpoint v2 does not accept provider, model, or token fields and does not estimate token usage from text size.

## Host usage cost

The plugin does not create automatic background tasks. Invoking an Agent Skill can still consume the host agent's normal turn and context budget. For a local v1 record without an agent turn, use the legacy `mogako wrap` command directly in a terminal.
