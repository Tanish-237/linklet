import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChatMessages, upsertMessage } from "../useChatMessages";
import { clearChatMessageCache } from "../chatMessageCache";

vi.mock("../../../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("useChatMessages Hook Tests", () => {
  let mockSocket;
  const sampleChat = {
    _id: "chat-101",
    participants: [{ _id: "user-1" }, { _id: "user-2" }],
  };
  const currentUser = { _id: "user-1", username: "tester" };

  beforeEach(() => {
    vi.clearAllMocks();
    clearChatMessageCache();
    mockSocket = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
  });

  it("adds incoming messages and sends one throttled, persisted read receipt (no HTTP PUT)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { apiClient } = await import("../../../../api/apiClient");
    apiClient.get.mockResolvedValue({
      data: { success: true, data: { messages: [], hasMore: false } },
    });
    mockSocket.connected = true;

    let socketHandlers = {};
    mockSocket.on.mockImplementation((event, handler) => {
      socketHandlers[event] = handler;
    });

    const { result } = renderHook(() =>
      useChatMessages({ chat: sampleChat, currentUser, socket: mockSocket })
    );
    await act(async () => {});

    expect(mockSocket.emit).toHaveBeenCalledWith("join chat", "chat-101");
    apiClient.put.mockClear();
    mockSocket.emit.mockClear();

    const incoming = (id) => ({
      _id: id,
      chat: "chat-101",
      sender: { _id: "user-2", username: "bob" },
      content: `msg ${id}`,
      readBy: ["user-2"],
      createdAt: new Date().toISOString(),
    });

    act(() => {
      socketHandlers["message received"](incoming("m1"));
      socketHandlers["message received"](incoming("m2"));
      socketHandlers["message received"](incoming("m3"));
    });
    expect(result.current.messages.map((m) => m._id)).toEqual(["m1", "m2", "m3"]);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // A burst of three messages -> one receipt, persisted server-side
    const receipts = mockSocket.emit.mock.calls.filter(([event]) => event === "read receipt");
    expect(receipts).toEqual([["read receipt", { chatId: "chat-101" }]]);
    expect(apiClient.put).not.toHaveBeenCalled();
    // ...and reflected locally, so these never count as unread later
    expect(result.current.messages.every((m) => m.readBy.includes("user-1"))).toBe(true);
    vi.useRealTimers();
  });

  it("defers read receipts while the tab is hidden and sends them when it becomes visible", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { apiClient } = await import("../../../../api/apiClient");
    apiClient.get.mockResolvedValue({ data: { success: true, data: { messages: [], hasMore: false } } });
    mockSocket.connected = true;
    const socketHandlers = {};
    mockSocket.on.mockImplementation((event, handler) => {
      socketHandlers[event] = handler;
    });

    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    renderHook(() => useChatMessages({ chat: sampleChat, currentUser, socket: mockSocket }));
    await act(async () => {});
    mockSocket.emit.mockClear();

    act(() => {
      socketHandlers["message received"]({
        _id: "bg", chat: "chat-101", sender: { _id: "user-2" }, content: "while away",
        readBy: ["user-2"], createdAt: new Date().toISOString(),
      });
      vi.advanceTimersByTime(1500);
    });
    expect(mockSocket.emit).not.toHaveBeenCalledWith("read receipt", expect.anything());

    visibility.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mockSocket.emit).toHaveBeenCalledWith("read receipt", { chatId: "chat-101" });
    visibility.mockRestore();
    vi.useRealTimers();
  });

  it("drops a typing indicator on its own if 'stop typing' never arrives", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { apiClient } = await import("../../../../api/apiClient");
    apiClient.get.mockResolvedValue({ data: { success: true, data: { messages: [], hasMore: false } } });
    const socketHandlers = {};
    mockSocket.on.mockImplementation((event, handler) => {
      socketHandlers[event] = handler;
    });

    const { result } = renderHook(() =>
      useChatMessages({ chat: sampleChat, currentUser, socket: mockSocket })
    );
    act(() => {
      socketHandlers["typing"]({ chatId: "chat-101", userId: "user-2", username: "bob" });
    });
    expect(result.current.typingUsers).toEqual(["bob"]);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.typingUsers).toEqual([]);
    vi.useRealTimers();
  });

  it("bulk delete removes exactly the ids the server deleted or hid", async () => {
    const { apiClient } = await import("../../../../api/apiClient");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          messages: [
            { _id: "a", chat: "chat-101", sender: "user-1", content: "mine" },
            { _id: "b", chat: "chat-101", sender: "user-2", content: "theirs" },
            { _id: "c", chat: "chat-101", sender: "user-2", content: "untouched" },
          ],
          hasMore: false,
        },
      },
    });
    apiClient.delete.mockResolvedValue({
      data: { success: true, data: { deletedIds: ["a"], hiddenIds: ["b"] } },
    });

    const { result } = renderHook(() =>
      useChatMessages({ chat: sampleChat, currentUser, socket: mockSocket })
    );
    await act(async () => {});
    await act(async () => {
      await result.current.bulkDeleteMessages(["a", "b"]);
    });

    expect(result.current.messages.map((m) => m._id)).toEqual(["c"]);
  });

  it("delete-for-me persists through the hide endpoint", async () => {
    const { apiClient } = await import("../../../../api/apiClient");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: { messages: [{ _id: "x", chat: "chat-101", sender: "user-2", content: "hi" }], hasMore: false },
      },
    });
    apiClient.post.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() =>
      useChatMessages({ chat: sampleChat, currentUser, socket: mockSocket })
    );
    await act(async () => {});
    await act(async () => {
      await result.current.hideMessageForMe("x");
    });

    expect(apiClient.post).toHaveBeenCalledWith("/chat/message/hide", { chatId: "chat-101", messageIds: ["x"] });
    expect(result.current.messages).toEqual([]);
  });

  it("handles message deleted event matching payload { chatId, messageId }", async () => {
    console.log("TRACE [useChatMessages.test.jsx]: Testing message deleted handler");
    const { apiClient } = await import("../../../../api/apiClient");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          messages: [
            { _id: "msg-1", chat: "chat-101", content: "Stay" },
            { _id: "msg-2", chat: "chat-101", content: "To be deleted" },
          ],
          hasMore: false,
        },
      },
    });

    let socketHandlers = {};
    mockSocket.on.mockImplementation((event, handler) => {
      socketHandlers[event] = handler;
    });

    const { result } = renderHook(() =>
      useChatMessages({
        chat: sampleChat,
        currentUser,
        socket: mockSocket,
      })
    );

    // Wait for initial fetch to populate messages
    await act(async () => {
      await Promise.resolve();
    });

    expect(socketHandlers["message deleted"]).toBeDefined();

    // Trigger message deleted
    act(() => {
      socketHandlers["message deleted"]({ chatId: "chat-101", messageId: "msg-2" });
    });

    // Message 2 should be removed from messages
    expect(result.current.messages.some((m) => m._id === "msg-2")).toBe(false);
    console.log("TRACE [useChatMessages.test.jsx]: Verified message was deleted from local state");
  });

  it("handles messages_bulk_deleted event matching payload { chatId, messageIds }", async () => {
    console.log("TRACE [useChatMessages.test.jsx]: Testing messages_bulk_deleted handler");
    const { apiClient } = await import("../../../../api/apiClient");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          messages: [
            { _id: "bulk-1", chat: "chat-101", content: "Stay" },
            { _id: "bulk-2", chat: "chat-101", content: "To be removed 1" },
            { _id: "bulk-3", chat: "chat-101", content: "To be removed 2" },
          ],
          hasMore: false,
        },
      },
    });

    let socketHandlers = {};
    mockSocket.on.mockImplementation((event, handler) => {
      socketHandlers[event] = handler;
    });

    const { result } = renderHook(() =>
      useChatMessages({
        chat: sampleChat,
        currentUser,
        socket: mockSocket,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(socketHandlers["messages_bulk_deleted"]).toBeDefined();

    act(() => {
      socketHandlers["messages_bulk_deleted"]({
        chatId: "chat-101",
        messageIds: ["bulk-2", "bulk-3"],
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]._id).toBe("bulk-1");
    console.log("TRACE [useChatMessages.test.jsx]: Verified multiple messages removed atomically via messages_bulk_deleted");
  });

  it("socket message-received for the sender's own send reconciles the optimistic bubble instead of duplicating it", async () => {
    // This is the "message sent 2-3 times" bug: the server broadcasts a new
    // message to the whole chat room, including the sender's own socket, so the
    // socket delivery can race ahead of the sender's own HTTP response. Before
    // clientId-based reconciliation, the socket copy (real _id) and the eventual
    // HTTP-confirmed copy (optimistic _id replaced) both ended up in state.
    console.log("TRACE [useChatMessages.test.jsx]: Testing socket echo of the sender's own message doesn't duplicate the optimistic bubble");
    const { apiClient } = await import("../../../../api/apiClient");
    apiClient.get.mockResolvedValue({
      data: { success: true, data: { messages: [], hasMore: false } },
    });

    let socketHandlers = {};
    mockSocket.on.mockImplementation((event, handler) => {
      socketHandlers[event] = handler;
    });

    const { result } = renderHook(() =>
      useChatMessages({ chat: sampleChat, currentUser, socket: mockSocket })
    );

    act(() => {
      result.current.setMessages((prev) =>
        upsertMessage(prev, {
          _id: "opt_abc123",
          clientId: "abc123",
          chat: "chat-101",
          sender: currentUser,
          content: "hi",
          status: "sent",
        })
      );
    });
    expect(result.current.messages).toHaveLength(1);

    // The room-wide broadcast reaches the sender's own socket before their HTTP
    // response resolves, carrying the same clientId and the real, server _id.
    act(() => {
      socketHandlers["message received"]({
        _id: "real-msg-1",
        clientId: "abc123",
        chat: "chat-101",
        sender: currentUser,
        content: "hi",
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]._id).toBe("real-msg-1");
    console.log("TRACE [useChatMessages.test.jsx]: Confirmed exactly one message survives the socket echo, matched via clientId");
  });
});

describe("upsertMessage", () => {
  it("appends a message with no matching _id or clientId", () => {
    console.log("TRACE [useChatMessages.test.jsx]: Testing upsertMessage appends a genuinely new message");
    const prev = [{ _id: "m1", content: "first" }];
    const next = upsertMessage(prev, { _id: "m2", content: "second" });
    expect(next).toHaveLength(2);
    expect(next[1]._id).toBe("m2");
  });

  it("replaces an existing entry matched by _id (e.g. an edit)", () => {
    console.log("TRACE [useChatMessages.test.jsx]: Testing upsertMessage replaces by _id");
    const prev = [{ _id: "m1", content: "old" }];
    const next = upsertMessage(prev, { _id: "m1", content: "new" });
    expect(next).toHaveLength(1);
    expect(next[0].content).toBe("new");
  });

  it("replaces an optimistic entry matched by clientId even though the _id differs", () => {
    console.log("TRACE [useChatMessages.test.jsx]: Testing upsertMessage replaces an optimistic bubble via clientId");
    const prev = [{ _id: "opt_x", clientId: "x", content: "sending…", status: "sent" }];
    const next = upsertMessage(prev, { _id: "real-id", clientId: "x", content: "sending…" });
    expect(next).toHaveLength(1);
    expect(next[0]._id).toBe("real-id");
  });

  it("does not merge two different real messages that happen to lack a clientId", () => {
    console.log("TRACE [useChatMessages.test.jsx]: Testing upsertMessage never cross-matches distinct messages without a clientId");
    const prev = [{ _id: "m1", content: "first" }];
    const next = upsertMessage(prev, { _id: "m2", content: "unrelated" });
    expect(next.map((m) => m._id)).toEqual(["m1", "m2"]);
  });
});
