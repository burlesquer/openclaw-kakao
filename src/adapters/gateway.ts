/**
 * Kakao Channel Gateway Adapter (Simplified)
 *
 * Relay mode only - always starts SSE stream.
 * Uses OpenClaw standard naming: account, startAccount, stopAccount
 *
 * Message dispatch follows OpenClaw pattern:
 * SSE message → finalizeInboundContext → dispatchReplyWithBufferedBlockDispatcher
 *
 * Command handlers are in src/commands/ (registry.ts dispatches).
 */

import type {
  ResolvedKakaoTalkChannel,
  InboundMessage,
  KakaoSkillResponse,
  KakaoOutput,
  KakaoChannelData,
  DeliverPayload,
  ChannelAccountSnapshot,
} from "../types.js";
import { startRelayStream, type StreamCallbacks } from "../relay/stream.js";
import { getKakaoRuntime } from "../runtime.js";
import { sendReply, RelayHttpError } from "../relay/client.js";
import { stripMarkdown } from "../kakao/response.js";
import { PLUGIN_COMMANDS } from "../commands/registry.js";

/**
 * 사용자별 메시지 활동 추적
 * 메시지 개수 기반으로 /compact 안내 시점 결정
 */
interface UserActivity {
  messageCount: number;
  lastWarningCount: number;
  lastAccessedAt: number;
}

export const MAX_USER_ACTIVITY_SIZE = 10000;
export const USER_ACTIVITY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL = 100; // Run cleanup every 100 message operations
let cleanupCounter = 0;

export const userActivity = new Map<string, UserActivity>();

/** @internal Reset cleanup counter (for testing only) */
export function resetCleanupCounter(): void {
  cleanupCounter = 0;
}

/**
 * TTL 만료된 항목 정리
 */
export function cleanupExpiredUserActivity(): number {
  const now = Date.now();
  let removed = 0;
  for (const [key, activity] of userActivity) {
    if (now - activity.lastAccessedAt > USER_ACTIVITY_TTL_MS) {
      userActivity.delete(key);
      removed++;
    }
  }
  return removed;
}

/**
 * 주기적 정리 트리거 (매 CLEANUP_INTERVAL 호출마다)
 */
function maybeCleanup(): void {
  cleanupCounter++;
  if (cleanupCounter >= CLEANUP_INTERVAL) {
    cleanupCounter = 0;
    cleanupExpiredUserActivity();

    // If still over max size after TTL cleanup, remove oldest entries
    if (userActivity.size > MAX_USER_ACTIVITY_SIZE) {
      const entries = [...userActivity.entries()].sort(
        (a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt
      );
      const toRemove = userActivity.size - MAX_USER_ACTIVITY_SIZE;
      for (let i = 0; i < toRemove; i++) {
        userActivity.delete(entries[i][0]);
      }
    }
  }
}

/**
 * 사용자 활동 업데이트 및 경고 필요 여부 판단
 * 50개 메시지마다 경고하되, 마지막 경고 후 최소 50개 간격 유지
 */
export function shouldShowSessionWarning(userId: string): boolean {
  maybeCleanup();

  const activity = userActivity.get(userId) || {
    messageCount: 0,
    lastWarningCount: -50, // 첫 경고를 50개 시점에 표시하기 위함
    lastAccessedAt: Date.now(),
  };

  activity.messageCount++;
  activity.lastAccessedAt = Date.now();
  userActivity.set(userId, activity);

  // 50개 단위마다 체크 (50, 100, 150...)
  const isCheckpoint = activity.messageCount % 50 === 0;
  // 마지막 경고 이후 최소 50개 메시지 경과
  const enoughGap = activity.messageCount - activity.lastWarningCount >= 50;

  if (isCheckpoint && enoughGap) {
    activity.lastWarningCount = activity.messageCount;
    userActivity.set(userId, activity);
    return true;
  }

  return false;
}

/**
 * 메시지 텍스트에서 카카오 카드 JSON 감지
 * JSON 형태이고 카드 키가 있으면 파싱하여 반환
 */
export function tryParseKakaoCard(text: string): KakaoChannelData | null {
  const trimmed = text.trim();

  // JSON 형태가 아니면 스킵
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    // 카카오 카드 키 목록 (object 값을 가져야 하는 키)
    const objectCardKeys = [
      'textCard', 'basicCard', 'listCard',
      'commerceCard', 'itemCard', 'carousel',
      'simpleText', 'simpleImage',
    ];

    // 배열 값을 가져야 하는 키
    const arrayCardKeys = ['quickReplies', 'outputs'];

    let hasValidCard = false;

    for (const key of objectCardKeys) {
      if (key in parsed) {
        if (typeof parsed[key] !== "object" || parsed[key] === null || Array.isArray(parsed[key])) {
          // Invalid structure: card key must have an object value
          return null;
        }
        hasValidCard = true;
      }
    }

    for (const key of arrayCardKeys) {
      if (key in parsed) {
        if (!Array.isArray(parsed[key])) {
          // Invalid structure: quickReplies/outputs must be arrays
          return null;
        }
        hasValidCard = true;
      }
    }

    if (hasValidCard) {
      return parsed as KakaoChannelData;
    }
  } catch {
    // JSON 파싱 실패 = 일반 텍스트
  }

  return null;
}

