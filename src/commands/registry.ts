/**
 * Plugin Command Registry
 *
 * Centralizes command handler type and the command→handler mapping.
 * Gateway imports this map to dispatch inbound /commands.
 */

import type { CommandHandler } from "./types.js";
import { handleHelpCommand } from "./help.js";
import { handleAboutCommand } from "./about.js";
import { handleRelayCommand } from "./relay.js";
import { handleSessionCommand } from "./session.js";
import { handleCardCommand } from "./card.js";

export type { CommandHandler, CommandLog } from "./types.js";

export const PLUGIN_COMMANDS: Record<string, CommandHandler> = {
  "/help": handleHelpCommand,
  "/?": handleHelpCommand,
  "/about": handleAboutCommand,
  "/relay": handleRelayCommand,
  "/session": handleSessionCommand,
  "/s": handleSessionCommand,
  "/card": handleCardCommand,
};
