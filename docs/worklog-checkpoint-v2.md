# Worklog Checkpoint Schema v2 Contract

작성일: 2026-08-03
상태: Mogako backend와 공유하는 구현 기준본
관련 저장소: `rbxo0128/mogako`, `rbxo0128/mogako-plugin`

## 1. 목적

Mogako Plugin은 Codex, Claude Code, Gemini 기반 Antigravity와 일반 터미널 CLI에서 사용자가 명시적으로 검토한 현재 작업 결과를 하나의 공통 checkpoint payload로 만든다.

schema v2는 같은 날짜에 여러 번 제출할 수 있으며, Mogako backend는 각 payload를 교체하지 않고 immutable checkpoint로 누적한다.

이 문서는 plugin이 생성하는 JSON과 backend가 수신하는 JSON의 공통 계약이다. 한쪽만 독자적으로 필드, enum 또는 제한을 변경하면 안 된다.

## 2. 지원 client

```text
CODEX
CLAUDE_CODE
ANTIGRAVITY
MANUAL_CLI
```

integration mapping:

```text
codex             -> CODEX
claude-code       -> CLAUDE_CODE
antigravity       -> ANTIGRAVITY
antigravity-cli   -> ANTIGRAVITY
manual            -> MANUAL_CLI
target omitted    -> MANUAL_CLI
```

`sourceClient`는 앱에서 checkpoint 출처를 표시하기 위한 값이다. 인증, 권한, 과금 또는 신뢰도 판단에 사용하지 않는다.

## 3. 공통 wire payload

```json
{
  "schemaVersion": 2,
  "sourceRecordId": "4bfcbb06-c71c-4cba-ae56-4d51cccbad33",
  "sourceClient": "CODEX",
  "generatedAt": "2026-08-03T06:20:00Z",
  "timeZoneId": "Asia/Seoul",
  "localDate": "2026-08-03",
  "summary": "체크포인트 누적 구조를 구현했다.",
  "completed": ["백엔드 스키마 작성"],
  "changedFiles": ["backend/src/main/resources/db/migration/V18__append_worklog_checkpoints.sql"],
  "nextActions": ["v2 import API 구현"],
  "blockers": []
}
```

최상위 필드는 exact allowlist다. `additionalProperties`는 허용하지 않으며 알 수 없는 필드는 plugin validator와 backend validation에서 모두 거절한다.

| Field | Required contract |
| --- | --- |
| schemaVersion | integer `2` |
| sourceRecordId | UUID |
| sourceClient | `CODEX`, `CLAUDE_CODE`, `ANTIGRAVITY`, `MANUAL_CLI` |
| generatedAt | UTC RFC 3339 instant, 서버보다 최대 5분 미래만 허용 |
| timeZoneId | valid IANA zone, 1~64자 |
| localDate | `generatedAt`과 `timeZoneId`로 계산한 날짜 |
| summary | trim 후 공백이 아닌 문자열, 1~1000자 |
| completed | 필수 배열, 최대 20개, 항목당 1~300자 |
| changedFiles | 필수 배열, 최대 100개, 저장소 상대 경로, 항목당 1~240자 |
| nextActions | 필수 배열, 최대 20개, 항목당 1~300자 |
| blockers | 필수 배열, 최대 20개, 항목당 1~300자, 빈 배열 허용 |

CLI와 서버는 길이 초과 값을 조용히 자르지 않고, trim되지 않은 wire 값을 수정해 저장하지 않는다. 정규화되지 않은 값은 preview 이전 또는 API validation에서 거절한다.

## 4. v2 summary-file 입력 계약

`mogako checkpoint --summary-file <json>`은 다음 네 필드만 받는다.

```json
{
  "summary": "필수 작업 요약",
  "completed": [],
  "nextActions": [],
  "blockers": []
}
```

규칙:

- 네 필드는 모두 필수다.
- `title`과 unknown field는 거절한다.
- `summary`는 문자열이고 나머지 세 필드는 문자열 배열이다.
- 기존 secret redaction은 유지한다.
- redaction 후 trim과 v2 길이 제한을 검사한다.
- v1 sanitizer의 truncation 동작은 v2에 적용하지 않는다.
- 최종 redaction·validation 결과가 preview와 immutable wire payload에 동일하게 사용된다.

## 5. 필드 의미

### `sourceRecordId`

- outbox 생성 시 한 번만 만든다.
- 네트워크 실패, 401 해결 후 재시도, 응답 손실 시에도 변경하지 않는다.
- backend idempotency key의 일부다.

### `sourceClient`

- integration이 공통 CLI에 target을 전달하면 CLI가 결정한다.
- `--target manual`과 target 생략은 모두 `MANUAL_CLI`다.
- integration이 payload JSON을 직접 작성하지 않는다.

### `generatedAt`, `timeZoneId`, `localDate`

- `generatedAt`은 사용자가 검토한 뒤 outbox를 생성한 UTC 시각이다.
- `timeZoneId`는 OS에서 얻은 IANA timezone ID다.
- `localDate`는 해당 instant를 `timeZoneId`로 변환한 `YYYY-MM-DD`다.
- 신뢰할 수 있는 IANA zone을 얻지 못하면 임의 추정하지 않고 생성을 중단한다.

### 작업 내용 필드

- `summary`: 사용자가 검토한 현재 작업 결과의 간결한 요약
- `completed`: 완료한 항목
- `changedFiles`: 저장소 기준 상대 경로
- `nextActions`: 다음에 진행할 항목
- `blockers`: 막힌 항목, 없으면 `[]`

전체 대화 요약, 세션 전문, 코드 본문 또는 diff를 포함하지 않는다.

## 6. 전송하지 않는 정보

schema v2는 다음 정보를 포함하지 않는다.

