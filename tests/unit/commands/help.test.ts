import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InboundMessage, ResolvedKakaoTalkChannel } from "../../../src/types";
import { handleHelpCommand } from "../../../src/commands/help";

vi.mock("../../../src/relay/client.js", () => ({
  sendReply: vi.fn().mockResolvedValue({ success: true }),
}));

const { sendReply } = await import("../../../src/relay/client.js");
const mockSendReply = vi.mocked(sendReply);

function createMockMsg(overrides?: Partial<InboundMessage>): InboundMessage {
  return {
    id: "msg-help-1",
    conversationKey: "conv-1",
    normalized: { userId: "user1", text: "/help", channelId: "ch1" },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockAccount(overrides?: Partial<ResolvedKakaoTalkChannel>): ResolvedKakaoTalkChannel {
  return {
    talkchannelId: "default",
    enabled: true,
    config: {
      enabled: true,
      channelId: "ch1",
      dmPolicy: "pairing",
      relayUrl: "https://relay.test/",
    },
    ...overrides,
  } as ResolvedKakaoTalkChannel;
}

describe("handleHelpCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send a carousel response with version 2.0", async () => {
    const msg = createMockMsg();
    const account = createMockAccount();

    await handleHelpCommand(msg, account, "acc1", "https://relay.test/", "token-abc");

    expect(mockSendReply).toHaveBeenCalledOnce();
    const [config, msgId, response] = mockSendReply.mock.calls[0];
    expect(config).toEqual({ relayUrl: "https://relay.test/", relayToken: "token-abc" });
    expect(msgId).toBe("msg-help-1");
    expect(response.version).toBe("2.0");
  });

  it("should contain a carousel with itemCard type", async () => {
    await handleHelpCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const response = mockSendReply.mock.calls[0][2];
    const output = response.template.outputs[0];
    expect(output).toHaveProperty("carousel");
    expect((output as any).carousel.type).toBe("itemCard");
  });

  it("should have 3 itemCard slides", async () => {
    await handleHelpCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const carousel = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).carousel;
    expect(carousel.items).toHaveLength(3);
  });

  it("should include quickReplies", async () => {
    await handleHelpCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const template = mockSendReply.mock.calls[0][2].template;
    expect(template.quickReplies).toBeDefined();
    expect(template.quickReplies!.length).toBeGreaterThan(0);
  });

  it("should log info on success", async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    await handleHelpCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok", log);

    expect(log.info).toHaveBeenCalledWith(expect.stringContaining("Help carousel sent"));
  });

  it("should log error when sendReply fails", async () => {
    mockSendReply.mockRejectedValueOnce(new Error("network error"));
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await handleHelpCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok", log);

    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("Help command failed"));
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("network error"));
  });

  it("should not throw when log is undefined", async () => {
    await expect(
      handleHelpCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok")
    ).resolves.toBeUndefined();
  });

  it("should not throw when sendReply fails and log is undefined", async () => {
    mockSendReply.mockRejectedValueOnce(new Error("fail"));

    await expect(
      handleHelpCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok")
    ).resolves.toBeUndefined();
  });
});
