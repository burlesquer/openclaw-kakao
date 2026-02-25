# AGENTS.md

AI 코딩 에이전트를 위한 개발 가이드.

## 프로젝트 개요

OpenClaw Kakao Plugin — 카카오톡 채널 챗봇을 릴레이 서버 경유로 OpenClaw에 연결.

- **런타임**: Node.js 22.12+, ESM (`"type": "module"`)
- **언어**: TypeScript 5.3+ strict mode
- **패키지 매니저**: pnpm
- **테스트**: vitest (612 테스트)
- **빌드**: tsc → `dist/`
- **Private 패키지**: npm 게시 불가 (`"private": true`)

## 명령어

```bash
# 개발
pnpm dev          # tsc --watch
pnpm build        # dist/ 빌드
pnpm typecheck    # 타입 체크 (noEmit)

# 테스트
pnpm test         # watch 모드
pnpm test:run     # CI (단일 실행)
pnpm test:coverage  # 커버리지 리포트

# 코드 품질
pnpm lint         # ESLint (src/, tests/)

# 단일 파일/패턴 테스트
pnpm vitest run tests/unit/relay/client.test.ts
pnpm vitest run -t "should send reply"
pnpm vitest run tests/unit/commands/
```

## 프로젝트 구조

```
index.ts .......................... (36L)  플러그인 엔트리포인트
src/
├── channel.ts .................... (81L)  플러그인 어셈블리 (adapters 조합)
├── runtime.ts .................... (36L)  PluginRuntime 싱글턴
├── types.ts ...................... (447L) 전체 타입 정의
├── version.ts .................... (3L)   버전 상수
├── openclaw.d.ts ................. (25L)  openclaw/plugin-sdk 타입 선언
├── config/
│   └── schema.ts ................. (129L) Zod 스키마 (설정 검증)
├── adapters/                            OpenClaw 어댑터 인터페이스 구현
│   ├── config.ts ................. (132L) 계정 설정 조회/해석
│   ├── gateway.ts ................ (549L) SSE→OpenClaw 메시지 디스패치 (핵심)
│   ├── outbound.ts ............... (52L)  아웃바운드 텍스트 청킹
│   ├── pairing.ts ................ (35L)  페어링 승인 알림
│   ├── security.ts ............... (57L)  DM 정책 해석
│   ├── setup.ts .................. (105L) 설정 적용 헬퍼
│   └── status.ts ................. (117L) 헬스체크/스냅샷 빌더
├── relay/                               릴레이 서버 통신 계층
│   ├── client.ts ................. (146L) HTTP API (sendReply, healthCheck)
│   ├── session.ts ................ (134L) 세션 생성/상태 조회
│   ├── sse.ts .................... (258L) SSE 연결/파싱/재연결 (exponential backoff)
│   └── stream.ts ................. (149L) 토큰 해석 → connectSSE 오케스트레이션
├── kakao/                               카카오 프로토콜 유틸
│   ├── payload.ts ................ (138L) SkillPayload 파싱/검증
│   ├── response.ts ............... (373L) SkillResponse 빌더 + markdown strip + 청킹
│   ├── callback.ts ............... (133L) 콜백 URL 핸들러 (지연 응답용)
│   └── limits.ts ................. (129L) 카카오 제한값 상수 & 검증 함수
└── commands/                            플러그인 커맨드 핸들러
    ├── registry.ts ............... (25L)  커맨드 → 핸들러 매핑
    ├── types.ts .................. (24L)  CommandHandler 타입
    ├── help.ts ................... (105L) /help, /? 캐러셀
    ├── about.ts .................. (65L)  /about 정보 카드
    ├── card.ts ................... (413L) /card 카드 빌더 (text/basic/list/commerce)
    ├── relay.ts .................. (83L)  /relay 서버 상태
    └── session.ts ................ (67L)  /session, /s 세션 정보

tests/
├── setup.ts ...................... 테스트 셋업
├── fixtures/payloads.ts .......... 테스트 데이터
├── unit/                              src/ 미러 구조
│   ├── adapters/ ................. config, gateway, outbound, pairing, security, setup, status
│   ├── config/ ................... schema
│   ├── relay/ .................... client, sse, stream
│   ├── kakao/ .................... callback, limits, payload, response
│   ├── commands/ ................. about, card, help, registry, relay, session
│   ├── channel.test.ts
│   ├── runtime.test.ts
│   ├── types.test.ts
│   ├── version.test.ts
│   └── index.test.ts
└── integration/
    ├── plugin-export.test.ts
    └── relay-client.test.ts

소스: 28파일 4,046줄 | 테스트: 31파일 8,008줄
```

