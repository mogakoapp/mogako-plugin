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
manual shell      -> MANUAL_CLI
```

`sourceClient`는 앱에서 checkpoint 출처를 표시하기 위한 값이다. 인증, 권한, 과금 또는 신뢰도 판단에 사용하지 않는다.

## 3. 공통 구조

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

최상위 필드는 exact allowlist다. 알 수 없는 필드는 plugin validator와 backend validation에서 모두 거절한다.

## 4. 필드 계약

### `schemaVersion`

- integer
- 정확히 `2`

### `sourceRecordId`

- UUID
- outbox 생성 시 한 번만 만든다.
- 네트워크 실패, 401 해결 후 재시도, 응답 손실 시에도 변경하지 않는다.
- backend idempotency key의 일부다.

### `sourceClient`

- 위 네 enum 중 하나
- integration이 공통 CLI에 target을 전달하면 CLI가 결정한다.
- integration이 payload JSON을 직접 작성하지 않는다.

### `generatedAt`

- UTC ISO-8601 instant
- checkpoint 내용을 사용자가 검토한 뒤 outbox를 생성한 시각
- backend는 과거 전송 지연을 허용하되 과도한 미래 시각은 거절한다.

### `timeZoneId`

- IANA timezone ID
- 예: `Asia/Seoul`
- OS에서 신뢰할 수 있는 IANA zone을 얻지 못하면 임의 추정하지 않고 checkpoint 생성을 중단한다.

### `localDate`

- `YYYY-MM-DD`
- `generatedAt`을 `timeZoneId`로 변환한 날짜와 일치해야 한다.

### `summary`

- 사용자가 검토한 현재 작업 결과의 간결한 요약
- 공백 불가
- 전체 대화 요약이나 세션 전문을 포함하지 않는다.

### `completed`

- 완료한 항목 목록
- 문자열 배열
- 작업 결과만 포함한다.

### `changedFiles`

- Git 저장소 기준 상대 경로 목록
- 문자열 배열
- `/` 구분자로 정규화한다.
- 파일 내용이나 diff를 포함하지 않는다.

### `nextActions`

- 다음에 진행할 항목 목록
- 문자열 배열

### `blockers`

- 선택적인 막힌 항목 목록
- 값이 없으면 빈 배열을 사용한다.

## 5. 전송하지 않는 정보

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

## 6. 변경 파일 수집

공통 CLI만 변경 파일을 수집한다.

허용된 Git 명령:

```text
git status --porcelain=v1 -z
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

민감 경로는 payload에서 제외한다. 미리보기에서는 제외된 항목 수와 이유를 알려주되 필요 이상으로 민감 경로를 다시 출력하지 않는다.

## 7. Integration 책임

Claude Code, Codex, Antigravity integration은 다음만 담당한다.

- 현재 작업 결과를 허용 필드 형태로 준비
- 공통 CLI 호출
- 자신의 target identifier 전달
- CLI가 만든 정확한 JSON 미리보기를 사용자에게 보여주는 흐름 연결

integration은 다음을 담당하지 않는다.

- JSON Schema 구현
- 직접 UUID 또는 날짜 생성
- changed-file 수집
- HTTP 인증과 submit
- outbox 상태 전환
- backend endpoint 직접 호출

일반 shell은 integration 없이 동일한 공통 CLI를 사용하고 `MANUAL_CLI`로 기록한다.

## 8. 승인과 outbox

checkpoint 생성과 submit은 분리한다.

```text
현재 작업 결과 구성
        ↓
공통 CLI validation
        ↓
PENDING outbox 생성
        ↓
정확한 JSON 미리보기
        ↓
사용자 승인
        ↓
submit
```

outbox 상태:

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
- 전송 실패 시 outbox 삭제 금지
- 재시도 시 같은 `sourceRecordId` 유지
- backend `UNCHANGED` 응답은 성공으로 처리

## 9. Backend endpoint

```text
POST /api/v1/worklog-imports/checkpoints
Authorization: Mogako-Worklog <device-token>
```

성공 결과:

```text
CREATED
UNCHANGED
```

schema v2에서는 기존 일별 replace 결과인 `REPLACED`와 `WORKLOG_STALE_IMPORT`를 사용하지 않는다.

## 10. Legacy 호환

- schema v1 `record`, `wrap`, metadata-only 파일은 즉시 삭제하지 않는다.
- v1과 v2는 endpoint와 payload를 명시적으로 구분한다.
- v1 파일에서 source client를 provider/model 값으로 추정하지 않는다.
- backend legacy checkpoint는 `sourceClient=null`로 유지한다.
- v1 종료는 backend checkpoint-only 전환과 사용 현황 검증 후 별도 공지한다.

## 11. Contract verification

plugin test fixture와 backend OpenAPI 예시는 다음이 일치해야 한다.

- 필드 이름
- 필수/선택 여부
- source client enum
- 문자열과 배열 제한
- timezone/date 검증 의미
- 경로 검증 의미
- unknown field 거절

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

세 integration의 valid fixture는 `sourceClient`를 제외하고 동일한 구조를 사용해야 한다.

## 12. 변경 절차

공통 계약 변경이 필요하면 다음 순서를 따른다.

1. `rbxo0128/mogako` 설계 문서 수정
2. 이 문서와 JSON Schema 수정
3. backend DTO/OpenAPI contract test 수정
4. plugin fixture와 validator test 수정
5. 두 저장소 PR에서 동일한 enum과 예시 확인

한 저장소에서만 필드나 enum을 먼저 변경하지 않는다.
