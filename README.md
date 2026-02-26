# OpenClaw Kakao Plugin

카카오톡 채널을 OpenClaw에 연결하는 플러그인입니다. 릴레이 서버를 통해 카카오톡 채널 챗봇과 OpenClaw 에이전트를 연동합니다.

---

## 요구사항

- Node.js 22.12+
- pnpm (권장) 또는 npm
- OpenClaw ≥ 2026.1.29
- [kakao-relay](../kakao-relay/) 서버 (별도 실행 필요)

## 설치

### npm 설치 (권장)

GitHub Packages 레지스트리를 등록합니다 (최초 1회):

```bash
echo "@burlesquer:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

플러그인 설치:

```bash
openclaw plugins install @burlesquer/openclaw-kakao
openclaw gateway restart
```

### 로컬 설치 (개발용)

소스를 직접 수정하며 개발할 때 사용합니다.

```bash
git clone https://github.com/burlesquer/openclaw-kakao.git
cd openclaw-kakao
pnpm install    # 필수: 의존성 미설치 시 'Cannot find module' 에러 발생
openclaw plugins install -l .
openclaw gateway restart
```

### 설치 확인

```bash
openclaw plugins list    # openclaw-kakao가 loaded 상태인지 확인
openclaw channels list   # 채널 목록에 표시되는지 확인
```

### 제거

```bash
openclaw plugins uninstall openclaw-kakao
openclaw gateway restart
```

---

## 전체 구동 순서

```
1. kakao-relay 서버 시작     →  docker compose up -d (kakao-relay/)
2. 플러그인 설치             →  openclaw plugins install @burlesquer/openclaw-kakao
3. OpenClaw 설정             →  relayUrl 지정 (~/.openclaw/openclaw.json)
4. 게이트웨이 재시작          →  openclaw gateway restart
5. 카카오 오픈빌더 스킬 연결  →  스킬 URL을 릴레이 서버로 설정
6. 카카오톡에서 페어링        →  /pair <코드>
```

---

## 카카오톡 연결

### 페어링 플로우

1. OpenClaw에게 **"카카오톡 연결해줘"**
2. OpenClaw가 페어링 코드 제공 (예: `ABCD-1234`)
3. 자체 카카오톡 채널의 채팅창에서 `/pair ABCD-1234` 입력
4. 연결 완료

> **중요**: 반드시 OpenClaw가 먼저 코드를 생성합니다. 카카오톡 채널은 직접 생성하고 릴레이 서버에 연결해야 합니다.

### 토큰 해석 우선순위

플러그인은 다음 순서로 인증 토큰을 결정합니다:

1. `sessionToken` — 자동 생성된 세션 토큰
2. `relayToken` — 설정 파일의 릴레이 토큰
3. `OPENCLAW_TALKCHANNEL_RELAY_TOKEN` — 환경변수
4. 신규 세션 생성 → 페어링 코드 발급

---

## 릴레이 서버

이 플러그인은 **[kakao-relay](../kakao-relay/)** 서버를 통해 카카오톡 채널과 통신합니다. 사용하려면 릴레이 서버를 먼저 실행해야 합니다.

### 로컬 개발 시

```bash
cd ../kakao-relay
docker compose up -d          # PostgreSQL + Redis + 릴레이 서버
curl http://localhost:8080/health  # 헬스체크
```

릴레이 서버 대시보드: http://localhost:8080/dashboard/

> 카카오 웹훅을 로컬에서 받으려면 ngrok 등 터널링이 필요합니다. 자세한 내용은 [kakao-relay README](../kakao-relay/README.md#ngrok-로컬-개발)를 참고하세요.

### 설정 순서

1. 릴레이 서버 실행 (로컬 또는 클라우드 배포)
2. [카카오 i 오픈빌더](https://i.kakao.com/)에서 챗봇 생성 및 스킬 연결
3. 릴레이 서버 Admin UI에서 Account 생성 후 `relayToken` 발급 (또는 자동 세션 사용)
4. 플러그인 설정에서 `relayUrl`과 `relayToken` 지정

---

## 설정 레퍼런스

릴레이 서버 배포 후 `relayUrl`을 반드시 설정해야 합니다.

### 설정 파일 위치

`~/.openclaw/openclaw.json` 또는 `config.yaml`

### 설정 구조

```json
{
  "channels": {
    "openclaw-kakao": {
      "accounts": {
        "default": {
          "relayUrl": "https://your-relay-server.example.com",
          "relayToken": "발급받은_토큰",
          "dmPolicy": "pairing"
        }
      }
    }
  }
}
```

### 전체 옵션

#### 필수 설정

| 옵션 | 타입 | 설명 |
|------|------|------|
| `relayUrl` | string | 릴레이 서버 URL |

#### 사용자 설정

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `relayToken` | string | — | 릴레이 인증 토큰 (환경변수 `OPENCLAW_TALKCHANNEL_RELAY_TOKEN`으로도 설정 가능) |
| `enabled` | boolean | `true` | 채널 활성화 여부 |
| `dmPolicy` | string | `"pairing"` | DM 정책 |
| `allowFrom` | string[] | — | `allowlist` 모드 허용 사용자 ID 목록 |
| `responsePrefix` | string | — | 응답 접두사 (OpenClaw 코어가 자동 삽입) |

#### 고급 설정

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `channelId` | string | — | 채널 식별자 (페어링 기반 식별 시 불필요) |
| `textChunkLimit` | number | `400` | 텍스트 청크 최대 길이 (100~1000) |
| `chunkMode` | string | `"sentence"` | 텍스트 청킹 모드: `sentence`, `newline`, `length` |

#### dmPolicy 옵션

| 값 | 설명 |
|----|------|
| `pairing` | 페어링된 사용자만 (기본값, 권장) |
| `allowlist` | `allowFrom` 목록의 사용자만 |
| `open` | 모든 사용자 |
| `disabled` | DM 비활성화 |

---

## 플러그인 커맨드

카카오톡 채팅에서 `/`로 시작하는 커맨드를 입력하면 플러그인이 직접 처리합니다.

| 커맨드 | 별칭 | 설명 |
|--------|------|------|
| `/help` | `/?` | 사용 가이드 캐러셀 |
| `/about` | — | 플러그인 정보 |
| `/relay` | — | 릴레이 서버 상태 확인 |
| `/session` | `/s` | 세션 정보 (메시지 카운트) |
| `/card` | — | 카드 메시지 빌더 |

---

## 카드 메시지

에이전트가 JSON 형식으로 응답하면 카카오톡 카드로 자동 변환됩니다.

> **주의**: 카드를 보낼 때는 JSON만 단독으로 보내야 합니다. 텍스트와 섞으면 변환되지 않습니다.

### 지원 카드 타입

| 타입 | 설명 |
|------|------|
| `textCard` | 텍스트 + 버튼 |
| `basicCard` | 이미지 + 텍스트 + 버튼 |
| `listCard` | 리스트 형태 (항목 2~5개) |
| `commerceCard` | 상품 카드 |
| `simpleImage` | 이미지만 |
| `carousel` | 여러 카드 슬라이드 (2~10개) |

### 예시

#### textCard

```json
{"textCard":{"title":"제목","description":"설명","buttons":[{"label":"버튼","action":"message","messageText":"클릭!"}]}}
```

#### basicCard

```json
{"basicCard":{"title":"제목","description":"설명","thumbnail":{"imageUrl":"https://example.com/image.jpg"},"buttons":[{"label":"자세히","action":"webLink","webLinkUrl":"https://example.com"}]}}
```

#### listCard

```json
{"listCard":{"header":{"title":"목록 제목"},"items":[{"title":"항목 1","description":"설명 1"},{"title":"항목 2","description":"설명 2"}]}}
```

#### commerceCard

```json
{"commerceCard":{"title":"상품명","price":15000,"currency":"won","discount":2000,"thumbnails":[{"imageUrl":"https://example.com/product.jpg"}],"buttons":[{"label":"구매하기","action":"webLink","webLinkUrl":"https://example.com/buy"}]}}
```

#### quickReplies (빠른 응답)

```json
{"textCard":{"title":"선택하세요"},"quickReplies":[{"label":"A","action":"message","messageText":"A"},{"label":"B","action":"message","messageText":"B"}]}
```

### 버튼 액션

| action | 설명 | 필수 필드 |
|--------|------|-----------|
| `message` | 메시지 전송 | `messageText` |
| `webLink` | 웹 링크 | `webLinkUrl` |
| `phone` | 전화 걸기 | `phoneNumber` |
| `share` | 공유하기 | — |
| `operator` | 상담원 연결 | — |

### 카카오 제한값

| 항목 | 제한 |
|------|------|
| 말풍선 (outputs) | 최대 3개 |
| simpleText | 1000자 (화면 표시 400자) |
| 카드 제목 | 50자 |
| 카드 설명 | 230자 |
| 버튼 | 카드당 최대 3개, 라벨 14자 |
| quickReplies | 최대 10개, 라벨 14자 |
| carousel 아이템 | 2~10개 |
| listCard 항목 | 2~5개 |

---

## /card 커맨드

카카오톡에서 직접 카드 메시지를 만들 수 있습니다.

```
/card text "제목" "설명" [--buttons "라벨1|url,라벨2|msg"] [--quick "A,B,C"]
/card basic "제목" "설명" --image <url> [--buttons "라벨|url"] [--quick "A,B"]
/card list "헤더" "항목1|설명1,항목2|설명2" [--buttons "더보기|url"]
/card commerce "상품명" --price 15000 --image <url> [--discount 2000] [--buttons "구매|url"]
```

### 버튼 자동 감지

`--buttons` 값의 `|` 뒤 데이터로 액션을 자동 결정합니다:

- `http://` 또는 `https://` → webLink
- 7자리 이상 숫자/기호 → phone
- 그 외 → message

