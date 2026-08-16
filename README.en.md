[한국어](./README.md) · [English](./README.en.md) · [日本語](./README.ja.md)

# Mogako Plugin

> **A privacy-minimizing CLI and Agent Skill for recording development checkpoints from Claude Code, Codex, Antigravity, and a terminal**

Mogako Plugin turns an AI coding tool's reviewed work summary and Git changed-file paths into a local checkpoint, then sends it to Mogako only after the user approves it. The plugin is a separate public repository; it does not contain the app repository or backend source.

Public repository: <https://github.com/mogakoapp/mogako-plugin>

---

## Privacy boundaries

The default path for AI integrations is checkpoint v2. A checkpoint summary file accepts exactly these four fields:

```json
{
  "summary": "Short description of the work",
  "completed": ["Completed work"],
  "nextActions": ["Next action"],
  "blockers": []
}
```

Unknown fields, including `title`, are rejected. Checkpoints do not contain source code, prompts, full AI responses, diffs, Git remote URLs, absolute paths, terminal output, environment variables, or tokens.

`changedFiles` contains only repository-relative Git paths, up to 100 paths and 240 characters per path. Sensitive paths such as `.env*`, `*.pem`, `*.key`, `credentials*`, `.ssh/`, and `secrets/` are excluded. Known API-key, JWT, environment-secret, local-path, and email patterns are redacted defensively in summary text; users must still review the content before submission.

- Automatic upload is disabled. No network request is made before an explicit action such as `--submit` or `mogako submit`.
- The checkpoint JSON and delivery sidecar are written to `~/.mogako/outbox/` first. They remain available after cancellation or a retryable failure.
- The connection credential is write-only and stored in `~/.mogako/connection.json`. The CLI does not print the token. Revoke the server credential from the connected-device screen in the Mogako app.

The older `record`/`wrap` commands are Worklog v1 compatibility paths. They may contain v1 fields such as `title`, provider/model, and token counters; do not mix that contract with checkpoint v2. See [PRIVACY.md](./PRIVACY.md) for details.

---

## Quick start

### Requirements

- Node.js 20 or newer
- Git
- A coding host to connect (Claude Code, Codex, or Antigravity)

### 1. Install the CLI

Clone the public repository and install it for normal use:

```bash
git clone https://github.com/mogakoapp/mogako-plugin.git
cd mogako-plugin
npm ci
npm install -g .
mogako --help
```

Contributors may use `npm link` for local development, but regular users should use `npm install -g .`.

### 2. Connect the Mogako device

In the Mogako app, open **Records → Coding tools → Coding tool connection → Create connection code** (the Korean labels are **기록 탭 → 코딩 도구 → 코딩 도구 연결 → 연결 코드 만들기**). The code has 8 characters, expires after 10 minutes, and can be exchanged only once.

```bash
mogako connect <8-character-connection-code> --device-name "My Development PC"
```

Enter the connection code only in the terminal. Never paste a device token into an LLM, chat, or issue. `mogako disconnect` removes the local file; revoke the server credential from the app's connected-device screen.

### 3. Install the Agent Skill

Install the skill for the host you use:

```bash
# Claude Code
mogako install --target claude-code

# Codex
mogako install --target codex

# Antigravity IDE
mogako install --target antigravity

# Antigravity CLI
mogako install --target antigravity-cli
```

The targets copy Agent Skill files and do not add automatic hooks or automatic submission:

| Target | Destination |
| :--- | :--- |
| `codex` | `~/.agents/skills/mogako` |
| `claude-code` | `~/.claude/skills/mogako` |
| `antigravity` | `~/.gemini/config/skills/mogako` |
| `antigravity-cli` | `~/.gemini/antigravity-cli/skills/mogako` |

---

## Usage and workflows

The normal AI integration flow is **write a summary → create a local checkpoint → inspect the exact preview → approve and submit**. In an interactive terminal, `--submit` asks for confirmation. In a non-interactive process, pass `--yes` only when a separate user approval has already happened.

### Checkpoint v2 summary file

`summary.json` must contain all four fields below. `title` and any other field are not allowed.

```json
{
  "summary": "Improve the authentication session refresh flow",
  "completed": ["Preserved the session ID", "Added authentication tests"],
  "nextActions": ["Test the Flutter integration"],
  "blockers": []
}
```

The CLI collects changed files from the current Git repository. Use `--repo <repository-root>` to select another repository. It does not transmit source code or diffs.