## 아키텍처

### 메시지 인바운드 플로우

```
카카오톡 사용자
    │
    ▼
릴레이 서버 (외부)
    │ SSE (v1/events)
    ▼
relay/sse.ts ─── connectSSE()
    │ InboundMessage 이벤트
    ▼
relay/stream.ts ─── startRelayStream()
    │ 토큰 해석 (sessionToken > relayToken > env > createSession)
    ▼
adapters/gateway.ts ─── handleInboundMessage()
    │
    ├─ /커맨드? → commands/registry.ts → 핸들러 실행 → sendReply
    │
    └─ 일반 메시지? → buildMessageContext()
         │
         ▼
    OpenClaw 코어
    ├─ finalizeInboundContext()
    └─ dispatchReplyWithBufferedBlockDispatcher()
         │
         ▼
    deliver() 콜백
    ├─ channelData.kakao 있으면 → 카드 outputs 빌드
    ├─ 텍스트만 있으면 → tryParseKakaoCard() 시도
    │   ├─ JSON 카드 감지 → 카드로 변환
    │   └─ 아니면 → stripMarkdown() → simpleText
    └─ sendReply() → 릴레이서버 → 카카오톡
```

### 메시지 아웃바운드 처리 순서 (gateway.ts deliver)

1. `channelData.kakao` 확인 → 카드 outputs 직접 사용
2. `mediaUrls` 확인 → `simpleImage` 변환 (최대 3개)
3. `text` 확인 → `tryParseKakaoCard()` (JSON 카드 감지)
4. JSON 아니면 → `stripMarkdown()` → `simpleText`
5. outputs 최대 3개 자르기
6. 세션 경고 필요시 → quickReplies에 `/compact` 버튼 추가

### 모듈별 역할

| 모듈 | 역할 |
|------|------|
| `adapters/` | OpenClaw 플러그인 SDK 인터페이스 구현. config, gateway, outbound, pairing, security, setup, status |
| `relay/` | 릴레이 서버와의 통신. SSE 연결, HTTP API, 세션 관리 |
| `kakao/` | 카카오 프로토콜 처리. 페이로드 파싱, 응답 빌드, 제한값 검증, 콜백 핸들링 |
| `commands/` | `/help`, `/about` 등 플러그인 자체 커맨드. registry.ts에서 매핑 |
| `config/` | Zod 스키마 기반 설정 검증 |

### 핵심 타입 (types.ts)

| 타입 | 용도 |
|------|------|
| `KakaoSkillPayload` | 카카오 인바운드 페이로드 |
| `KakaoSkillResponse` | 카카오 응답 (v2.0) |
| `KakaoOutput` | simpleText, basicCard 등 유니온 |
| `ResolvedKakaoTalkChannel` | 해석된 채널 계정 (config + 런타임 상태) |
| `InboundMessage` | 릴레이 서버에서 오는 정규화된 메시지 |
| `SSEEvent` | SSE 이벤트 유니온 (message, ping, error, pairing_complete, pairing_expired) |
| `KakaoChannelData` | 에이전트 → 카카오 카드 변환용 데이터 |
| `ChannelAccountSnapshot` | 채널 계정 런타임 상태 스냅샷 |

