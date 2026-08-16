[한국어](./README.md) · [English](./README.en.md) · [日本語](./README.ja.md)

# Mogako Plugin (모각코 플러그인)

> **Claude Code, Codex, Antigravity와 터미널에서 개인정보를 최소화해 개발 체크포인트를 기록하는 CLI 및 Agent Skill**

Mogako Plugin은 AI 코딩 도구가 만든 작업 요약과 Git 변경 파일 경로를 검토 가능한 로컬 체크포인트로 만든 뒤, 사용자가 승인한 경우에만 Mogako에 전송합니다. 플러그인은 앱과 분리된 공개 저장소이며, 앱 저장소나 백엔드 코드를 포함하지 않습니다.

공개 저장소: <https://github.com/mogakoapp/mogako-plugin>

---

## 🔒 핵심 가치 및 개인정보 보장 (Privacy Guarantees)

Mogako Plugin은 수집 범위를 줄이고, 전송 전에 사용자가 확인할 수 있도록 설계되었습니다. 구현된 경계를 이해한 뒤 사용하세요.

| 구분 | 수집 항목 | 절대 수집하지 않는 항목 |
| :--- | :--- | :--- |
| **체크포인트 v2** | `summary`, `completed`, `nextActions`, `blockers`, 검증된 Git 상대 경로 | **소스코드, 프롬프트, AI 응답 전문, Diff, 절대 경로, Git Remote URL, 파일 본문, 터미널 출력, 토큰** |
| **구형 Worklog v1** | `record`/`wrap`이 만드는 기존 메타데이터와 검토된 worklog | v2 체크포인트와 필드·승인 흐름이 다르므로 호환용으로만 사용 |
| **변경 파일 경로 (`changedFiles`)** | Git 상대 경로만 수집 (최대 100개, 경로당 240자 이내) | `.env*`, `*.pem`, `*.key`, `credentials*`, `.ssh/`, `secrets/` 등 민감 파일 자동 제외 |

* **v2 요약 필드 고정**: `title`을 포함한 알 수 없는 필드는 거부됩니다. v2는 정확히 `summary`, `completed`, `nextActions`, `blockers`를 요구합니다.
* **자동 업로드 금지**: 사용자의 명시적인 승인(`--submit` 또는 `mogako submit`) 없이는 네트워크 요청을 보내지 않습니다.
* **로컬 파일 우선 저장**: 체크포인트와 전달 상태는 `~/.mogako/outbox/`에 먼저 저장되어 취소나 재시도 가능한 실패 뒤에도 남습니다.
* **쓰기 전용 인증**: 모각코 앱의 일회용 코드로 발급된 토큰은 `~/.mogako/connection.json`에만 보관되며(Unix `0600` 권한), CLI 출력에 노출되지 않습니다.

---

## ⚡ 빠른 시작 (Quick Start)

### 사전 요구 사항

- Node.js 20 이상
- Git
- 연결할 AI 코딩 도구(Claude Code, Codex 또는 Antigravity)

### 1단계: CLI 설치

공개 저장소에서 내려받아 일반 사용자용으로 설치합니다:

```bash
git clone https://github.com/mogakoapp/mogako-plugin.git
cd mogako-plugin
npm ci
npm install -g .
mogako --help
```

기여자나 로컬 개발자는 `npm link`를 사용할 수 있지만, 일반 설치에는 `npm install -g .`를 권장합니다.

### 2단계: 모각코 기기 연결

모각코 앱에서 **기록 탭 → 코딩 도구 → 코딩 도구 연결 → 연결 코드 만들기**를 차례로 선택합니다. 연결 코드는 8자리이고 10분 후 만료되며 한 번만 교환할 수 있습니다.

```bash
mogako connect <8자리_연결_코드> --device-name "My Development PC"
```

연결 코드는 터미널에만 입력하세요. device token을 LLM, 채팅, 이슈에 붙여 넣지 마세요. 연결을 해제할 때는 `mogako disconnect`로 로컬 파일을 지우고, 서버 권한은 앱의 연결 기기 화면에서 취소합니다.

### 3단계: AI 도구 연동 (Agent Skill 설치)
사용 중인 AI 코딩 도구에 모각코 연동 스킬을 설치합니다:

```bash
# Claude Code 사용자
mogako install --target claude-code

# Codex 사용자
mogako install --target codex

# Antigravity 사용자
mogako install --target antigravity

# Antigravity CLI 사용자
mogako install --target antigravity-cli
```

설치 대상과 경로는 다음과 같습니다. 명령은 해당 Agent Skill 파일을 복사하며 자동 hook이나 자동 제출을 추가하지 않습니다.