function buildOutputsFromChannelData(kakaoData: KakaoChannelData): KakaoOutput[] {
  if (kakaoData.outputs && kakaoData.outputs.length > 0) {
    return kakaoData.outputs;
  }

  const outputs: KakaoOutput[] = [];

  if (kakaoData.simpleText) {
    outputs.push({ simpleText: kakaoData.simpleText });
  }
  if (kakaoData.simpleImage) {
    outputs.push({ simpleImage: kakaoData.simpleImage });
  }
  if (kakaoData.textCard) {
    outputs.push({ textCard: kakaoData.textCard });
  }
  if (kakaoData.basicCard) {
    outputs.push({ basicCard: kakaoData.basicCard });
  }
  if (kakaoData.commerceCard) {
    outputs.push({ commerceCard: kakaoData.commerceCard });
  }
  if (kakaoData.listCard) {
    outputs.push({ listCard: kakaoData.listCard });
  }
  if (kakaoData.itemCard) {
    outputs.push({ itemCard: kakaoData.itemCard });
  }
  if (kakaoData.carousel) {
    outputs.push({ carousel: kakaoData.carousel });
  }

  return outputs;
}

export interface GatewayContext {
  account: ResolvedKakaoTalkChannel;
  accountId: string;
  cfg: unknown;
  abortSignal: AbortSignal;
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  getStatus?: () => ChannelAccountSnapshot;
  setStatus?: (next: ChannelAccountSnapshot) => void;
}

export interface StopAccountContext {
  accountId: string;
}

export interface StartAccountResult {
  pairingCode?: string;
  expiresIn?: number;
}

// Store for pairing info to be retrieved later (keyed by accountId)
const pendingPairingInfoMap = new Map<string, { pairingCode: string; expiresIn: number }>();

// Store for active session tokens (keyed by accountId)
const activeSessionTokenMap = new Map<string, { sessionToken: string; relayUrl: string }>();

function invalidateSessionToken(
  accountId: string,
  reason: string,
  log?: GatewayContext["log"]
): void {
  const deleted = activeSessionTokenMap.delete(accountId);
  if (deleted) {
    log?.warn(`[openclaw-kakao] Session token invalidated for ${accountId}: ${reason}`);
  }
}

export function getPendingPairingInfo(accountId?: string): { pairingCode: string; expiresIn: number } | null {
  if (accountId) {
    const info = pendingPairingInfoMap.get(accountId) ?? null;
    pendingPairingInfoMap.delete(accountId);
    return info;
  }
  // Fallback: return first entry (backwards compat for single-account)
  const first = pendingPairingInfoMap.entries().next();
  if (first.done) return null;
  pendingPairingInfoMap.delete(first.value[0]);
  return first.value[1];
}

/**
 * Build OpenClaw message context from InboundMessage
 */
function buildMessageContext(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  accountId: string
): Record<string, unknown> {
  const { normalized } = msg;
  const sessionKey = `agent:main:openclaw-kakao:dm:${normalized.userId}`;

  return {
    // Message content
    Body: normalized.text,
    RawBody: normalized.text,
    BodyForAgent: normalized.text,
    BodyForCommands: normalized.text,

    // Identifiers
    From: `kakao:${normalized.userId}`,
    To: `kakao:${normalized.channelId}`,
    Provider: "openclaw-kakao",
    Surface: "openclaw-kakao",
    MessageSid: msg.id,
    MessageSidFull: msg.id,

    // Routing
    SessionKey: sessionKey,
    AccountId: accountId,

    // Chat context (always DM for now)
    ChatType: "direct",
    Timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),

    // Sender details
    SenderId: normalized.userId,

    // Control (authorize commands for paired users)
    CommandAuthorized: true,
  };
}

