# Mogako Plugin

Claude Code, Codex, Antigravity의 개발 활동을 **개인정보 최소 수집 방식**으로 모각코 작업 기록 JSON으로 만드는 CLI/Agent Skill 프로젝트입니다.

## 핵심 원칙

- 최초 기본값은 `METADATA_ONLY`입니다.
- 원본 프롬프트, 답변, 소스코드, diff, 파일명, 경로, 저장소 주소를 수집하지 않습니다.
- 작업 요약은 사용자가 `REVIEWED_SUMMARY`를 명시적으로 켠 경우에만 허용합니다.
- 요약은 허용된 필드만 받고, 사용자가 검토했다는 `--reviewed` 없이는 처리하지 않습니다.
- 자동 업로드는 항상 꺼져 있습니다. 서버 전송은 `submit` 또는 승인된 `wrap --submit`에서만 발생합니다.
- 연결 토큰은 작업 기록 쓰기 전용이며 CLI 출력에 노출하지 않습니다.
- 토큰 수는 도구가 신뢰할 수 있는 값을 제공하거나 사용자가 직접 넣은 경우에만 기록합니다. 추정하지 않습니다.

## 요구 사항

- Node.js 20 이상

## 로컬 개발

```bash
npm install
npm link
mogako init
```

링크하지 않고도 실행할 수 있습니다.

```bash
node src/cli.js init
```

## 기본 사용 흐름

### 1. 초기화

```bash
mogako init
```

생성되는 기본 설정:

```json
{
  "schemaVersion": 1,
  "privacyMode": "METADATA_ONLY",
  "summaryReviewRequired": true,
  "automaticUpload": false,
  "apiBaseUrl": "https://api.mogako.app/api/v1/"
}
```

로컬 백엔드 테스트에서는 연결할 때만 API 주소를 덮어쓸 수 있습니다.

```bash
mogako connect ABCD2345 --api-base-url http://localhost:8080/api/v1/
```

HTTPS가 기본이며 HTTP는 `localhost`와 `127.0.0.1` 개발 환경에서만 허용합니다.

### 2. 코딩 도구 연결

모각코 앱의 `마이 > 코딩 도구 연결`에서 일회용 코드를 발급한 뒤 입력합니다.

```bash
mogako connect ABCD2345 --device-name "Windows Development PC"
```

교환된 기기 토큰은 `~/.mogako/connection.json`에만 저장됩니다. Unix 계열에서는 홈 디렉터리 권한을 `0700`, 연결 파일을 `0600`으로 제한합니다. CLI는 토큰을 출력하지 않습니다.

로컬 연결 파일을 지우려면:

```bash
mogako disconnect
```

이 명령은 로컬 파일만 제거합니다. 서버 토큰을 즉시 무효화하려면 모각코 앱의 연결 기기 목록에서 해당 기기를 해제해야 합니다.

### 3. 활동 메타데이터 기록

도구에서 토큰 수를 제공하지 않는다면 토큰 옵션을 생략합니다.

```bash
mogako record \
  --provider codex \
  --model gpt-5.6-codex \
  --focus-seconds 3000 \
  --input-tokens 42120 \
  --output-tokens 8140
```

### 4. 상태 확인

```bash
mogako status
mogako status --json
```

### 5. 오늘 기록 마감

추가 요약 없이 메타데이터만 로컬 outbox에 저장합니다.

```bash
mogako wrap
```

파일을 쓰지 않고 결과만 확인하려면:

```bash
mogako wrap --dry-run
```

## 명시적 서버 제출

이미 생성된 outbox 파일을 직접 제출합니다.

```bash
mogako submit ~/.mogako/outbox/2026-07-30-<record-id>.json
```

`wrap` 직후 제출하려면:

```bash
mogako wrap --submit
```

CLI는 전송 전에 개인정보 모드와 정확한 JSON 본문을 출력하고 대화형 확인을 요청합니다. 비대화식 환경에서는 명시적 승인을 나타내는 `--yes`가 필요합니다.

```bash
mogako wrap --submit --yes
```

네트워크 오류나 서버 오류가 발생해도 outbox 파일은 삭제하거나 변경하지 않습니다. 같은 `recordId`를 다시 제출하면 서버 멱등 규칙에 따라 기존 결과가 반환됩니다. 더 최신 기록이 이미 저장된 경우 `WORKLOG_STALE_IMPORT` 오류가 표시되며 기존 outbox는 유지됩니다.

## 검토 후 작업 요약

먼저 사용자가 직접 모드를 변경해야 합니다.

```bash
mogako privacy reviewed-summary
```

허용되는 요약 JSON은 다음 필드뿐입니다.

```json
{
  "title": "인증 세션 갱신 수정",
  "summary": "리프레시 과정에서 논리 세션 ID를 유지하고 관련 테스트를 보완했다.",
  "completed": ["세션 ID 유지", "통합 테스트 추가"],
  "nextActions": ["Flutter 인증 연동"],
  "blockers": []
}
```

사용자가 내용을 검토한 뒤에만 실행합니다.

```bash
mogako wrap --summary-file ./summary.json --reviewed
```

`METADATA_ONLY` 상태이거나 `--reviewed`가 없으면 요약 처리를 거부합니다.

## Agent Skill 설치

현재 npm에 배포하기 전에는 저장소에서 `npm link` 후 실행합니다.

```bash
mogako install --target claude-code
mogako install --target codex
mogako install --target antigravity
mogako install --target antigravity-cli
```

기존 스킬을 교체하려면 `--force`를 추가합니다.

### 호출 방식

- Claude Code standalone skill: `/mogako`
- Codex: `$mogako` 또는 `/skills`에서 선택
- Antigravity: Mogako skill 선택/호출
- LLM을 거치지 않는 메타데이터 마감: 터미널에서 `mogako wrap`

Claude Code 플러그인 자체를 저장소에서 테스트하려면:

```bash
claude --plugin-dir ./integrations/claude-code
```

플러그인 방식에서는 Claude Code의 네임스페이스 규칙에 따라 `/mogako:mogako`로 표시될 수 있습니다. 짧은 `/mogako` 호출은 `mogako install --target claude-code`가 설치하는 standalone skill을 사용합니다.

## 테스트

```bash
npm test
npm run check
```

## 현재 범위

- 공통 Node.js CLI
- 개인정보 기본값과 모드 전환
- 일별 활동 JSONL 집계
- 메타데이터-only worklog 생성
- 검토된 요약 allowlist/민감정보 마스킹
- 로컬 outbox
- 일회용 코드 기반 기기 연결
- 쓰기 전용 토큰을 이용한 명시적 제출
- Claude Code, Codex, Antigravity skill

자세한 개인정보 설계는 [PRIVACY.md](./PRIVACY.md), 구조는 [docs/architecture.md](./docs/architecture.md)를 참고하세요.
