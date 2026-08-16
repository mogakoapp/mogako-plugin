[한국어](./README.md) · [English](./README.en.md) · [日本語](./README.ja.md)

# Mogako Plugin

> **Claude Code、Codex、Antigravity、ターミナルから、プライバシーを最小限にして開発チェックポイントを記録する CLI と Agent Skill**

Mogako Plugin は、AI コーディングツールが作成した確認済みの作業概要と Git の変更ファイルパスをローカルのチェックポイントにし、ユーザーが承認した場合だけ Mogako に送信します。アプリのリポジトリやバックエンドのソースは含まれない、独立した公開リポジトリです。

公開リポジトリ: <https://github.com/mogakoapp/mogako-plugin>

---

## プライバシーの境界

AI 連携の標準フローはチェックポイント v2 です。チェックポイントの概要ファイルで使用できるフィールドは次の4つだけです。

```json
{
  "summary": "作業の短い概要",
  "completed": ["完了した作業"],
  "nextActions": ["次の作業"],
  "blockers": []
}
```

`title` を含む未知のフィールドは拒否されます。チェックポイントにはソースコード、プロンプト、AI の回答全文、diff、Git remote URL、絶対パス、ターミナル出力、環境変数、トークンは入りません。

`changedFiles` はリポジトリ相対の Git パスだけを収集し、最大100個、1パス240文字です。`.env*`、`*.pem`、`*.key`、`credentials*`、`.ssh/`、`secrets/` などの機密パスは除外されます。概要文には既知の API キー、JWT、環境変数の秘密、ローカルパス、メールアドレスのパターンを防御的にマスキングしますが、送信前にユーザー自身が確認してください。

- 自動アップロードは無効です。`--submit` や `mogako submit` などの明示的な操作まではネットワーク通信を行いません。
- チェックポイント JSON と配信状態 sidecar は、まず `~/.mogako/outbox/` に保存されます。キャンセルや再試行可能な失敗の後もローカルに残ります。
- 接続資格情報は書き込み専用で、`~/.mogako/connection.json` に保存されます。CLI はトークンを表示しません。サーバー側の資格情報を無効化するには、Mogako アプリの接続デバイス画面から取り消してください。

旧 `record`/`wrap` コマンドは Worklog v1 の互換経路です。`title`、provider/model、トークンカウンターなどの v1 フィールドを含む場合がありますが、チェックポイント v2 の契約と混ぜないでください。詳しくは [PRIVACY.md](./PRIVACY.md) を確認してください。

---

## クイックスタート

### 必要なもの

- Node.js 20 以上
- Git
- 接続するコーディングホスト（Claude Code、Codex、Antigravity）

### 1. CLI をインストールする

公開リポジトリを clone して、通常のユーザー向けにインストールします。

```bash
git clone https://github.com/mogakoapp/mogako-plugin.git
cd mogako-plugin
npm ci
npm install -g .
mogako --help
```

コントリビューターやローカル開発では `npm link` を使えますが、通常のインストールには `npm install -g .` を使用してください。

### 2. Mogako のデバイスを接続する

Mogako アプリで **記録タブ → コーディングツール → コーディングツール接続 → 接続コードを作成**（韓国語の表示: **기록 탭 → 코딩 도구 → 코딩 도구 연결 → 연결 코드 만들기**）を順に開きます。コードは8文字で、10分後に期限切れになり、1回だけ交換できます。

```bash
mogako connect <8文字の接続コード> --device-name "My Development PC"
```

接続コードはターミナルにだけ入力してください。デバイストークンを LLM、チャット、issue に貼り付けないでください。`mogako disconnect` はローカルファイルを削除します。サーバー側の資格情報はアプリの接続デバイス画面から取り消します。

### 3. Agent Skill をインストールする

使用するホスト向けの Skill をインストールします。

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

このコマンドは Agent Skill ファイルをコピーするだけで、自動 hook や自動送信は追加しません。

| 対象 | インストール先 |
| :--- | :--- |
| `codex` | `~/.agents/skills/mogako` |
| `claude-code` | `~/.claude/skills/mogako` |
| `antigravity` | `~/.gemini/config/skills/mogako` |
| `antigravity-cli` | `~/.gemini/antigravity-cli/skills/mogako` |

---

## 使い方とワークフロー

AI 連携の基本フローは **概要を書く → ローカルチェックポイントを作る → 正確な preview を確認する → 承認して送信する** です。対話型ターミナルでは `--submit` が確認を求めます。非対話型プロセスでは、別途ユーザーが承認した場合だけ `--yes` を渡してください。

### チェックポイント v2 の概要ファイル

