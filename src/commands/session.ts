/**
 * /session, /s - 세션 정보
 */

import type {
  InboundMessage,
  ResolvedKakaoTalkChannel,
  KakaoSkillResponse,
} from "../types.js";
import { sendReply } from "../relay/client.js";
import { userActivity } from "../adapters/gateway.js";
import type { CommandLog } from "./types.js";

export async function handleSessionCommand(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  _accountId: string,
  relayUrl: string,
  relayToken: string,
  log?: CommandLog,
): Promise<void> {
  const userId = msg.normalized.userId;
  const activity = userActivity.get(userId);
  const messageCount = activity?.messageCount || 0;
  const lastWarningCount = activity?.lastWarningCount || 0;

  const sessionInfo =
    `메시지: ${messageCount}개\n` +
    `마지막 경고: ${lastWarningCount > 0 ? lastWarningCount + '개 시점' : '없음'}\n` +
    `페어링: ✅ ${userId}\n` +
    `토큰: ${relayToken ? '연결됨' : '없음'}`;

  const response: KakaoSkillResponse = {
    version: "2.0",
    template: {
      outputs: [
        {
          textCard: {
            title: "📊 현재 세션",
            description: sessionInfo,
            buttons: [
              {
                label: "compact",
                action: "message",
                messageText: "/compact"
              },
              {
                label: "reset",
                action: "message",
                messageText: "/reset"
              }
            ],
            buttonLayout: "horizontal"
          }
        }
      ]
    }
  };

  try {
    await sendReply({ relayUrl, relayToken }, msg.id, response);
    log?.info(`[openclaw-kakao:${account.talkchannelId}] Session info sent`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error(`[openclaw-kakao:${account.talkchannelId}] Session command failed: ${errMsg}`);
  }
}
