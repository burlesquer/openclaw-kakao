# openclaw-kakao 에이전트 가이드

카카오톡 채널 → 릴레이 서버 → OpenClaw 연결 플러그인. 릴레이 모드 전용.

## 필수 규칙

**카드 메시지를 보낼 때는 JSON만 단독으로 보내세요.**
```
 잘못된 예: "결과입니다! {"textCard":{"title":"결과"}}"
 올바른 예: {"textCard":{"title":"결과","description":"설명"}}
```
텍스트와 JSON을 섞으면 카드로 변환되지 않습니다 (gateway.ts `tryParseKakaoCard` 참조).

## 설정

`channels.openclaw-kakao.accounts.<accountId>` 구조. Zod 스키마: `src/config/schema.ts`

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|:----:|--------|------|
| `relayUrl` | string | **필수** | — | 릴레이 서버 URL |
| `relayToken` | string | | — | 릴레이 인증 토큰 (env `OPENCLAW_TALKCHANNEL_RELAY_TOKEN` 가능) |
| `enabled` | boolean | | `true` | 채널 활성화 |
| `dmPolicy` | `pairing\|allowlist\|open\|disabled` | | `"pairing"` | DM 정책 |
| `allowFrom` | string[] | | — | allowlist 모드 허용 사용자 |
| `responsePrefix` | string | | — | 응답 접두사 (OpenClaw 코어가 자동 삽입) |
| `channelId` | string | | — | 채널 식별자 (선택) |
| `textChunkLimit` | number | | `400` | 텍스트 청크 최대 길이 (100~1000) |
| `chunkMode` | `sentence\|newline\|length` | | `"sentence"` | 청킹 모드 |

## 카드 메시지 타입

### simpleText (기본)
그냥 텍스트로 응답하면 됩니다.

### textCard
```json
{"textCard":{"title":"제목","description":"설명","buttons":[{"label":"버튼","action":"message","messageText":"클릭"}]}}
```

### basicCard
```json
{"basicCard":{"title":"제목","description":"설명","thumbnail":{"imageUrl":"https://..."},"buttons":[{"label":"보기","action":"webLink","webLinkUrl":"https://..."}]}}
```

### listCard
```json
{"listCard":{"header":{"title":"목록"},"items":[{"title":"항목1","description":"설명"},{"title":"항목2","description":"설명"}]}}
```

### commerceCard
```json
{"commerceCard":{"title":"상품","price":15000,"currency":"won","thumbnails":[{"imageUrl":"https://..."}],"buttons":[{"label":"구매","action":"webLink","webLinkUrl":"https://..."}]}}
```

### simpleImage
```json
{"simpleImage":{"imageUrl":"https://...","altText":"설명"}}
```

### carousel
```json
{"carousel":{"type":"basicCard","items":[{"title":"1","thumbnail":{"imageUrl":"https://..."}},{"title":"2","thumbnail":{"imageUrl":"https://..."}}]}}
```

### quickReplies (카드 하단 버튼)
```json
{"textCard":{"title":"선택"},"quickReplies":[{"label":"A","action":"message","messageText":"A"},{"label":"B","action":"message","messageText":"B"}]}
```

## 버튼 액션

| action | 필수 필드 | 설명 |
|--------|-----------|------|
| `message` | `messageText` | 메시지 전송 |
| `webLink` | `webLinkUrl` | 웹 링크 |
| `phone` | `phoneNumber` | 전화 |
| `share` | — | 공유 |
| `operator` | — | 상담원 연결 |

## 카카오 제한값

| 항목 | 제한 |
|------|------|
| outputs | 최대 3개 |
| simpleText | 1000자 (표시 400자) |
| 카드 제목 | 50자 |
| 카드 설명 | 230자 |
| 버튼 | 카드당 최대 3개, 라벨 14자 |
| quickReplies | 최대 10개, 라벨 14자 |
| carousel | 2~10개 |
| listCard items | 2~5개 |

## 카드 사용 기준

**카드 사용**: 선택지 제공, 버튼 액션, 이미지+정보, 리스트, 상품 정보
**일반 텍스트**: 대화, 간단한 답변, 긴 설명, 코드/로그

## 플러그인 커맨드

사용자가 직접 입력하는 커맨드 (gateway.ts에서 OpenClaw 디스패치 전에 가로챔):

| 커맨드 | 별칭 | 설명 |
|--------|------|------|
| `/help` | `/?` | 사용 가이드 캐러셀 |
| `/about` | — | 플러그인 정보 |
| `/relay` | — | 릴레이 서버 상태 |
| `/session` | `/s` | 세션 정보 (메시지 카운트) |
| `/card` | — | 카드 메시지 빌더 |

## /card 커맨드

```
/card text "제목" "설명" [--buttons "라벨|url,라벨|msg"] [--quick "A,B,C"]
/card basic "제목" "설명" --image <url> [--buttons "라벨|url"]
/card list "헤더" "항목1|설명,항목2|설명" [--buttons "라벨|url"]
/card commerce "상품" --price 15000 --image <url> [--discount 2000]
```

## 토큰 해석 우선순위

1. `config.sessionToken` (자동 세션)
2. `config.relayToken` (설정 파일)
3. `OPENCLAW_TALKCHANNEL_RELAY_TOKEN` 환경변수
4. `createSession()` → 신규 세션 + 페어링 코드 발급

## JSON 카드 자동 감지

에이전트 응답이 `{`로 시작하고 `}`로 끝나며, 다음 키 중 하나를 포함하면 카드로 변환:
`textCard`, `basicCard`, `listCard`, `commerceCard`, `itemCard`, `carousel`, `simpleText`, `simpleImage`, `quickReplies`, `outputs`

해당 키의 값은 반드시 object (배열 키는 array)여야 합니다. 아니면 일반 텍스트로 처리됩니다.