/**
 * Handle inbound message by dispatching to OpenClaw agent system
 */
async function handleInboundMessage(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  accountId: string,
  cfg: unknown,
  log?: GatewayContext["log"]
): Promise<void> {
  const runtime = getKakaoRuntime();
  const channel = runtime.channel;

  log?.info(`[openclaw-kakao:${account.talkchannelId}] Received message: ${msg.id}`);

  // Get relay config for command handlers
  // Priority: activeSessionTokenMap > account.config.sessionToken > account.config.relayToken
  const activeSession = activeSessionTokenMap.get(accountId);
  const relayUrl = activeSession?.relayUrl ?? account.config.relayUrl;
  const relayToken = activeSession?.sessionToken ?? account.config.sessionToken ?? account.config.relayToken ?? "";

  // 플러그인 커맨드 체크
  const messageText = msg.normalized.text?.trim() ?? "";
  if (messageText.startsWith('/')) {
    const command = messageText.split(' ')[0].toLowerCase();
    const handler = PLUGIN_COMMANDS[command];

    if (handler) {
      log?.info(`[openclaw-kakao:${account.talkchannelId}] Plugin command: ${command}`);
      try {
        await handler(msg, account, accountId, relayUrl, relayToken, log);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log?.error(`[openclaw-kakao:${account.talkchannelId}] Command ${command} error: ${errMsg}`);

        // Send error feedback to user
        try {
          await sendReply(
            { relayUrl, relayToken },
            msg.id,
            {
              version: "2.0",
              template: {
                outputs: [{ simpleText: { text: `명령어 처리 중 오류가 발생했습니다: ${errMsg}` } }],
              },
            }
          );
        } catch (replyErr) {
          const replyErrMsg = replyErr instanceof Error ? replyErr.message : String(replyErr);
          log?.error(`[openclaw-kakao:${account.talkchannelId}] Failed to send error feedback: ${replyErrMsg}`);
        }
      }
      return; // 커맨드 처리 완료, OpenClaw로 디스패치 안 함
    }
  }

  // 세션 관리 경고 체크
  const userId = msg.normalized.userId;
  const shouldWarn = shouldShowSessionWarning(userId);
  if (shouldWarn) {
    log?.info(`[openclaw-kakao:${account.talkchannelId}] Session warning triggered for ${userId}`);
  }

  // Build and finalize message context
  const rawCtx = buildMessageContext(msg, account, accountId);
  const ctxPayload = channel.reply.finalizeInboundContext(rawCtx);

  // Dispatch to OpenClaw agent system
  // NOTE: Kakao replies are sent via relay `sendReply` in `deliver`, not core
  // `infra/outbound/deliver.ts`, so write-ahead queue/hook behavior differs.
  await channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg,
    dispatcherOptions: {
      deliver: async (payload: unknown) => {
        const outboundPayload = payload as DeliverPayload;
        const template: KakaoSkillResponse["template"] = { outputs: [] };
        const kakaoData = outboundPayload.channelData?.kakao;

        if (kakaoData) {
          const channelOutputs = buildOutputsFromChannelData(kakaoData);
          template.outputs.push(...channelOutputs);

          if (kakaoData.quickReplies && kakaoData.quickReplies.length > 0) {
            template.quickReplies = kakaoData.quickReplies.slice(0, 10);
          }
        }

        if (template.outputs.length === 0) {
          if (outboundPayload.mediaUrls && outboundPayload.mediaUrls.length > 0) {
            for (const url of outboundPayload.mediaUrls.slice(0, 3)) {
              template.outputs.push({ simpleImage: { imageUrl: url } });
            }
          }

          if (outboundPayload.text) {
            // 1️⃣ JSON 카드 감지 시도
            const cardData = tryParseKakaoCard(outboundPayload.text);
            if (cardData) {
              // 카드로 변환
              const cardOutputs = buildOutputsFromChannelData(cardData);
              template.outputs.push(...cardOutputs);

              // quickReplies도 처리
              if (cardData.quickReplies && cardData.quickReplies.length > 0) {
                template.quickReplies = cardData.quickReplies.slice(0, 10);
              }
            } else {
              // 2️⃣ 일반 텍스트
              const plainText = stripMarkdown(outboundPayload.text);
              template.outputs.push({ simpleText: { text: plainText } });
            }
          }
        }

        if (template.outputs.length === 0) return;

        template.outputs = template.outputs.slice(0, 3);

        // 세션 관리 안내를 quickReplies로 추가
        if (shouldWarn) {
          const activity = userActivity.get(msg.normalized.userId);
          const messageCount = activity?.messageCount || 0;

          if (!template.quickReplies) {
            template.quickReplies = [];
          }

          // 경고 버튼을 맨 앞에 추가
          template.quickReplies.unshift(
            {
              label: `💡 /compact (${messageCount}개)`,
              action: "message",
              messageText: "/compact"
            },
            {
              label: "도움말",
              action: "message",
              messageText: "세션 관리가 뭐야?"
            }
          );

          // 최대 10개 제한
          template.quickReplies = template.quickReplies.slice(0, 10);
        }

        const response: KakaoSkillResponse = {
          version: "2.0",
          template,
        };

        try {
          await sendReply(
            { relayUrl, relayToken },
            msg.id,
            response
          );
          log?.info(`[openclaw-kakao:${account.talkchannelId}] Reply sent for ${msg.id}`);
        } catch (err) {
          if (err instanceof RelayHttpError && err.isAuthError) {
            invalidateSessionToken(accountId, `sendReply HTTP ${err.status}`, log);
          }
          const errMsg = err instanceof Error ? err.message : String(err);
          log?.error(`[openclaw-kakao:${account.talkchannelId}] Reply failed: ${errMsg}`);
        }
      },
      onReplyStart: async () => {
        // Could send typing indicator if supported
      },
      onIdle: async () => {
        // Stop typing indicator
      },
      onError: (err: Error, info: { kind: string }) => {
        log?.error(`[openclaw-kakao:${account.talkchannelId}] Dispatch ${info.kind} error: ${err.message}`);
      },
    },
  });
}

