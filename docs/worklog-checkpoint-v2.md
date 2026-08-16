# Worklog Checkpoint Schema v2

> Mogako Plugin이 사용자 검토를 거친 작업 요약과 안전한 변경 파일 경로를 로컬 checkpoint로 만드는 공개 동작 계약입니다. 소스 코드, diff, 프롬프트 또는 대화 전문을 기록하거나 전송하지 않습니다.

## What it records

v2 checkpoint는 한 번의 작업 결과를 요약한 immutable payload입니다. 같은 날짜에도 여러 checkpoint를 만들 수 있으며, 각 payload는 생성 후 수정하지 않습니다.

기본 흐름은 다음과 같습니다.

`작업 요약 작성 → 로컬 checkpoint 생성 → 정확한 JSON preview 확인 → 사용자 승인 → 제출`

## Supported clients

| Integration target | `sourceClient` |
| --- | --- |
| `codex` | `CODEX` |
| `claude-code` | `CLAUDE_CODE` |
| `antigravity` 또는 `antigravity-cli` | `ANTIGRAVITY` |
| `manual` 또는 target 생략 | `MANUAL_CLI` |

`sourceClient`는 checkpoint 출처를 표시하는 provenance 값이며, 권한·과금·신뢰도 판단을 위한 값이 아닙니다. integration은 payload를 직접 만들지 않고 공통 CLI에 target만 전달합니다.

## Summary-file input

`mogako checkpoint --summary-file <json>`은 다음 네 필드만 받습니다.

```json
{
  "summary": "검토한 작업 결과",
  "completed": ["완료한 항목"],
  "nextActions": ["다음 작업"],
  "blockers": []
}
```

- 네 필드는 모두 필요합니다.
- `title`와 알 수 없는 필드는 거절합니다.
- `summary`는 문자열이고 나머지는 문자열 배열입니다.
- 기존 secret redaction을 적용한 뒤 trim과 길이 제한을 검사합니다.
- v2는 값을 조용히 잘라내지 않습니다. 검증을 통과한 동일한 결과가 preview와 payload에 사용됩니다.

## Wire payload

```json
{
  "schemaVersion": 2,
  "sourceRecordId": "4bfcbb06-c71c-4cba-ae56-4d51cccbad33",
  "sourceClient": "CODEX",
  "generatedAt": "2026-08-16T06:20:00Z",
  "timeZoneId": "Asia/Seoul",
  "localDate": "2026-08-16",
  "summary": "체크포인트 입력과 preview 흐름을 정리했다.",
  "completed": ["v2 입력 검증 추가"],
  "changedFiles": ["src/checkpoint.js", "docs/example.md"],
  "nextActions": ["통합 테스트 실행"],
  "blockers": []
}
```

최상위 필드는 다음 11개이며, 알 수 없는 필드는 허용하지 않습니다.

| Field | Contract |
| --- | --- |
| `schemaVersion` | integer `2` |
| `sourceRecordId` | UUID |
| `sourceClient` | `CODEX`, `CLAUDE_CODE`, `ANTIGRAVITY`, `MANUAL_CLI` |
| `generatedAt` | UTC RFC 3339 instant |
| `timeZoneId` | IANA timezone, 1~64자 |
| `localDate` | `generatedAt`와 timezone으로 계산한 `YYYY-MM-DD` |
| `summary` | trim 후 1~1000자 문자열 |
| `completed`, `nextActions`, `blockers` | 각 최대 20개, 항목당 1~300자 문자열 |
| `changedFiles` | 최대 100개, 저장소 상대 경로, 항목당 1~240자 |

`sourceRecordId`는 outbox 생성 시 한 번 만들고, 재시도할 때도 유지합니다. `localDate`는 임의로 입력하지 않고 instant와 timezone에서 계산합니다.

## Privacy boundary

v2 checkpoint에는 다음 정보가 포함되지 않습니다.

- 소스 코드 본문, diff, patch
- 프롬프트, AI 응답 전문, 전체 대화 또는 세션 전문
- Git remote URL, 절대 경로, 사용자 홈 경로
- API key, token, credential 원문
- provider, model 이름과 버전, 입력·출력 token 수

