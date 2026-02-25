import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InboundMessage, ResolvedKakaoTalkChannel } from "../../../src/types";
import { handleRelayCommand } from "../../../src/commands/relay";

vi.mock("../../../src/relay/client.js", () => ({
  sendReply: vi.fn().mockResolvedValue({ success: true }),
}));

const { sendReply } = await import("../../../src/relay/client.js");
const mockSendReply = vi.mocked(sendReply);

function createMockMsg(overrides?: Partial<InboundMessage>): InboundMessage {
  return {
    id: "msg-relay-1",
    conversationKey: "conv-1",
    normalized: { userId: "user1", text: "/relay", channelId: "ch1" },
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

describe("handleRelayCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should send a textCard with relay status on successful health check", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    expect(mockSendReply).toHaveBeenCalledOnce();
    const response = mockSendReply.mock.calls[0][2];
    expect(response.version).toBe("2.0");
    const output = response.template.outputs[0];
    expect(output).toHaveProperty("textCard");

    const textCard = (output as any).textCard;
    expect(textCard.description).toContain("정상");
  });

  it("should show failure status when health check returns non-200", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(new Response("", { status: 503 }));

    await handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("HTTP 503");
  });

  it("should show connection error when fetch throws", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    await handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok", log);

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("연결 실패");
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("health check failed"));
  });

  it("should include relay URL in description", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("https://relay.test/");
  });

  it("should include latency on success", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toMatch(/\d+ms/);
  });

  it("should include recheck and session buttons", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");

    const textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.buttons).toHaveLength(2);
    expect(textCard.buttons[0].messageText).toBe("/relay");
    expect(textCard.buttons[1].messageText).toBe("/session");
  });

  it("should send Authorization header with token", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "my-token");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://relay.test/health",
      expect.objectContaining({
        headers: { "Authorization": "Bearer my-token" },
      })
    );
  });

  it("should show session status based on token presence", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);

    // With token
    mockFetch.mockResolvedValueOnce(new Response("OK", { status: 200 }));
    await handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok");
    let textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("페어링 완료");

    vi.clearAllMocks();

    // Without token
    mockFetch.mockResolvedValueOnce(new Response("OK", { status: 200 }));
    await handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "");
    textCard = (mockSendReply.mock.calls[0][2].template.outputs[0] as any).textCard;
    expect(textCard.description).toContain("토큰 없음");
  });

  it("should log error when sendReply fails", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(new Response("OK", { status: 200 }));
    mockSendReply.mockRejectedValueOnce(new Error("reply fail"));

    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    await handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok", log);

    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("Relay command failed"));
  });

  it("should not throw when log is undefined", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await expect(
      handleRelayCommand(createMockMsg(), createMockAccount(), "acc1", "https://relay.test/", "tok")
    ).resolves.toBeUndefined();
  });
});
