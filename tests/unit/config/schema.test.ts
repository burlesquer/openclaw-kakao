import { describe, it, expect } from "vitest";
import {
  KakaoAccountConfigSchema,
  KakaoChannelConfigSchema,
  validateAccountConfig,
  validateChannelConfig,
} from "../../../src/config/schema";

describe("Config Schema (Simplified)", () => {
  describe("KakaoAccountConfigSchema", () => {
    it("should accept minimal relay mode config with relayUrl", () => {
      const config = {
        relayUrl: "https://relay.example.com",
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.dmPolicy).toBe("pairing");
        expect(result.data.relayUrl).toBe("https://relay.example.com");
      }
    });

    it("should reject config without relayUrl", () => {
      const config = {
        enabled: true,
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should accept full relay mode config", () => {
      const config = {
        enabled: true,
        channelId: "channel123",
        dmPolicy: "pairing",
        relayUrl: "https://relay.example.com",
        relayToken: "secret_token",
        reconnectDelayMs: 2000,
        maxReconnectDelayMs: 15000,
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relayUrl).toBe("https://relay.example.com");
        expect(result.data.relayToken).toBe("secret_token");
        expect(result.data.reconnectDelayMs).toBe(2000);
        expect(result.data.maxReconnectDelayMs).toBe(15000);
      }
    });

    it("should apply default values when relayUrl provided", () => {
      const config = { relayUrl: "https://relay.example.com" };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.dmPolicy).toBe("pairing");
        expect(result.data.relayUrl).toBe("https://relay.example.com");
        expect(result.data.reconnectDelayMs).toBe(1000);
        expect(result.data.maxReconnectDelayMs).toBe(30000);
      }
    });

    it("should allow channelId to be optional", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        enabled: true,
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channelId).toBeUndefined();
      }
    });

    it("should reject empty channelId", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        channelId: "",
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject invalid dmPolicy", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        dmPolicy: "invalid",
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject reconnectDelayMs below minimum", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        reconnectDelayMs: 100,
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject reconnectDelayMs above maximum", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        reconnectDelayMs: 60000,
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject maxReconnectDelayMs below minimum", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        maxReconnectDelayMs: 1000,
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject maxReconnectDelayMs above maximum", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        maxReconnectDelayMs: 120000,
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject empty relayUrl", () => {
      const config = {
        relayUrl: "",
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should accept any non-empty string for relayUrl (no URL validation for AJV compatibility)", () => {
      const config = {
        relayUrl: "https://relay.example.com",
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relayUrl).toBe("https://relay.example.com");
      }
    });

    it("should accept valid allowFrom array", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        allowFrom: ["user1", "user2"],
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowFrom).toEqual(["user1", "user2"]);
      }
    });

    it("should apply default textChunkLimit of 400", () => {
      const config = { relayUrl: "https://relay.example.com" };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.textChunkLimit).toBe(400);
      }
    });

    it("should accept custom textChunkLimit within range", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        textChunkLimit: 1000,
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.textChunkLimit).toBe(1000);
      }
    });

    it("should reject textChunkLimit below minimum", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        textChunkLimit: 50,
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject textChunkLimit above maximum", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        textChunkLimit: 2000,
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should apply default chunkMode of sentence", () => {
      const config = { relayUrl: "https://relay.example.com" };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.chunkMode).toBe("sentence");
      }
    });

    it("should accept valid chunkMode values", () => {
      for (const mode of ["sentence", "newline", "length"]) {
        const result = KakaoAccountConfigSchema.safeParse({ relayUrl: "https://relay.example.com", chunkMode: mode });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.chunkMode).toBe(mode);
        }
      }
    });

    it("should reject invalid chunkMode", () => {
      const config = {
        relayUrl: "https://relay.example.com",
        chunkMode: "invalid",
      };

      const result = KakaoAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should accept responsePrefix as string", () => {
      const result = KakaoAccountConfigSchema.safeParse({ relayUrl: "https://relay.example.com", responsePrefix: "[카카오] " });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.responsePrefix).toBe("[카카오] ");
      }
    });

    it("should allow responsePrefix to be omitted", () => {
      const result = KakaoAccountConfigSchema.safeParse({ relayUrl: "https://relay.example.com" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.responsePrefix).toBeUndefined();
      }
    });

    it("should reject non-string responsePrefix", () => {
      const result = KakaoAccountConfigSchema.safeParse({ relayUrl: "https://relay.example.com", responsePrefix: 123 });
      expect(result.success).toBe(false);
    });
  });

  describe("KakaoChannelConfigSchema (wrapper)", () => {
    it("should accept empty config (accounts optional)", () => {
      const config = {};

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should accept config with accounts", () => {
      const config = {
        accounts: {
          default: {
            relayUrl: "https://relay.example.com",
            enabled: true,
            sessionToken: "test-token",
          },
        },
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accounts?.default?.enabled).toBe(true);
      }
    });
  });

  describe("validateAccountConfig", () => {
    it("should return ok: true for valid config", () => {
      const result = validateAccountConfig({ relayUrl: "https://relay.example.com" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.enabled).toBe(true);
      }
    });

    it("should return ok: false for empty config (relayUrl required)", () => {
      const result = validateAccountConfig({});
      expect(result.ok).toBe(false);
    });

    it("should return ok: true for config with channelId", () => {
      const result = validateAccountConfig({ relayUrl: "https://relay.example.com", channelId: "ch1" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.channelId).toBe("ch1");
      }
    });

    it("should return ok: false with errors for invalid config", () => {
      const result = validateAccountConfig({ relayUrl: "https://relay.example.com", reconnectDelayMs: 100 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("reconnectDelayMs");
      }
    });

    it("should format error paths correctly", () => {
      const result = validateAccountConfig({ relayUrl: "https://relay.example.com", reconnectDelayMs: 100 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some(e => e.includes("reconnectDelayMs"))).toBe(true);
      }
    });
  });

  describe("validateChannelConfig", () => {
    it("should return ok: true for empty config", () => {
      const result = validateChannelConfig({});
      expect(result.ok).toBe(true);
    });

    it("should return ok: true for config with accounts", () => {
      const result = validateChannelConfig({
        accounts: {
          default: { relayUrl: "https://relay.example.com", enabled: true },
        },
      });
      expect(result.ok).toBe(true);
    });
  });
});