---

## 문제 해결

| 문제 | 해결 |
|------|------|
| 플러그인이 안 됨 | OpenClaw에게 "플러그인 진단해줘" |
| 채널이 안 보임 | `openclaw gateway restart` |
| 페어링이 안 됨 | "카카오톡 연결해줘" (처음부터 다시) |
| 대화가 멈춤 / tool 에러 | `/reset` 또는 `/compact` 실행 |

### 세션 관리

대화가 길어지면 OpenClaw 코어의 컴팩션 과정에서 에러가 발생할 수 있습니다. 플러그인은 50개 메시지마다 자동으로 `/compact` 안내를 표시합니다.

| 방법 | 언제 사용 | 효과 |
|------|-----------|------|
| `/compact` | 대화가 복잡해지기 전 | 히스토리 압축으로 문제 예방 |
| `/reset` | 에러로 대화가 막혔을 때 | 세션 초기화로 즉시 해결 |

> **권장**: 장시간 대화 시 주기적으로 `/compact`를 실행하세요.

---

## OpenClaw 에이전트 가이드

> 이 섹션은 OpenClaw가 참조하는 자동화 지침입니다.

### 플러그인 설치 요청 시

```bash
# 1. 로컬 설치 (링크 모드)
openclaw plugins install -l {플러그인_경로}

# 2. 확인 (openclaw-kakao가 loaded 상태인지)
openclaw plugins list

# 3. 게이트웨이 재시작
openclaw gateway restart

# 4. 채널 확인
openclaw channels list
```

### 카카오톡 연결 요청 시

1. 페어링 코드 생성
2. 사용자에게 안내: "카카오톡 채팅에서 `/pair {코드}`를 입력하세요"
3. 페어링 완료 대기

---

## 라이선스

MIT