- provider
- model 이름과 버전
- 입력·출력 토큰 수
- 프롬프트
- AI 응답 전문
- 전체 대화 또는 세션 전문
- 코드 본문
- diff 또는 patch
- Git remote URL
- 절대 경로와 사용자 홈 경로
- API key, token, credential 원문

기존 schema v1의 metadata와 usage 정보는 조회 호환을 위해 유지할 수 있지만, v2 checkpoint builder가 이를 복사하지 않는다.

## 7. 변경 파일 수집

공통 CLI만 변경 파일을 수집한다.

허용된 Git 명령:

```text
git status --porcelain=v1 -z --untracked-files=all
```

금지:

```text
git diff
git show
파일 본문 읽기
remote URL 조회
```

검증 규칙:

- `\`를 `/`로 정규화
- 절대 경로 거절
- Windows drive와 UNC 경로 거절
- 빈 segment, `.`, `..`, 제어문자 거절
- 경로당 최대 240자
- 최대 100개
- `.env*`, `*.pem`, `*.key`, `credentials*`, `.ssh/`, `secrets/` 등 민감 패턴 제외
- rename/copy는 NUL 필드 두 개를 모두 소비하고 destination만 후보로 사용

민감 경로는 payload에서 제외한다. 미리보기에서는 제외된 항목 수를 알려주되 민감 경로 원문을 필요 이상으로 다시 출력하지 않는다. 서버에 민감하거나 잘못된 경로가 도달하면 전체 요청을 거절한다.

## 8. Integration 책임

Claude Code, Codex, Antigravity integration은 다음만 담당한다.

- 현재 작업 결과를 summary-file allowlist 형태로 준비
- 공통 CLI 호출
- 자신의 target identifier 전달
- CLI가 만든 정확한 JSON 미리보기와 승인 흐름 연결

integration은 다음을 담당하지 않는다.

- JSON Schema 구현
- 직접 UUID 또는 날짜 생성
- changed-file 수집
- HTTP 인증과 submit
- outbox 상태 전환
- backend endpoint 직접 호출

일반 shell은 integration 없이 동일한 공통 CLI를 사용하고 `MANUAL_CLI`로 기록한다.

## 9. 승인, immutable outbox, delivery sidecar

checkpoint 생성과 submit은 분리한다.

```text
현재 작업 결과 구성
        ↓
공통 CLI redaction과 validation
        ↓
immutable payload와 PENDING sidecar 생성
        ↓
정확한 JSON 미리보기
        ↓
사용자 승인
        ↓
submit
```

파일:

```text
~/.mogako/outbox/<sourceRecordId>.json
~/.mogako/outbox/<sourceRecordId>.delivery.json
```

첫 파일은 wire payload만 가지며 생성 후 수정하지 않는다. delivery 상태는 sidecar에만 저장한다.

```json
{
  "status": "PENDING",
  "attemptCount": 0,
  "lastErrorCode": null,
  "updatedAt": "2026-08-03T06:20:00Z"
}
```

허용 상태:

```text
PENDING
SUBMITTING
DELIVERED
FAILED_RETRYABLE
FAILED_FINAL
```

원칙:

- 승인 전 네트워크 요청 금지
- 자동 전송, 주기적 전송, 세션 종료 hook 전송 금지
- 전송 실패 시 payload 삭제 금지
- 재시도 시 같은 payload bytes와 `sourceRecordId` 유지
- sidecar에 payload, device token 또는 API error body 저장 금지
- backend `UNCHANGED` 응답은 성공으로 처리

## 10. Backend endpoint

```text
POST /api/v1/worklog-imports/checkpoints
Authorization: Worklog <device-token>
```

성공 결과:

```text
CREATED
UNCHANGED
```

schema v2에서는 기존 일별 replace 결과인 `REPLACED`와 `WORKLOG_STALE_IMPORT`를 사용하지 않는다.

## 11. Legacy 호환

- schema v1 `record`, `wrap`, metadata-only 파일은 즉시 삭제하지 않는다.
- v1과 v2는 endpoint와 payload를 명시적으로 구분한다.
- v1 파일에서 source client를 provider/model 값으로 추정하지 않는다.
- backend legacy checkpoint는 `sourceClient=null`로 유지한다.
- `LEGACY_METADATA`는 checkpoint count와 timeline에 포함하되 대표 summary와 summary/list UI 후보에서는 제외한다.
- v1 종료는 backend checkpoint-only 전환과 사용 현황 검증 후 별도 공지한다.

## 12. Contract verification

plugin JSON Schema, fixture와 backend OpenAPI·fixture는 다음이 정확히 일치해야 한다.

```text
11 required fields
4 sourceClient enum values
summary 1000
completed/nextActions/blockers 20 x 300
changedFiles 100 x 240
timeZoneId 64
future skew 5 minutes
additionalProperties false
Authorization: Worklog <device-token>
```

필수 fixture:

```text
valid-codex.json
valid-claude-code.json
valid-antigravity.json
valid-manual-cli.json
invalid-unknown-client.json
invalid-sensitive-path.json
invalid-local-date.json
```

네 valid fixture는 `sourceRecordId`와 `sourceClient`를 제외하고 동일한 구조와 제한 예시를 사용한다.

## 13. 변경 절차

공통 계약 변경이 필요하면 다음 순서를 따른다.

1. `rbxo0128/mogako` 설계 문서 수정
2. 이 문서와 JSON Schema 수정
3. backend DTO/OpenAPI contract test 수정
4. plugin fixture와 validator test 수정
5. 두 저장소 PR에서 동일한 enum, 필드, 제한, 인증 헤더 확인

한 저장소에서만 필드나 enum을 먼저 변경하지 않는다.
