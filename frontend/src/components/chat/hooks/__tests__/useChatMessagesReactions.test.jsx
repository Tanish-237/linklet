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

describe("useChatMessages Optimistic Reactions Tests", () => {
  let mockSocket;
  const sampleChat = {
    _id: "chat-react-1",
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

  it("applies optimistic reaction immediately (0ms) and updates upon server confirmation", async () => {
    console.log("TRACE [useChatMessagesReactions.test.jsx]: Testing optimistic reaction addition");
    const { apiClient } = await import("../../../../api/apiClient");
    const initialMessages = [
      {
        _id: "msg-101",
        chat: "chat-react-1",
        sender: { _id: "user-2", username: "peer" },
        content: "Nice work!",
        reactions: [],
      },
    ];

    apiClient.get.mockResolvedValue({
      data: { success: true, data: { messages: initialMessages, hasMore: false } },
    });

    let resolveApiCall;
    const apiPromise = new Promise((resolve) => {
      resolveApiCall = resolve;
    });
    apiClient.post.mockReturnValue(apiPromise);

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

    expect(result.current.messages[0].reactions).toEqual([]);

    // Trigger toggle reaction
    act(() => {
      result.current.toggleReaction("msg-101", "👍");
    });

    // Verify optimistic update took effect synchronously before API resolution!
    expect(result.current.messages[0].reactions).toHaveLength(1);
    expect(result.current.messages[0].reactions[0].emoji).toBe("👍");
    expect(result.current.messages[0].reactions[0].user).toEqual(currentUser);
    // The reaction is now broadcast by the SERVER (after it persists the
    // toggle), not relayed by the client — see backend socket.js notifyReaction.
    // The client's own optimistic UI update above is what makes this feel instant.
    expect(mockSocket.emit).not.toHaveBeenCalledWith("message reaction", expect.anything());

    // Now resolve the server response
    await act(async () => {
      resolveApiCall({
        data: {
          success: true,
          data: {
            ...result.current.messages[0],
            reactions: [{ user: currentUser, emoji: "👍" }],
          },
        },
      });
      await apiPromise;
    });

    expect(result.current.messages[0].reactions[0].emoji).toBe("👍");
    console.log("TRACE [useChatMessagesReactions.test.jsx]: Optimistic reaction addition verified successfully");
  });

  it("rolls back optimistic reaction if backend API fails", async () => {
    console.log("TRACE [useChatMessagesReactions.test.jsx]: Testing reaction rollback on API failure");
    const { apiClient } = await import("../../../../api/apiClient");
    const initialMessages = [
      {
        _id: "msg-102",
        chat: "chat-react-1",
        sender: { _id: "user-2", username: "peer" },
        content: "Awesome!",
        reactions: [],
      },
    ];

    apiClient.get.mockResolvedValue({
      data: { success: true, data: { messages: initialMessages, hasMore: false } },
    });

    apiClient.post.mockRejectedValue(new Error("Network Error"));

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

    expect(result.current.messages[0].reactions).toEqual([]);

    // Trigger toggle reaction
    await act(async () => {
      await result.current.toggleReaction("msg-102", "❤️");
    });

    // After failure, state should be rolled back to empty array
    expect(result.current.messages[0].reactions).toEqual([]);
    console.log("TRACE [useChatMessagesReactions.test.jsx]: Reaction rollback on failure verified successfully");
  });

  it("toggles off existing reaction optimistically when same emoji clicked", async () => {
    console.log("TRACE [useChatMessagesReactions.test.jsx]: Testing toggling off existing reaction");
    const { apiClient } = await import("../../../../api/apiClient");
    const initialMessages = [
      {
        _id: "msg-103",
        chat: "chat-react-1",
        sender: { _id: "user-2", username: "peer" },
        content: "Great job!",
        reactions: [{ user: currentUser, emoji: "🎉" }],
      },
    ];

    apiClient.get.mockResolvedValue({
      data: { success: true, data: { messages: initialMessages, hasMore: false } },
    });
    apiClient.post.mockResolvedValue({
      data: {
        success: true,
        data: { ...initialMessages[0], reactions: [] },
      },
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

    expect(result.current.messages[0].reactions).toHaveLength(1);

    // Clicking same emoji toggles it off
    await act(async () => {
      await result.current.toggleReaction("msg-103", "🎉");
    });

    expect(result.current.messages[0].reactions).toHaveLength(0);
    console.log("TRACE [useChatMessagesReactions.test.jsx]: Toggling off verified successfully");
  });
});
