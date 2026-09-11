import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChatMessages } from "../useChatMessages";

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
    mockSocket = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
  });

  it("handles incoming socket message without making HTTP PUT markAsRead", async () => {
    console.log("TRACE [useChatMessages.test.jsx]: Testing message received handler");
    const { apiClient } = await import("../../../../api/apiClient");
    apiClient.get.mockResolvedValue({
      data: { success: true, data: { messages: [], hasMore: false } },
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

    expect(mockSocket.emit).toHaveBeenCalledWith("join chat", "chat-101");
    expect(socketHandlers["message received"]).toBeDefined();

    // Trigger incoming message
    const incomingMsg = {
      _id: "msg-999",
      chat: "chat-101",
      sender: { _id: "user-2", username: "bob" },
      content: "Hello from socket!",
      createdAt: new Date().toISOString(),
    };

    // Clear the initial mount PUT call so we test only the socket message handler
    apiClient.put.mockClear();

    act(() => {
      socketHandlers["message received"](incomingMsg);
    });

    // Verify message added to state
    expect(result.current.messages).toContainEqual(incomingMsg);

    // Verify socket emitted read receipt
    expect(mockSocket.emit).toHaveBeenCalledWith("read receipt", {
      chatId: "chat-101",
      userId: "user-1",
    });

    // Verify NO HTTP PUT was made on incoming socket message
    expect(apiClient.put).not.toHaveBeenCalled();
    console.log("TRACE [useChatMessages.test.jsx]: Verified no redundant HTTP PUT made on message received");
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
});
