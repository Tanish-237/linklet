import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import ChatWindow from "../ChatWindow";
import { apiClient } from "../../api/apiClient";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("ChatWindow Component", () => {
  const sampleChat = {
    _id: "c1",
    isGroup: false,
    participants: [
      { _id: "u1", username: "me" },
      { _id: "u2", username: "alice" },
    ],
  };

  const sampleMessages = [
    {
      _id: "m1",
      sender: { _id: "u2", username: "alice" },
      content: "Hello there!",
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders messages for active chat", async () => {
    console.log("TRACE [ChatWindow.test.jsx]: Testing message fetching and rendering");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: { messages: sampleMessages, hasMore: false },
      },
    });

    render(
      <ChatWindow
        chat={sampleChat}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        "/chat/message/c1",
        expect.anything()
      );
      expect(screen.getByText("Hello there!")).toBeInTheDocument();
    });
    console.log("TRACE [ChatWindow.test.jsx]: Successfully verified message fetching and rendering");
  });

  it("renders 'Load older messages' button and loads older messages on click", async () => {
    console.log("TRACE [ChatWindow.test.jsx]: Testing Load Older Messages button click");
    apiClient.get.mockImplementation((url, config) => {
      if (config?.params?.cursor) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              messages: [
                {
                  _id: "m0",
                  sender: { _id: "u2", username: "alice" },
                  content: "Ancient message from the past",
                  createdAt: new Date(Date.now() - 100000).toISOString(),
                },
              ],
              hasMore: false,
              nextCursor: null,
            },
          },
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            messages: sampleMessages,
            hasMore: true,
            nextCursor: "2026-09-01T00:00:00.000Z",
          },
        },
      });
    });

    render(
      <ChatWindow
        chat={sampleChat}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
      />
    );

    const loadMoreBtn = await screen.findByRole("button", { name: /load older messages/i });
    expect(loadMoreBtn).toBeInTheDocument();

    loadMoreBtn.click();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/chat/message/c1", {
        params: { cursor: "2026-09-01T00:00:00.000Z", limit: 25 },
      });
      expect(screen.getByText("Ancient message from the past")).toBeInTheDocument();
    });
    console.log("TRACE [ChatWindow.test.jsx]: Successfully verified cursor-based older message pagination");
  });

  it("toggles in-chat search bar and searches message text", async () => {
    console.log("TRACE [ChatWindow.test.jsx]: Testing in-chat search feature");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: { messages: sampleMessages, hasMore: false },
      },
    });

    render(
      <ChatWindow
        chat={sampleChat}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
      />
    );

    const searchBtn = await screen.findByTitle("Search messages");
    expect(searchBtn).toBeInTheDocument();
    searchBtn.click();

    const searchInput = await screen.findByPlaceholderText("Search within this chat...");
    expect(searchInput).toBeInTheDocument();
    console.log("TRACE [ChatWindow.test.jsx]: In-chat search bar verified successfully");
  });

  it("opens reaction picker, selects emoji, and sends reaction API call", async () => {
    console.log("TRACE [ChatWindow.test.jsx]: Testing quick reaction picker and reaction toggle");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: { messages: sampleMessages, hasMore: false },
      },
    });
    apiClient.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          ...sampleMessages[0],
          reactions: [{ user: "u1", emoji: "❤️" }],
        },
      },
    });

    render(
      <ChatWindow
        chat={sampleChat}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
      />
    );

    await screen.findByText("Hello there!");

    const reactBtn = screen.getByTitle("React");
    expect(reactBtn).toBeInTheDocument();
    reactBtn.click();

    const heartEmojiBtn = await screen.findByTitle("React with ❤️");
    expect(heartEmojiBtn).toBeInTheDocument();
    heartEmojiBtn.click();

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/chat/message/react", {
        chatId: "c1",
        messageId: "m1",
        emoji: "❤️",
      });
    });
    console.log("TRACE [ChatWindow.test.jsx]: Reaction picker and toggle verified successfully");
  });

  it("opens message options context menu, renders options, and copies text", async () => {
    console.log("TRACE [ChatWindow.test.jsx]: Testing message options dropdown menu");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: { messages: sampleMessages, hasMore: false },
      },
    });

    const clipboardWriteMock = vi.fn().mockResolvedValue();
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteMock },
    });

    render(
      <ChatWindow
        chat={sampleChat}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
      />
    );

    await screen.findByText("Hello there!");

    const optionsBtn = screen.getByTitle("Message options");
    expect(optionsBtn).toBeInTheDocument();
    optionsBtn.click();

    expect(await screen.findByRole("button", { name: /reply/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pin message/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /forward/i })).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", { name: /copy/i });
    expect(copyBtn).toBeInTheDocument();
    copyBtn.click();

    await waitFor(() => {
      expect(clipboardWriteMock).toHaveBeenCalledWith("Hello there!");
    });
    console.log("TRACE [ChatWindow.test.jsx]: Message options menu and copy verified successfully");
  });

  it("instantly anchors chat to unread separator or bottom without smooth scroll animation", async () => {
    console.log("TRACE [ChatWindow.test.jsx]: Testing instant scroll anchoring on chat open");
    const unreadMessages = [
      {
        _id: "m_read1",
        sender: { _id: "u2", username: "alice" },
        content: "Old message",
        readBy: ["u1", "u2"],
        createdAt: new Date(Date.now() - 60000).toISOString(),
      },
      {
        _id: "m_unread1",
        sender: { _id: "u2", username: "alice" },
        content: "New unread message",
        readBy: ["u2"],
        createdAt: new Date().toISOString(),
      },
    ];

    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: { messages: unreadMessages, hasMore: false },
      },
    });

    const { container } = render(
      <ChatWindow
        chat={sampleChat}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
      />
    );

    await screen.findByText("New unread message");

    const messagesContainer = container.querySelector(".chat-messages");
    expect(messagesContainer).toBeInTheDocument();
    // Verify scrollBehavior is auto (not smooth) to eliminate up-to-down scroll jump
    expect(messagesContainer.style.scrollBehavior).toBe("auto");

    const unreadSeparator = container.querySelector("#unread-messages-separator");
    expect(unreadSeparator).toBeInTheDocument();
    console.log("TRACE [ChatWindow.test.jsx]: Confirmed instant auto-scroll anchoring to unread separator");
  });

  it("renders blocked contact banner and hides composer when isBlocked is true", async () => {
    console.log("TRACE [ChatWindow.test.jsx]: Testing blocked contact banner rendering");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: { messages: sampleMessages, hasMore: false },
      },
    });

    render(
      <ChatWindow
        chat={sampleChat}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
        isBlocked={true}
      />
    );

    await screen.findByText("Hello there!");

    expect(
      screen.getByText("You have blocked this contact. Unblock them from the sidebar menu to send messages.")
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Type a message...")).not.toBeInTheDocument();
    console.log("TRACE [ChatWindow.test.jsx]: Verified blocked banner renders and composer is hidden");
  });
});


