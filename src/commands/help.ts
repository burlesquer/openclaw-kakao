/**
 * /help, /? - 사용 가이드 캐러셀 (4장 itemCard)
 */

import type {
  InboundMessage,
  ResolvedKakaoTalkChannel,
  KakaoSkillResponse,
} from "../types.js";
import { sendReply } from "../relay/client.js";
import type { CommandLog } from "./types.js";

export async function handleHelpCommand(
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
          carousel: {
            type: "itemCard",
            items: [
              {
                head: {
                  title: "기본 사용법"
                },
                itemList: [
                  { title: "/help, /?", description: "도움말 보기" },
                  { title: "/session, /s", description: "세션 정보 확인" },
                  { title: "/relay", description: "서버 상태 확인" },
                  { title: "/about", description: "플러그인 정보" }
                ]
              },
              {
                head: {
                  title: "세션 관리"
                },
                itemList: [
                  { title: "/compact", description: "히스토리 압축" },
                  { title: "/reset", description: "세션 초기화" },
                  { title: "/session, /s", description: "세션 정보 확인" }
                ],
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
              },
              {
                head: {
                  title: "릴레이 서버"
                },
                itemList: [
                  { title: "/pair", description: "페어링 코드로 연결" },
                  { title: "/unpair", description: "연결 해제" },
                  { title: "/status", description: "연결 상태 확인" },
                  { title: "/code", description: "접속 코드 생성" }
                ]
              }
            ]
          }
        }
      ],
      quickReplies: [
        {
          label: "session",
          action: "message",
          messageText: "/session"
        },
        {
          label: "reset",
          action: "message",
          messageText: "/reset"
        },
        {
          label: "about",
          action: "message",
          messageText: "/about"
        }
      ]
    }
  };

  try {
    await sendReply({ relayUrl, relayToken }, msg.id, response);
    log?.info(`[openclaw-kakao:${account.talkchannelId}] Help carousel sent`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error(`[openclaw-kakao:${account.talkchannelId}] Help command failed: ${errMsg}`);
  }
}