export const gatewayAdapter = {
  startAccount: async (ctx: GatewayContext): Promise<void> => {
    const { account, accountId, cfg, abortSignal, log } = ctx;

    log?.info(
      `[openclaw-kakao:${account.talkchannelId}] Starting SSE stream to ${account.config.relayUrl}`
    );

    const callbacks: StreamCallbacks = {
      onConnected: () => {
        if (ctx.getStatus && ctx.setStatus) {
          ctx.setStatus({ ...ctx.getStatus(), connected: true });
        }
      },
      onDisconnected: () => {
        if (ctx.getStatus && ctx.setStatus) {
          ctx.setStatus({ ...ctx.getStatus(), connected: false });
        }
      },
      onTokenResolved: (sessionToken, relayUrl) => {
        // Store active session token keyed by accountId
        activeSessionTokenMap.set(accountId, { sessionToken, relayUrl });
        log?.info(`[openclaw-kakao:${account.talkchannelId}] Session token stored for account`);
      },
      onPairingRequired: (pairingCode, expiresIn) => {
        // Store pairing info keyed by accountId
        pendingPairingInfoMap.set(accountId, { pairingCode, expiresIn });

        // Log the pairing code prominently
        log?.info(`[openclaw-kakao:${account.talkchannelId}] ========================================`);
        log?.info(`[openclaw-kakao:${account.talkchannelId}] 🔗 페어링 코드: ${pairingCode}`);
        log?.info(`[openclaw-kakao:${account.talkchannelId}] 카카오톡에서 /pair ${pairingCode} 입력하세요`);
        log?.info(`[openclaw-kakao:${account.talkchannelId}] 유효시간: ${Math.floor(expiresIn / 60)}분`);
        log?.info(`[openclaw-kakao:${account.talkchannelId}] ========================================`);
      },
      onPairingComplete: (kakaoUserId) => {
        log?.info(`[openclaw-kakao:${account.talkchannelId}] ✅ 페어링 완료: ${kakaoUserId}`);
      },
      onPairingExpired: (reason) => {
        log?.info(`[openclaw-kakao:${account.talkchannelId}] ⚠️ 페어링 만료: ${reason}`);
      },
      onSessionInvalidated: (status) => {
        invalidateSessionToken(accountId, `SSE HTTP ${status}`, log);
      },
    };

    // Message handler that dispatches to OpenClaw
    const onMessage = async (msg: InboundMessage): Promise<void> => {
      await handleInboundMessage(msg, account, accountId, cfg, log);
    };

    return startRelayStream(account, onMessage, abortSignal, {}, callbacks, log);
  },

  stopAccount: async (ctx: StopAccountContext): Promise<void> => {
    // Clean up active session token
    activeSessionTokenMap.delete(ctx.accountId);
    return Promise.resolve();
  },

  getPendingPairingInfo,
};