## 코드 스타일

### TypeScript

- **Strict mode**: 모든 strict 체크 활성화
- **모듈**: NodeNext (ESM)
- **타겟**: ES2022

```typescript
// 명시적 type import
import type { KakaoSkillPayload } from "../types.js";

// 상대 import 시 항상 .js 확장자
import { sendReply } from "../relay/client.js";

// 객체는 interface 선호
export interface GatewayContext {
  account: ResolvedKakaoTalkChannel;
  accountId: string;
}

// unknown 선호, type guard로 검증
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
```

### 네이밍 규칙

```typescript
// 파일: kebab-case
src/relay/client.ts

// 인터페이스: PascalCase
interface KakaoSkillPayload { ... }

// 함수: camelCase, 동사 시작
function validateAccountConfig() { ... }
function buildMessageContext() { ... }

// 상수: SCREAMING_SNAKE_CASE
const DEFAULT_TIMEOUT_MS = 10000;

// 타입: PascalCase, union 적극 활용
type KakaoDmPolicy = "pairing" | "allowlist" | "open" | "disabled";
```

### 에러 처리

```typescript
// instanceof로 에러 타입 체크
try {
  await sendReply(config, messageId, response);
} catch (err) {
  const errMsg = err instanceof Error ? err.message : String(err);
  log?.error(`Reply failed: ${errMsg}`);
}

// 검증은 Result 패턴
type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };
```

### Zod 스키마

```typescript
// 한국어 검증 메시지 사용
export const KakaoAccountConfigSchema = z.object({
  relayUrl: z.string().min(1, "relayUrl은 필수입니다"),
  reconnectDelayMs: z.number()
    .min(500, "reconnectDelayMs는 최소 500ms 이상이어야 합니다")
    .default(1000),
});

// 스키마에서 타입 추론
export type KakaoAccountConfig = z.infer<typeof KakaoAccountConfigSchema>;
```

## 테스트 패턴

### 구조

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("ComponentName", () => {
  describe("methodName", () => {
    it("should do expected behavior", () => {
      // Arrange, Act, Assert
    });
  });
});
```

### 모킹

```typescript
// 글로벌 모킹
global.fetch = vi.fn();

// 모듈 모킹
vi.mock("../../../src/runtime.js", () => ({
  getKakaoRuntime: () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }),
}));

// 리셋
beforeEach(() => { vi.clearAllMocks(); });
```

### 커버리지 기준

| 항목 | 기준 |
|------|------|
| Lines | 80% |
| Functions | 80% |
| Branches | 70% |
| Statements | 80% |

## 커밋 컨벤션

Conventional Commits 형식.

```
<type>: <message>
```

| Type | 설명 |
|------|------|
| `feat:` | 새 기능 |
| `fix:` | 버그 수정 |
| `docs:` | 문서 |
| `refactor:` | 리팩토링 |
| `test:` | 테스트 |
| `chore:` | 빌드/설정 |

## 의존성

| 패키지 | 용도 |
|--------|------|
| `zod` | 스키마 검증 |
| `openclaw` | 피어 의존성 (plugin SDK) |
| `vitest` | 테스트 |
| `typescript` | 컴파일러 |
| `eslint` | 린터 |

## import 순서

```typescript
// 1. 외부 패키지
import { z } from "zod";

// 2. type import
import type { KakaoSkillPayload } from "../types.js";

// 3. 내부 모듈
import { sendReply } from "./client.js";
```

## 안티패턴

```typescript
// NEVER: as any, @ts-ignore
const data = result as any;        // BAD

// NEVER: 빈 catch
catch(e) {}                         // BAD

// NEVER: .js 확장자 누락
import { foo } from "./bar";        // BAD → "./bar.js"

// NEVER: unknown 대신 any 사용
function handle(data: any) { ... }  // BAD → unknown + type guard
```
