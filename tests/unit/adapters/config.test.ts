/**
 * ChannelConfigAdapter tests (Simplified)
 *
 * Single channel, relay mode only.
 * Uses OpenClaw standard accounts structure.
 */
import { describe, it, expect } from "vitest";
import { configAdapter } from "../../../src/adapters/config";

describe("ChannelConfigAdapter (Simplified)", () => {
  describe("listAccountIds", () => {
    it("should return account IDs from accounts object", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {
            accounts: {
              default: { enabled: true },
            },
          },
        },
      };

      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toEqual(["default"]);
    });

    it("should return multiple account IDs when configured", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {
            accounts: {
              default: { enabled: true },
              secondary: { enabled: true },
            },
          },
        },
      };

      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toContain("default");
      expect(ids).toContain("secondary");
    });

    it("should return ['default'] when accounts not configured", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {},
        },
      };

      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toEqual(["default"]);
    });

    it("should return ['default'] when kakao channel not configured", () => {
      const cfg = {
        channels: {},
      };

      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toEqual(["default"]);
    });

    it("should return ['default'] when channels missing", () => {
      const cfg = {};

      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toEqual(["default"]);
    });

    it("should return ['default'] when config is null or undefined", () => {
      expect(configAdapter.listAccountIds(null)).toEqual(["default"]);
      expect(configAdapter.listAccountIds(undefined)).toEqual(["default"]);
    });
  });

  describe("resolveAccount", () => {
    it("should resolve account with valid config", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {
            accounts: {
              default: {
                enabled: true,
                channelId: "channel123",
                relayUrl: "https://relay.example.com",
                dmPolicy: "pairing",
              },
            },
          },
        },
      };

      const account = configAdapter.resolveAccount(cfg, "default");

      expect(account.talkchannelId).toBe("default");
      expect(account.config.channelId).toBe("channel123");
      expect(account.config.enabled).toBe(true);
      expect(account.enabled).toBe(true);
    });

    it("should apply schema defaults when resolving with relayUrl", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {
            accounts: {
              default: {
                relayUrl: "https://relay.example.com",
              },
            },
          },
        },
      };

      const account = configAdapter.resolveAccount(cfg, "default");

      expect(account.config.enabled).toBe(true);
      expect(account.config.dmPolicy).toBe("pairing");
      expect(account.config.relayUrl).toBe("https://relay.example.com");
      expect(account.config.reconnectDelayMs).toBe(1000);
      expect(account.config.maxReconnectDelayMs).toBe(30000);
    });

    it("should throw when accounts not configured (relayUrl required)", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {},
        },
      };

      expect(() => configAdapter.resolveAccount(cfg, "default")).toThrow();
    });

    it("should throw when kakao channel not configured (relayUrl required)", () => {
      const cfg = {
        channels: {},
      };

      expect(() => configAdapter.resolveAccount(cfg, "default")).toThrow();
    });

    it("should throw when channels missing (relayUrl required)", () => {
      const cfg = {};

      expect(() => configAdapter.resolveAccount(cfg, "default")).toThrow();
    });

    it("should throw when config is null or undefined (relayUrl required)", () => {
      expect(() => configAdapter.resolveAccount(null, "default")).toThrow();
      expect(() => configAdapter.resolveAccount(undefined, "default")).toThrow();
    });

    it("should resolve relay mode settings", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {
            accounts: {
              default: {
                enabled: true,
                channelId: "relay_ch",
                relayUrl: "https://relay.example.com",
                relayToken: "secret_token",
                reconnectDelayMs: 2000,
                maxReconnectDelayMs: 15000,
                dmPolicy: "open",
              },
            },
          },
        },
      };

      const account = configAdapter.resolveAccount(cfg, "default");

      expect(account.talkchannelId).toBe("default");
      expect(account.config.relayUrl).toBe("https://relay.example.com");
      expect(account.config.relayToken).toBe("secret_token");
      expect(account.config.reconnectDelayMs).toBe(2000);
      expect(account.config.maxReconnectDelayMs).toBe(15000);
    });

    it("should set enabled field based on config.enabled", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {
            accounts: {
              default: {
                relayUrl: "https://relay.example.com",
                enabled: false,
              },
            },
          },
        },
      };

      const account = configAdapter.resolveAccount(cfg, "default");

      expect(account.enabled).toBe(false);
      expect(account.config.enabled).toBe(false);
    });

    it("should include optional name field when present", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {
            accounts: {
              default: {
                relayUrl: "https://relay.example.com",
                enabled: true,
                name: "My Kakao Bot",
              },
            },
          },
        },
      };

      const account = configAdapter.resolveAccount(cfg, "default");

      expect(account.name).toBe("My Kakao Bot");
    });

    it("should throw error on invalid config data", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {
            accounts: {
              default: {
                relayUrl: "https://relay.example.com",
                channelId: "", // empty channelId is invalid
              },
            },
          },
        },
      };

      expect(() => configAdapter.resolveAccount(cfg, "default")).toThrow();
    });
  });

  describe("defaultAccountId", () => {
    it("should always return 'default'", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {
            accounts: {
              default: { enabled: true },
            },
          },
        },
      };

      const id = configAdapter.defaultAccountId(cfg);
      expect(id).toBe("default");
    });

    it("should return 'default' even when kakao channel not configured", () => {
      const cfg = {
        channels: {},
      };

      const id = configAdapter.defaultAccountId(cfg);
      expect(id).toBe("default");
    });

    it("should return 'default' even when config is null or undefined", () => {
      expect(configAdapter.defaultAccountId(null)).toBe("default");
      expect(configAdapter.defaultAccountId(undefined)).toBe("default");
    });
  });

  describe("isConfigured", () => {
    it("should always return true for relay mode (can auto-create session)", () => {
      const account = {
        talkchannelId: "default",
        config: {
          enabled: true,
          relayUrl: "https://relay.example.com",
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(account)).toBe(true);
    });

    it("should return true when sessionToken is set", () => {
      const account = {
        talkchannelId: "default",
        config: {
          enabled: true,
          relayUrl: "https://relay.example.com",
          dmPolicy: "pairing" as const,
          sessionToken: "session123",
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(account)).toBe(true);
    });

    it("should return true when relayToken is set", () => {
      const account = {
        talkchannelId: "default",
        config: {
          enabled: true,
          relayUrl: "https://relay.example.com",
          dmPolicy: "pairing" as const,
          relayToken: "token123",
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(account)).toBe(true);
    });
  });

  describe("isEnabled", () => {
    it("should return true when account is enabled", () => {
      const account = {
        talkchannelId: "default",
        config: {
          enabled: true,
          relayUrl: "https://relay.example.com",
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isEnabled(account)).toBe(true);
    });

    it("should return false when account is disabled", () => {
      const account = {
        talkchannelId: "default",
        config: {
          enabled: false,
          relayUrl: "https://relay.example.com",
          dmPolicy: "pairing" as const,
        },
        enabled: false,
      };

      expect(configAdapter.isEnabled(account)).toBe(false);
    });
  });

  describe("Integration: Full workflow", () => {
    it("should list, resolve, and check status of single channel", () => {
      const cfg = {
        channels: {
          "openclaw-kakao": {
            accounts: {
              default: {
                relayUrl: "https://relay.example.com",
                enabled: true,
                channelId: "channel123",
                dmPolicy: "pairing",
              },
            },
          },
        },
      };

      // List accounts
      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toEqual(["default"]);

      // Resolve channel
      const account = configAdapter.resolveAccount(cfg, "default");
      expect(configAdapter.isConfigured(account)).toBe(true);
      expect(configAdapter.isEnabled(account)).toBe(true);

      // Get default account ID
      const defaultId = configAdapter.defaultAccountId(cfg);
      expect(defaultId).toBe("default");
    });

    it("should throw on zero config (relayUrl required)", () => {
      const cfg = {};

      // Should return default account ID
      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toEqual(["default"]);

      // Should throw when resolving without relayUrl
      expect(() => configAdapter.resolveAccount(cfg, "default")).toThrow();
    });
  });
});
