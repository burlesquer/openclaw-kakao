import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InboundMessage, ResolvedKakaoTalkChannel } from "../../../src/types";
import { handleAboutCommand } from "../../../src/commands/about";

vi.mock("../../../src/relay/client.js", () => ({
  sendReply: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../../src/version.js", () => ({
  PLUGIN_VERSION: "0.5.0-test",
}));

const { sendReply } = await import("../../../src/relay/client.js");
const mockSendReply = vi.mocked(sendReply);

function createMockMsg(overrides?: Partial<InboundMessage>): InboundMessage {
  return {
    id: "msg-about-1",
    conversationKey: "conv-1",
    normalized: { userId: "user1", text: "/about", channelId: "ch1" },
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

describe("handleAboutCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send a listCard response", async () => {
    await handleAboutCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    expect(mockSendReply).toHaveBeenCalledOnce();
    const response = mockSendReply.mock.calls[0][2];
    expect(response.version).toBe("2.0");
    const output = response.template.outputs[0];
    expect(output).toHaveProperty("listCard");
  });

  it("should include version information", async () => {
    await handleAboutCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const listCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).listCard;
    const versionItem = listCard.items.find((item: any) => item.title === "버전");
    expect(versionItem).toBeDefined();
    expect(versionItem.description).toContain("0.5.0-test");
  });

  it("should include package name", async () => {
    await handleAboutCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const listCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).listCard;
    const pkgItem = listCard.items.find((item: any) => item.title === "패키지");
    expect(pkgItem).toBeDefined();
    expect(pkgItem.description).toBe("openclaw-kakao");
  });

  it("should include help button only", async () => {
    await handleAboutCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const listCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).listCard;
    expect(listCard.buttons).toHaveLength(1);
    expect(listCard.buttons[0].messageText).toBe("/help");
  });

  it("should log info on success", async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    await handleAboutCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok", log);

    expect(log.info).toHaveBeenCalledWith(expect.stringContaining("About card sent"));
  });

  it("should log error when sendReply fails", async () => {
    mockSendReply.mockRejectedValueOnce(new Error("timeout"));
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await handleAboutCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok", log);

    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("About command failed"));
  });

  it("should not throw when log is undefined", async () => {
    await expect(
      handleAboutCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok")
    ).resolves.toBeUndefined();
  });
});
