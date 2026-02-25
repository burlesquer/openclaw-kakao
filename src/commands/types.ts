/**
 * Shared types for plugin command handlers.
 * Separated from registry.ts to avoid circular imports.
 */

import type {
  InboundMessage,
  ResolvedKakaoTalkChannel,
} from "../types.js";

export type CommandLog = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export type CommandHandler = (
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  accountId: string,
  relayUrl: string,
  relayToken: string,
  log?: CommandLog,
) => Promise<void>;