요약은 사용자가 직접 검토해야 하며, 민감한 내용을 요약에 넣지 않아야 합니다. 기존 v1 metadata와 usage 필드는 v1 호환 경로에서만 다뤄지며 v2 payload로 복사하지 않습니다.

## Changed-file paths

공통 CLI는 파일 본문을 읽지 않고 다음 Git 상태 명령의 경로 필드만 사용합니다.

```text
git status --porcelain=v1 -z --untracked-files=all
```

경로 처리 규칙:

- `\`를 `/`로 정규화합니다.
- 절대 경로, Windows drive 경로, UNC 경로, 빈 segment, `.`, `..`, 제어문자를 거절합니다.
- 경로당 최대 240자, 전체 최대 100개입니다.
- `.env*`, `*.pem`, `*.key`, `credentials*`, `.ssh/`, `secrets/` 등 민감한 경로를 제외합니다.
- rename/copy 상태에서는 NUL로 전달된 destination 경로를 사용합니다.

변경 파일 수집 과정에서 diff, 파일 내용, remote 정보는 읽지 않습니다. 제외된 민감 경로의 원문도 preview에 불필요하게 다시 출력하지 않습니다.

## Preview, approval, and local outbox

checkpoint 생성과 제출은 분리되어 있습니다.

```text
summary
  ↓
redaction 및 validation
  ↓
immutable payload와 PENDING sidecar 생성
  ↓
정확한 JSON preview
  ↓
사용자 승인
  ↓
submit
```

outbox 파일은 다음 위치에 저장됩니다.

`~/.mogako/outbox/<sourceRecordId>.json` — checkpoint payload
`~/.mogako/outbox/<sourceRecordId>.delivery.json` — 제출 상태 sidecar

`--submit`을 사용해도 대화형 터미널에서는 정확한 preview를 먼저 보여주고 확인을 요청합니다. 승인 전에는 네트워크 요청을 하지 않습니다. 자동·주기적·세션 종료 시 제출도 하지 않습니다.

허용되는 sidecar 상태는 `PENDING`, `SUBMITTING`, `DELIVERED`, `FAILED_RETRYABLE`, `FAILED_FINAL`입니다. 취소나 재시도 가능한 실패 뒤에도 payload를 삭제하지 않으며, 재시도 시 같은 payload bytes와 `sourceRecordId`를 유지합니다. sidecar에는 payload, token 또는 원문 오류 응답을 저장하지 않습니다.

## CLI examples

직접 요약을 입력하는 방법:

```sh
mogako checkpoint --summary "로그인 토큰 갱신 기능 구현" --submit
```

summary file과 변경 파일 경로를 함께 사용하는 방법:

```sh
mogako checkpoint --summary-file ./summary.json --repo . --target codex --submit
```

`--submit` 없이 실행하면 로컬 outbox에만 저장합니다. 별도로 승인된 비대화형 실행에서만 `--yes`를 추가합니다.

저장된 payload 재제출:

```sh
mogako submit ~/.mogako/outbox/<sourceRecordId>.json
```

## Schema files and fixtures

검증에 사용하는 공개 파일:

- [`schemas/worklog-v2.schema.json`](../schemas/worklog-v2.schema.json)
- [`schemas/worklog-v1.schema.json`](../schemas/worklog-v1.schema.json)
- [v2 fixtures](../test/fixtures/)

fixture와 테스트는 supported client mapping, 정상 payload, 알 수 없는 client, 민감한 경로, 날짜 불일치 같은 경계를 확인합니다.

## v1 compatibility

`privacy`, `record`, `wrap` 명령은 Worklog v1 호환을 위해 유지됩니다. v1에는 `title`, provider/model, token counter 같은 필드가 있을 수 있지만 v2 summary-file에는 섞지 않습니다.

새 Agent Skill 연동은 `mogako checkpoint`를 사용합니다. 기존 v1 기록이 필요한 경우에만 v1 명령을 사용하세요.
