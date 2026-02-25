/**
 * Kakao Plugin Entry Point (Simplified)
 *
 * Single channel, relay mode only.
 */

import type { PluginRuntime } from "openclaw/plugin-sdk";
import { kakaoPlugin, getPendingPairingInfo } from "./src/channel.js";
import { setKakaoRuntime } from "./src/runtime.js";
import { KakaoChannelConfigSchema } from "./src/config/schema.js";

interface OpenClawPluginApi {
  runtime: PluginRuntime;
  config: unknown;
  registerChannel: (opts: { plugin: unknown }) => void;
}

const plugin = {
  id: "openclaw-kakao",
  name: "OpenClaw Kakao",
  description: "OpenClaw Kakao plugin for KakaoTalk channel integration",
  configSchema: {
    "channels.openclaw-kakao": {
      schema: KakaoChannelConfigSchema,
      optional: true,  // 플러그인 로드 시 설정 없어도 에러 없이 로드
    },
  },

  register(api: OpenClawPluginApi): void {
    setKakaoRuntime(api.runtime);
    api.registerChannel({ plugin: kakaoPlugin });
  },
};

export default plugin;
export { getPendingPairingInfo };
