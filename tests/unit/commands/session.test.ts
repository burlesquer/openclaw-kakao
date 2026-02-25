import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InboundMessage, ResolvedKakaoTalkChannel } from "../../../src/types";

vi.mock("../../../src/relay/client.js", () => ({
  sendReply: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../../src/adapters/gateway.js", () => ({
  userActivity: new Map(),
}));

const { sendReply } = await import("../../../src/relay/client.js");
const { userActivity } = await import("../../../src/adapters/gateway.js");
const { handleSessionCommand } = await import("../../../src/commands/session");
const mockSendReply = vi.mocked(sendReply);

function createMockMsg(overrides?: Partial<InboundMessage>): InboundMessage {
  return {
    id: "msg-session-1",
    conversationKey: "conv-1",
    normalized: { userId: "user1", text: "/session", channelId: "ch1" },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockAccount(): ResolvedKakaoTalkChannel {
  return {
    talkchannelId: "default",
    enabled: true,
    config: {
      enabled: true,
      channelId: "ch1",
      dmPolicy: "pairing",
      relayUrl: "https://relay.test/",
    },
  } as ResolvedKakaoTalkChannel;
}

describe("handleSessionCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userActivity.clear();
  });

  it("should send a textCard response", async () => {
    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    expect(mockSendReply).toHaveBeenCalledOnce();
    const response = mockSendReply.mock.calls[0][2];
    expect(response.version).toBe("2.0");
    const output = response.template.outputs[0];
    expect(output).toHaveProperty("textCard");
  });

  it("should show 0 messages for new user", async () => {
    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("메시지: 0개");
  });

  it("should show message count from userActivity", async () => {
    userActivity.set("user1", {
      messageCount: 42,
      lastWarningCount: 0,
      lastAccessedAt: Date.now(),
    });

    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("메시지: 42개");
  });

  it("should show last warning count when present", async () => {
    userActivity.set("user1", {
      messageCount: 75,
      lastWarningCount: 50,
      lastAccessedAt: Date.now(),
    });

    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("50개 시점");
  });

  it("should show no warning for zero lastWarningCount", async () => {
    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("없음");
  });

  it("should show token status", async () => {
    // With token
    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");
    let textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("연결됨");

    vi.clearAllMocks();

    // Without token
    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "");
    textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("없음");
  });

  it("should include compact and reset buttons", async () => {
    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.buttons).toHaveLength(2);
    expect(textCard.buttons[0].messageText).toBe("/compact");
    expect(textCard.buttons[1].messageText).toBe("/reset");
  });

  it("should have horizontal button layout", async () => {
    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.buttonLayout).toBe("horizontal");
  });

  it("should include userId in description", async () => {
    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("user1");
  });

  it("should log info on success", async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok", log);

    expect(log.info).toHaveBeenCalledWith(expect.stringContaining("Session info sent"));
  });

  it("should log error when sendReply fails", async () => {
    mockSendReply.mockRejectedValueOnce(new Error("connection lost"));
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok", log);

    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("Session command failed"));
  });

  it("should not throw when log is undefined", async () => {
    await expect(
      handleSessionCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok")
    ).resolves.toBeUndefined();
  });
});