`summary.json` には次の4フィールドをすべて含めます。`title` やその他のフィールドは使用できません。

```json
{
  "summary": "認証セッションのリフレッシュ処理を改善",
  "completed": ["セッション ID を維持", "認証テストを追加"],
  "nextActions": ["Flutter 連携をテスト"],
  "blockers": []
}
```

CLI は現在の Git リポジトリから変更ファイルを収集します。別のリポジトリを指定する場合は `--repo <repository-root>` を使います。ソースコードや diff は送信しません。

### チェックポイントを作成して送信する

短い概要を直接渡す場合:

```bash
mogako checkpoint --summary "トークン更新を実装" --submit
```

確認済みの JSON 概要を使う場合:

```bash
mogako checkpoint --summary-file ./summary.json --repo . --target codex --submit
```

ネットワーク通信の前に、コマンドはチェックポイント JSON と outbox のパスを表示します。preview を確認して承認してください。別途承認済みの非対話型実行では次を使います。

```bash
mogako checkpoint --summary-file ./summary.json --repo . --target codex --submit --yes
```

`--submit` を付けなければ、チェックポイントはローカル outbox にだけ保存されます。送信をキャンセルした場合や再試行可能なネットワークエラーの場合も、payload と配信状態 sidecar は残ります。保存した v2 payload は次で再送できます。

```bash
mogako submit ~/.mogako/outbox/<sourceRecordId>.json
```

### status、privacy、接続解除

```bash
mogako status
mogako status --json
mogako privacy
mogako disconnect
```

`privacy`、`record`、`wrap` は Worklog v1 互換のために残されています。新しい Agent Skill のフローでは `mogako checkpoint` を使い、v1 の `title`、provider/model、トークンフィールドを v2 の概要ファイルに混ぜないでください。

### ホストごとの呼び出し

- **Claude Code:** standalone Skill として `/mogako` を実行します。
- **Codex:** `$mogako` を呼び出すか、skills メニューから `mogako` を選択します。
- **Antigravity:** Mogako Skill を選択または呼び出します。
- **ターミナル:** `mogako checkpoint --summary "..." --submit` を直接実行します。

---

## LLM にインストールを依頼する

ホストがターミナルコマンドを実行できる場合は、次のプロンプトを貼り付けてください。チャットだけのモデルはコマンドを実行できないため、その場合は表示されたコマンドを自分で実行します。

```text
ターミナルだけで Mogako Plugin のセットアップを実行してください。
1. Node.js 20+ と Git がインストールされているか確認し、どちらかがなければ停止してください。
2. https://github.com/mogakoapp/mogako-plugin を clone して npm ci を実行してください。
3. npm install -g . を実行し、mogako --help が動くことを確認してください。
4. 使用するホストを私に確認してから、mogako install --target codex|claude-code|antigravity|antigravity-cli のうち1つだけ実行してください。
5. 接続コードの入力、デバイストークンの表示、チェックポイントの送信はせず、セットアップ後に停止してください。
各コマンドと結果を表示してください。
```

毎日の利用には次のプロンプトを使います。

```text
今日の Mogako チェックポイントを準備してください。
1. 概要にソースコード、プロンプト、AI の回答、diff、絶対パス、Git remote、トークンを入れないでください。
2. summary、completed、nextActions、blockers だけを使い、最初に概要を表示してください。
3. 私が概要を承認するまで、ファイル作成、--submit、ネットワーク通信をしないでください。
4. 承認後に summary.json を作り、mogako checkpoint --summary-file summary.json --repo <repository-root> --target <target> --submit を実行してください。
5. preview を表示して最終承認を待ってください。payload のパスと結果だけを報告し、トークンは表示しないでください。
```

LLM に接続コードを受け取らせたり、送信を自動承認させたりしないでください。コードの作成・入力、概要の承認、最終送信はユーザーが決める操作です。

---

## CLI リファレンス

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

**チェックポイントの概要に `title` を入れられますか？**

いいえ。チェックポイント v2 は `summary`、`completed`、`nextActions`、`blockers` だけを受け付けます。`title` は旧 v1 `wrap` 契約だけのフィールドです。

**Git リポジトリ以外でも使えますか？**

チェックポイントの変更ファイル収集には Git status を使います。Git リポジトリ内で実行するか、`--repo` で Git リポジトリのルートを指定してください。

**ローカルデータを削除するには？**

ローカル設定、活動メタデータ、接続情報、outbox ファイルが入っている `~/.mogako` を削除します。

```bash
rm -rf ~/.mogako
```

Windows PowerShell の場合:

```powershell
Remove-Item -Recurse -Force "$HOME\.mogako"
```

## ライセンス

[MIT License](./LICENSE)