| 대상 | 설치 경로 |
| :--- | :--- |
| `codex` | `~/.agents/skills/mogako` |
| `claude-code` | `~/.claude/skills/mogako` |
| `antigravity` | `~/.gemini/config/skills/mogako` |
| `antigravity-cli` | `~/.gemini/antigravity-cli/skills/mogako` |

---

## 🛠️ 상세 사용법 (Usage & Workflows)

AI 도구 연동의 기본 흐름은 **요약 작성 → 로컬 체크포인트 생성 → 정확한 미리보기 확인 → 최종 승인 후 제출**입니다. `--submit`을 붙여도 대화형 터미널에서는 확인을 한 번 더 묻고, 비대화형 실행에서는 `--yes`를 명시해야 합니다.

### v2 요약 파일 규칙

`summary.json`은 아래 네 필드를 모두 포함해야 합니다. `title`이나 다른 필드는 허용되지 않습니다.

```json
{
  "summary": "인증 세션 리프레시 로직 보완",
  "completed": ["세션 ID 유지 로직 구현", "인증 테스트 추가"],
  "nextActions": ["Flutter 앱 연동 테스트"],
  "blockers": []
}
```

체크포인트는 현재 Git 저장소의 변경 파일을 상대 경로로 수집합니다. 다른 저장소를 지정하려면 `--repo <repository-root>`를 사용하세요. 소스 코드나 diff 자체는 전송하지 않습니다.

### 1. 코딩 활동 체크포인트 기록 (`mogako checkpoint`)

현재 작업 중인 프로젝트의 작업 결과와 변경 파일 목록을 안전하게 체크포인트로 저장합니다.

#### 인라인 요약 작성 (간편 실행)
```bash
mogako checkpoint --summary "로그인 토큰 갱신 기능 구현" --submit
```

#### JSON 파일 기반 요약 작성 (상세 요약)
`summary.json` 작성 (허용 필드: `summary`, `completed`, `nextActions`, `blockers` 4가지):
```json
{
  "summary": "인증 세션 리프레시 로직 보완 및 통합 테스트 작성",
  "completed": [
    "세션 ID 유지 로직 구현",
    "인증 테스트 3종 추가"
  ],
  "nextActions": [
    "Flutter 앱 연동 테스트"
  ],
  "blockers": []
}
```

체크포인트 생성 및 제출:
```bash
mogako checkpoint --summary-file ./summary.json --submit
```

명령은 네트워크 요청 전에 체크포인트 JSON과 outbox 경로를 출력합니다. 미리보기를 확인하고 승인하세요. CI나 비대화형 터미널에서 이미 별도 승인한 경우에만 `--yes`를 추가합니다.

```bash
mogako checkpoint --summary-file ./summary.json --repo . --target codex --submit --yes
```

`--submit` 없이 실행하면 로컬 outbox에만 저장합니다. 제출이 취소되거나 재시도 가능한 네트워크 오류가 발생해도 payload와 전달 상태 파일은 남습니다. 나중에 직접 제출하려면 다음을 실행하세요.

```bash
mogako submit ~/.mogako/outbox/<sourceRecordId>.json
```

> 💡 **팁**: `--repo` 옵션을 생략하면 현재 작업 디렉터리(`process.cwd()`)를 Git 저장소로 사용합니다. Git 저장소가 아니면 변경 파일을 수집할 수 없습니다.

---

### 2. 상태 및 로컬 아웃박스 확인 (`mogako status`)

오늘 저장된 작업 세션 수, 집중 시간, 개인정보 모드 및 데이터 저장 위치를 확인합니다.

```bash
# 텍스트 형태 확인
mogako status

# JSON 형태 확인
mogako status --json
```

---

### 3. 대기 중인 아웃박스 제출 (`mogako submit`)

전송하지 않고 저장해둔 로컬 아웃박스 파일(`<sourceRecordId>.json`)을 검토 후 직접 제출합니다.

```bash
mogako submit ~/.mogako/outbox/4bfcbb06-c71c-4cba-ae56-4d51cccbad33.json
```

---

### 4. 개인정보 설정 변경 (`mogako privacy`)

```bash
# 현재 설정 확인
mogako privacy

# 요약 포함 모드로 변경
mogako privacy reviewed-summary

# 메타데이터 전용 모드로 변경
mogako privacy metadata-only
```

`privacy`, `record`, `wrap`은 Worklog v1 호환 경로를 위한 명령입니다. v1의 `title`, provider/model, 토큰 카운터와 v2 체크포인트의 네 필드 요약을 섞지 마세요. 새 Agent Skill 사용은 `mogako checkpoint`를 기준으로 합니다.

---

### 5. 연결 해제 (`mogako disconnect`)

