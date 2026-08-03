# Mogako Plugin

Claude Code, Codex, Antigravity와 일반 터미널에서 사용자가 검토한 작업 요약을 모각코 작업 기록으로 보내는 공통 Node.js CLI/Agent Skill 프로젝트입니다.

## 핵심 원칙

- 자동 업로드는 항상 꺼져 있습니다.
- v2 checkpoint는 전송 전에 정확한 JSON preview를 보여 주고 명시적인 최종 승인을 요구합니다.
- 원본 프롬프트, 답변, 소스코드, diff, Git remote, 저장소 주소는 수집하거나 전송하지 않습니다.
- 변경 파일은 `git status`에서 얻은 저장소 상대 경로만 포함합니다. 파일 내용은 읽지 않으며 민감 경로와 비정상 경로는 제외합니다.
- 요약 입력은 사용자가 준비한 `summary`, `completed`, `nextActions`, `blockers`만 허용합니다.
- API key, JWT, 로컬 절대 경로, 이메일 등은 preview 전에 마스킹합니다.
- payload는 immutable outbox 파일로 저장하고 전송 상태는 별도 sidecar 파일에 기록합니다.
- 연결 토큰은 작업 기록 쓰기 전용이며 CLI 출력에 노출하지 않습니다.
- 기존 schema v1 `record`/`wrap` 흐름은 호환 목적으로 유지합니다.

## 요구 사항

- Node.js 20 이상
- checkpoint의 변경 파일 수집을 위한 Git

## 로컬 개발

```bash
npm install
npm link
mogako init
```

링크하지 않고 실행할 수도 있습니다.

```bash
node src/cli.js init
```

테스트:

```bash
npm test
npm run check
```

## 1. 초기화와 연결

```bash
mogako init
```

기본 운영 API 주소는 다음과 같습니다.

```text
https://api.mogako.xyz/api/v1/
```

모각코 앱의 `마이 > 코딩 도구 연결`에서 일회용 코드를 발급한 뒤 입력합니다.

```bash
mogako connect ABCD2345 --device-name "Windows Development PC"
```

로컬 백엔드 테스트에서만 API 주소를 덮어쓸 수 있습니다.

```bash
mogako connect ABCD2345 --api-base-url http://localhost:8080/api/v1/
```

HTTPS가 기본이며 HTTP는 `localhost`와 `127.0.0.1`에서만 허용합니다. 교환된 기기 토큰은 `~/.mogako/connection.json`에 저장되고 CLI 출력에는 나타나지 않습니다.

로컬 연결 파일을 제거하려면:

```bash
mogako disconnect
```

이 명령은 로컬 파일만 제거합니다. 서버 토큰을 즉시 무효화하려면 모각코 앱의 연결 기기 목록에서 해당 기기를 해제해야 합니다.

## 2. 검토된 checkpoint v2 생성

### summary 파일

허용되는 JSON 필드는 정확히 네 개입니다.

```json
{
  "summary": "리프레시 과정에서 논리 세션 ID를 유지하고 관련 테스트를 보완했다.",
  "completed": ["세션 ID 유지", "통합 테스트 추가"],
  "nextActions": ["Flutter 인증 연동"],
  "blockers": []
}
```

다음 입력은 거절됩니다.

- `title`, `changedFiles` 또는 기타 알 수 없는 필드
- 앞뒤 공백이 있거나 제한을 넘는 문자열
- `summary` 누락 또는 빈 문자열
- 배열이 아닌 `completed`, `nextActions`, `blockers`

제한값:

- `summary`: 최대 1000자
- `completed`, `nextActions`, `blockers`: 각 최대 20개, 항목당 최대 300자
- 자동 수집되는 `changedFiles`: 최대 100개, 경로당 최대 240자

### preview와 로컬 outbox만 생성

```bash
mogako checkpoint \
  --summary-file ./checkpoint-summary.json \
  --repo . \
  --target codex
```

이 명령은 다음을 수행합니다.

1. summary 파일을 allowlist 기준으로 검증하고 민감정보를 마스킹합니다.
2. `git status --porcelain=v1 -z`에서 안전한 변경 파일 경로만 수집합니다.
3. 전송할 정확한 checkpoint JSON을 출력합니다.
4. immutable payload와 `PENDING` delivery sidecar를 로컬 outbox에 저장합니다.
5. `--submit`이 없으므로 네트워크 요청은 만들지 않습니다.

### preview 후 승인하여 전송

```bash
mogako checkpoint \
  --summary-file ./checkpoint-summary.json \
  --repo . \
  --target codex \
  --submit
```

CLI는 payload, 대상 URL, 제외된 경로 수를 표시한 뒤 최종 확인을 요청합니다. 취소해도 payload와 sidecar는 유지되고 서버 요청은 발생하지 않습니다.

