/**
 * /relay - 릴레이 서버 상태 확인
 */

import type {
  InboundMessage,
  ResolvedKakaoTalkChannel,
  KakaoSkillResponse,
} from "../types.js";
import { sendReply } from "../relay/client.js";
import type { CommandLog } from "./types.js";

export async function handleRelayCommand(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  _accountId: string,
  relayUrl: string,
  relayToken: string,
  log?: CommandLog,
): Promise<void> {
  const startTime = Date.now();
  let status = "❌ 연결 실패";
  let latency = "N/A";
  let sessionStatus = "알 수 없음";

  try {
    const healthUrl = `${relayUrl}health`;
    const healthResponse = await fetch(healthUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${relayToken}` }
    });

    if (healthResponse.ok) {
      const responseTime = Date.now() - startTime;
      status = "✅ 정상";
      latency = `${responseTime}ms`;
      sessionStatus = relayToken ? "페어링 완료" : "토큰 없음";
    } else {
      status = `⚠️ HTTP ${healthResponse.status}`;
    }
  } catch (err) {
    status = "❌ 연결 실패";
    log?.error(`[openclaw-kakao:${account.talkchannelId}] Relay health check failed: ${err}`);
  }

  const response: KakaoSkillResponse = {
    version: "2.0",
    template: {
      outputs: [
        {
          textCard: {
            title: "🌐 릴레이 서버 상태",
            description:
              `서버: ${relayUrl}\n` +
              `상태: ${status}\n` +
              `응답시간: ${latency}\n` +
              `세션: ${sessionStatus}`,
            buttons: [
              {
                label: "재확인",
                action: "message",
                messageText: "/relay"
              },
              {
                label: "세션 정보",
                action: "message",
                messageText: "/session"
              }
            ]
          }
        }
      ]
    }
  };

  try {
    await sendReply({ relayUrl, relayToken }, msg.id, response);
    log?.info(`[openclaw-kakao:${account.talkchannelId}] Relay status sent`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error(`[openclaw-kakao:${account.talkchannelId}] Relay command failed: ${errMsg}`);
  }
}