### Create and submit a checkpoint

For a short inline summary:

```bash
mogako checkpoint --summary "Implemented token refresh" --submit
```

For a reviewed JSON summary:

```bash
mogako checkpoint --summary-file ./summary.json --repo . --target codex --submit
```

Before any network request, the command prints the checkpoint JSON and outbox paths. Inspect the preview and approve it. For a separately approved non-interactive run:

```bash
mogako checkpoint --summary-file ./summary.json --repo . --target codex --submit --yes
```

Without `--submit`, the checkpoint is saved only in the local outbox. If submission is cancelled or a retryable network error occurs, the payload and delivery sidecar remain available. Retry a saved v2 payload with:

```bash
mogako submit ~/.mogako/outbox/<sourceRecordId>.json
```

### Status, privacy, and disconnect

```bash
mogako status
mogako status --json
mogako privacy
mogako disconnect
```

`privacy`, `record`, and `wrap` are retained for Worklog v1 compatibility. The new Agent Skill flow should use `mogako checkpoint`; do not mix v1 `title`, provider/model, or token fields into a v2 summary file.

### Host invocation

- **Claude Code:** invoke `/mogako` as a standalone skill.
- **Codex:** invoke `$mogako` or select `mogako` from the skills menu.
- **Antigravity:** select or invoke the Mogako skill.
- **Terminal:** run `mogako checkpoint --summary "..." --submit` directly.

---

## Ask an LLM to install it

If the host can execute terminal commands, you can paste this prompt into it. A chat-only model cannot run commands; in that case, execute the shown commands yourself.

```text
Run the following Mogako Plugin setup in the terminal only.
1. Check that Node.js 20+ and Git are installed. Stop if either is missing.
2. Clone https://github.com/mogakoapp/mogako-plugin and run npm ci.
3. Run npm install -g . and verify that mogako --help works.
4. Ask me which host I want, then run exactly one of mogako install --target codex|claude-code|antigravity|antigravity-cli.
5. Do not enter a connection code, print a device token, or submit a checkpoint. Stop after setup.
Show each command and its result.
```

For daily use:

```text
Prepare today's Mogako checkpoint.
1. Do not put source code, prompts, AI responses, diffs, absolute paths, Git remotes, or tokens in the summary.
2. Use only summary, completed, nextActions, and blockers. Show the summary first.
3. Do not create a file, use --submit, or make a network request until I approve the summary.
4. After approval, write summary.json and run mogako checkpoint --summary-file summary.json --repo <repository-root> --target <target> --submit.
5. Show the preview and wait for final approval. Report only the payload path and result; never print the token.
```

Do not prompt an LLM to receive a connection code or auto-approve a submission. Creating the code, entering it, approving the summary, and making the final submission are user decisions.

---

## CLI reference

```text
Mogako CLI v0.1

Usage:
  mogako init [--mode metadata-only|reviewed-summary] [--force]
  mogako privacy [metadata-only|reviewed-summary]
  mogako connect <code> [--device-name <name>] [--api-base-url <url>]
  mogako disconnect
  mogako record --provider <name> [--model <name>] [--focus-seconds <n>]
                [--input-tokens <n>] [--output-tokens <n>]
                [--cached-input-tokens <n>]
  mogako status [--date YYYY-MM-DD] [--json]
  mogako wrap [--date YYYY-MM-DD] [--summary-file <path> --reviewed]
              [--dry-run] [--submit] [--yes]
  mogako checkpoint [--summary-file <path> | --summary "<text>"] [--repo <root>]
                    [--target codex|claude-code|antigravity|antigravity-cli|manual]
                    [--submit] [--yes]
  mogako submit <record.json>
  mogako install --target codex|claude-code|antigravity|antigravity-cli [--force]
```

---

## FAQ

**Can I put `title` in a checkpoint summary?**

No. Checkpoint v2 accepts exactly `summary`, `completed`, `nextActions`, and `blockers`. `title` belongs only to the legacy v1 `wrap` contract.

**Does the plugin work outside a Git repository?**

Checkpoint changed-file collection uses Git status. Run it from a Git repository or pass a Git repository root with `--repo`.

**How do I delete local data?**

Delete `~/.mogako`, which contains local configuration, activity metadata, connection information, and outbox files.

```bash
rm -rf ~/.mogako
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force "$HOME\.mogako"
```

## License

[MIT License](./LICENSE)