비대화식 환경에서는 명시적인 승인을 뜻하는 `--yes`가 필요합니다.

```bash
mogako checkpoint \
  --summary-file ./checkpoint-summary.json \
  --repo . \
  --target claude-code \
  --submit \
  --yes
```

`--yes`는 preview와 outbox 생성을 생략하지 않습니다. 표시된 동일 payload를 승인하는 용도로만 사용됩니다.

### target 매핑

| `--target` | 전송되는 `sourceClient` |
|---|---|
| `codex` | `CODEX` |
| `claude-code` | `CLAUDE_CODE` |
| `antigravity` | `ANTIGRAVITY` |
| `antigravity-cli` | `ANTIGRAVITY` |
| `manual` 또는 생략 | `MANUAL_CLI` |

일반 터미널에서 직접 실행하는 예:

```bash
mogako checkpoint --summary-file ./checkpoint-summary.json --repo .
```

## 3. outbox 재전송

preview에 표시된 payload 경로를 `submit`에 전달합니다.

```bash
mogako submit ~/.mogako/outbox/checkpoints/<payload-file>.json
```

- 네트워크 오류나 서버 5xx 응답은 재시도 가능한 실패로 sidecar에 기록됩니다.
- 재전송해도 payload 파일의 bytes는 변경되지 않습니다.
- 동일 payload가 이미 저장됐다면 서버는 `UNCHANGED`와 기존 checkpoint ID를 반환합니다.
- 같은 `sourceRecordId`에 다른 payload를 보내면 최종 idempotency 충돌로 처리합니다.
- 기기 연결이 해제된 경우 401 최종 실패가 기록되지만 immutable payload는 남습니다.

## 4. 변경 파일 개인정보 규칙

checkpoint는 파일 내용이나 diff를 읽지 않습니다. Git status의 경로만 `/` 구분자로 정규화한 뒤 다음 경로는 제외합니다.

- 절대 경로, Windows drive 경로, UNC 경로
- 빈 segment, `.`, `..`, 제어문자가 포함된 경로
- `.env*`, `*.pem`, `*.key`, credentials, `.ssh`, `secrets` 경로

제외된 실제 경로는 preview에 다시 노출하지 않고 `excludedPathCount`만 표시합니다.

## 5. Agent Skill 설치

```bash
mogako install --target claude-code
mogako install --target codex
mogako install --target antigravity
mogako install --target antigravity-cli
```

기존 설치를 교체하려면 `--force`를 추가합니다.

호출 방식:

- Claude Code standalone skill: `/mogako`
- Codex: `$mogako` 또는 `/skills`에서 선택
- Antigravity: Mogako skill 선택/호출
- LLM을 거치지 않는 직접 checkpoint: 터미널에서 `mogako checkpoint ...`

Claude Code 플러그인을 저장소에서 테스트하려면:

```bash
claude --plugin-dir ./integrations/claude-code
```

플러그인 방식에서는 `/mogako:mogako`로 표시될 수 있습니다. 짧은 `/mogako` 호출은 `mogako install --target claude-code`가 설치하는 standalone skill을 사용합니다.

각 integration은 summary 파일과 target만 공통 CLI에 전달합니다. preview, 승인, outbox, HTTP 전송과 재시도는 모두 공통 CLI가 담당합니다.

## 6. schema v1 호환 흐름

기존 활동 메타데이터 기록과 일별 마감은 계속 지원합니다.

```bash
mogako record \
  --provider codex \
  --model gpt-5.6-codex \
  --focus-seconds 3000 \
  --input-tokens 42120 \
  --output-tokens 8140

mogako status
mogako wrap
```

v1 metadata-only record를 즉시 제출하려면:

```bash
mogako wrap --submit
```

기존 reviewed summary v1 입력은 `title`을 포함하는 별도 계약입니다.

```bash
mogako privacy reviewed-summary
mogako wrap --summary-file ./legacy-summary.json --reviewed
```

v1과 v2 입력 JSON을 섞어 사용하면 안 됩니다. 새 멀티 클라이언트 작업 타임라인에는 `mogako checkpoint`를 사용합니다.

## 현재 범위

- 공통 Node.js CLI
- Codex, Claude Code, Antigravity, Antigravity CLI, manual CLI source mapping
- strict checkpoint v2 JSON validation
- 개인정보 마스킹과 안전한 changed-file 수집
- preview와 명시적 승인
- immutable payload outbox와 atomic delivery sidecar
- 쓰기 전용 기기 토큰 기반 제출과 재시도
- schema v1 metadata/reviewed-summary 호환

자세한 개인정보 설계는 [PRIVACY.md](./PRIVACY.md), 구조는 [docs/architecture.md](./docs/architecture.md), v2 계약은 [docs/worklog-checkpoint-v2.md](./docs/worklog-checkpoint-v2.md)를 참고하세요.
