/**
 * /about - 플러그인 정보
 */

import type {
  InboundMessage,
  ResolvedKakaoTalkChannel,
  KakaoSkillResponse,
} from "../types.js";
import { sendReply } from "../relay/client.js";
import { PLUGIN_VERSION } from "../version.js";
import type { CommandLog } from "./types.js";

export async function handleAboutCommand(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  _accountId: string,
  relayUrl: string,
  relayToken: string,
  log?: CommandLog,
): Promise<void> {
  const response: KakaoSkillResponse = {
    version: "2.0",
    template: {
      outputs: [
        {
          listCard: {
            header: {
              title: "ℹ️ 플러그인 정보"
            },
            items: [
              {
                title: "버전",
                description: `v${PLUGIN_VERSION}`
              },
              {
                title: "패키지",
                description: "openclaw-kakao"
              },
              {
                title: "설명",
                description: "카카오톡 채널 ↔ OpenClaw 연결"
              }
            ],
            buttons: [
              {
                label: "도움말",
                action: "message",
                messageText: "/help"
              }
            ]
          }
        }
      ]
    }
  };

  try {
    await sendReply({ relayUrl, relayToken }, msg.id, response);
    log?.info(`[openclaw-kakao:${account.talkchannelId}] About card sent`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error(`[openclaw-kakao:${account.talkchannelId}] About command failed: ${errMsg}`);
  }
}