```bash
mogako disconnect
```
> ⚠️ `disconnect` 명령은 로컬 기기 인증 파일만 제거합니다. 서버 권한을 즉시 취소하려면 모각코 앱의 연결 기기 관리 화면에서 해당 기기를 해제하세요.

---

## 🤖 AI 코딩 도구별 호출 가이드

각 AI 도구 환경에서 다음과 같이 모각코 연동 명령을 호출할 수 있습니다.

* **Claude Code**: 슬래시 커맨드 `/mogako` 실행 (또는 플러그인 모드 `/mogako:mogako`)
* **Codex**: `$mogako` 호출 또는 `/skills` 메뉴에서 `mogako` 선택
* **Antigravity**: Antigravity IDE Skill 목록에서 `mogako` 선택
* **일반 터미널 (Shell)**: `mogako checkpoint --summary "..." --submit` 실행

### LLM으로 설치하기

터미널 명령을 실행할 수 있는 LLM 호스트라면 아래 프롬프트를 그대로 입력해 설치를 맡길 수 있습니다. 일반 채팅 모델처럼 터미널 권한이 없는 환경은 명령을 대신 실행할 수 없으므로, 출력된 명령을 사용자가 직접 실행해야 합니다.

```text
터미널에서만 다음 Mogako Plugin 설치를 진행해줘.
1. Node.js 20+와 Git이 있는지 확인하고 없으면 먼저 중단해줘.
2. 공식 저장소 https://github.com/mogakoapp/mogako-plugin 을 clone하고 npm ci를 실행해줘.
3. npm install -g . 를 실행한 뒤 mogako --help가 동작하는지 확인해줘.
4. 내가 선택한 호스트에 맞춰 mogako install --target codex|claude-code|antigravity|antigravity-cli 중 하나만 실행해줘.
5. 연결 코드 입력, device token 출력, 체크포인트 제출은 실행하지 말고 여기서 멈춰줘.
각 단계의 명령과 결과를 보여줘.
```

### 매일 사용할 LLM 프롬프트

```text
오늘 작업의 Mogako 체크포인트를 준비해줘.
1. 소스 코드, 프롬프트, AI 응답, diff, 절대 경로, Git remote, token은 요약에 넣지 마.
2. summary, completed, nextActions, blockers 네 필드만 사용해서 먼저 요약을 보여줘.
3. 내가 승인하기 전에는 파일 생성, --submit, 네트워크 요청을 하지 마.
4. 승인하면 summary.json을 만들고 mogako checkpoint --summary-file summary.json --repo <repository-root> --target <target> --submit 을 실행해줘.
5. 미리보기와 최종 확인을 거친 뒤에만 제출하고, payload 경로와 결과만 알려줘. token은 출력하지 마.
```

LLM이 연결 코드를 받거나 제출을 자동 승인하도록 프롬프트하지 마세요. 연결 코드 생성·입력, 요약 승인, 최종 제출은 사용자가 직접 결정해야 합니다.

---

## 📖 CLI 전체 명령어 레퍼런스 (CLI Reference)

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
  mogako checkpoint [--summary-file <path> | --summary "<text>"] [--repo <root>]
                    [--target codex|claude-code|antigravity|antigravity-cli|manual]
                    [--submit] [--yes]
  mogako submit <record.json>
  mogako install --target codex|claude-code|antigravity|antigravity-cli [--force]
```

---

## ❓ 자주 묻는 질문 (FAQ & Troubleshooting)

<details>
<summary>Q. summary.json 파일 작성 시 title 필드를 넣어도 되나요?</summary>

**A.** 안 됩니다. Schema v2 사양에서는 `title` 필드를 금지하며, `summary`, `completed`, `nextActions`, `blockers` 4가지 필드만 허용합니다. `title`을 넣을 경우 유효성 검사 오류가 발생합니다.
</details>

<details>
<summary>Q. Git 저장소가 아닌 곳에서도 변경 파일 목록 수집이 가능한가요?</summary>

**A.** 아니요. changedFiles 목록은 `git status`를 기반으로 수집하므로, Git 저장소가 아닌 디렉터리에서는 변경 파일 목록이 빈 배열(`[]`)로 기록됩니다.
</details>

<details>
<summary>Q. 로컬 저장 데이터를 완전히 삭제하려면 어떻게 해야 하나요?</summary>

**A.** 홈 디렉터리의 `~/.mogako` 폴더를 삭제하면 모든 설정, 활동 메타데이터, 인증 정보, outbox 기록이 지워집니다.

* **macOS / Linux**: `rm -rf ~/.mogako`
* **Windows (PowerShell)**: `Remove-Item -Recurse -Force "$HOME\.mogako"`
</details>

---

## 📄 라이선스 (License)

[MIT License](./LICENSE)
