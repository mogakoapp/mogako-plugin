# Provider support

| Provider | Invocation | Installation target | v0.1 notes |
|---|---|---|---|
| Claude Code | `/mogako` as a standalone skill | `~/.claude/skills/mogako` | The repository also contains a Claude plugin manifest for local `--plugin-dir` testing. Marketplace installation would namespace the skill. |
| Codex CLI / IDE | `$mogako` or `/skills` | `~/.agents/skills/mogako` | Implicit invocation is disabled through `agents/openai.yaml`. |
| Antigravity | Skill selection or matching prompt | `~/.gemini/config/skills/mogako` | Global skill location. |
| Antigravity CLI | `/skills`, then invoke Mogako | `~/.gemini/antigravity-cli/skills/mogako` | Kept separate because CLI discovery paths can differ. |

## Token counters

Token usage is recorded only when the host exposes a reliable number or the user provides one explicitly. The CLI never estimates token counts from text size.

## Summary cost

`METADATA_ONLY` does not request a summary. Invoking an agent skill can still consume the host agent's normal turn/context usage. For a no-summary local record without an agent turn, run `mogako wrap` directly in a terminal.
