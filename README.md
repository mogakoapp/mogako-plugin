# Mogako Plugin

Claude Code, Codex, Antigravity의 개발 활동을 **개인정보 최소 수집 방식**으로 모각코 작업 기록 JSON으로 만드는 실험적 CLI/Agent Skill 프로젝트입니다.

> 현재 v0.1은 서버로 전송하지 않습니다. 모든 결과는 로컬 `~/.mogako/outbox`에만 저장됩니다.

## 핵심 원칙

- 최초 기본값은 `METADATA_ONLY`입니다.
- 원본 프롬프트, 답변, 소스코드, diff, 파일명, 경로, 저장소 주소를 수집하지 않습니다.
- 작업 요약은 사용자가 `REVIEWED_SUMMARY`를 명시적으로 켠 경우에만 허용합니다.
- 요약은 허용된 필드만 받고, 사용자가 검토했다는 `--reviewed` 없이는 처리하지 않습니다.
- 자동 업로드는 꺼져 있으며 v0.1에는 네트워크 전송 코드가 없습니다.
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
  "automaticUpload": false
}
```

### 2. 활동 메타데이터 기록

도구에서 토큰 수를 제공하지 않는다면 토큰 옵션을 생략합니다.

```bash
mogako record \
  --provider codex \
  --model gpt-5.6-codex \
  --focus-seconds 3000 \
  --input-tokens 42120 \
  --output-tokens 8140
```

### 3. 상태 확인

```bash
mogako status
mogako status --json
```

### 4. 오늘 기록 마감

추가 요약 없이 메타데이터만 로컬 outbox에 저장합니다.

```bash
mogako wrap
```

파일을 쓰지 않고 결과만 확인하려면:

```bash
mogako wrap --dry-run
```

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
```

## 현재 범위와 다음 단계

현재 구현:

- 공통 Node.js CLI
- 개인정보 기본값과 모드 전환
- 일별 활동 JSONL 집계
- 메타데이터-only worklog 생성
- 검토된 요약 allowlist/민감정보 마스킹
- 로컬 outbox
- Claude Code, Codex, Antigravity skill

추후 구현:

- 각 CLI가 제공하는 실제 usage 이벤트 어댑터
- 모각코 기기 연결(device authorization)
- worklog-write-only 토큰
- 전송 전 네이티브 미리보기
- 사용자가 승인한 JSON의 Mogako API 전송

자세한 개인정보 설계는 [PRIVACY.md](./PRIVACY.md), 구조는 [docs/architecture.md](./docs/architecture.md)를 참고하세요.
