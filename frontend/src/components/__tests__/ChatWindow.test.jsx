import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import ChatWindow from "../chat/ChatWindow";
import { apiClient } from "../../api/apiClient";
import { clearChatMessageCache } from "../chat/hooks/chatMessageCache";

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
    clearChatMessageCache();
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

    const searchInput = await screen.findByPlaceholderText("Search in this chat");
    expect(searchInput).toBeInTheDocument();
  });

  it("searches the whole chat on the server and shows the result count", async () => {
    const convo = [
      { _id: "s1", sender: { _id: "u2", username: "alice" }, content: "hello first", createdAt: new Date(Date.now() - 5000).toISOString() },
      { _id: "s2", sender: { _id: "u2", username: "alice" }, content: "hello again", createdAt: new Date().toISOString() },
    ];
    apiClient.get.mockImplementation((url) =>
      url.includes("/chat/message/search/")
        ? Promise.resolve({ data: { success: true, data: [{ _id: "s2" }, { _id: "s1" }] } })
        : Promise.resolve({ data: { success: true, data: { messages: convo, hasMore: false } } })
    );

    render(<ChatWindow chat={sampleChat} currentUser={{ _id: "u1" }} socket={null} onToggleInfo={vi.fn()} />);
    (await screen.findByTitle("Search messages")).click();
    const input = await screen.findByPlaceholderText("Search in this chat");
    fireEvent.change(input, { target: { value: "hel" } });

    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith(`/chat/message/search/${sampleChat._id}`, { params: { query: "hel" } });

    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("2 of 2")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
  });

  it("pins instantly (optimistic) and unpins from the banner", async () => {
    apiClient.get.mockResolvedValue({
      data: { success: true, data: { messages: sampleMessages, hasMore: false } },
    });
    let resolvePin;
    apiClient.put.mockImplementation(
      (url, body) =>
        new Promise((resolve) => {
          resolvePin = () =>
            resolve({
              data: {
                success: true,
                data: { _id: sampleChat._id, pinnedMessages: url.endsWith("/pin") ? [sampleMessages[0]] : [] },
              },
            });
          if (url.includes("/message/read/")) resolve({ data: { success: true } });
          void body;
        })
    );
    const onPinnedMessagesChange = vi.fn();
    render(
      <ChatWindow
        chat={{ ...sampleChat, pinnedMessages: [] }}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
        onPinnedMessagesChange={onPinnedMessagesChange}
      />
    );
    await screen.findByText(sampleMessages[0].content);

    fireEvent.click(document.querySelector(`#msg-${sampleMessages[0]._id} .msg-bubble-chevron-btn`));
    fireEvent.click(await screen.findByText(/^Pin$/));

    // Shown before the server has answered
    expect(await screen.findByText("Pinned message")).toBeInTheDocument();
    expect(onPinnedMessagesChange).toHaveBeenCalled();
    resolvePin();

    fireEvent.click(await screen.findByTitle("Unpin this message"));
    await waitFor(() => expect(screen.queryByText("Pinned message")).toBeNull());
    expect(apiClient.put).toHaveBeenCalledWith("/chat/unpin", { chatId: sampleChat._id, messageId: sampleMessages[0]._id });
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
    const lastReadAt = new Date(Date.now() - 30000).toISOString();
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
        unreadSnapshot={{ count: 1, lastReadAt }}
      />
    );

    await screen.findByText("New unread message");

    const messagesContainer = container.querySelector(".chat-messages");
    expect(messagesContainer).toBeInTheDocument();
    // Verify scrollBehavior is auto (not smooth) to eliminate up-to-down scroll jump
    expect(messagesContainer.style.scrollBehavior).toBe("auto");

    const unreadSeparator = await waitFor(() => {
      const el = container.querySelector("#unread-messages-separator");
      expect(el).toBeInTheDocument();
      return el;
    });
    expect(unreadSeparator.nextElementSibling.id).toBe("msg-m_unread1");
    expect(screen.getByText("1 Unread Message")).toBeInTheDocument();
  });

  it("pages back through history when the unread run starts before the first page", async () => {
    const lastReadAt = new Date(Date.now() - 120000).toISOString();
    const at = (s) => new Date(Date.now() - s * 1000).toISOString();
    apiClient.get
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            messages: [{ _id: "new2", sender: { _id: "u2" }, content: "newest", readBy: ["u2"], createdAt: at(10) }],
            hasMore: true,
            nextCursor: "c1",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            messages: [
              { _id: "old", sender: { _id: "u2" }, content: "already read", readBy: ["u1", "u2"], createdAt: at(300) },
              { _id: "new1", sender: { _id: "u2" }, content: "first unread", readBy: ["u2"], createdAt: at(60) },
            ],
            hasMore: false,
            nextCursor: null,
          },
        },
      });

    const { container } = render(
      <ChatWindow
        chat={sampleChat}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
        unreadSnapshot={{ count: 2, lastReadAt }}
      />
    );

    const separator = await waitFor(() => {
      const el = container.querySelector("#unread-messages-separator");
      expect(el).toBeInTheDocument();
      return el;
    });
    expect(separator.nextElementSibling.id).toBe("msg-new1");
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining("/chat/message/"), {
      params: { cursor: "c1", limit: 25 },
    });
  });

  it("opens an already-read chat at the latest message with no divider", async () => {
    apiClient.get.mockResolvedValue({
      data: { success: true, data: { messages: sampleMessages, hasMore: false } },
    });
    const { container } = render(
      <ChatWindow
        chat={sampleChat}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
        unreadSnapshot={{ count: 0, lastReadAt: null }}
      />
    );
    await screen.findByText(sampleMessages[sampleMessages.length - 1].content);
    expect(container.querySelector("#unread-messages-separator")).toBeNull();
  });

  it("keeps the reader's place when older messages load on scrolling up (no jump to bottom)", async () => {
    const ROW = 100;
    const VIEWPORT = 300;
    const msg = (id, secondsAgo) => ({
      _id: id,
      sender: { _id: "u2", username: "alice" },
      content: `message ${id}`,
      readBy: ["u1", "u2"],
      createdAt: new Date(Date.now() - secondsAgo * 1000).toISOString(),
    });
    apiClient.get
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: { messages: [msg("m1", 50), msg("m2", 40), msg("m3", 30), msg("m4", 20), msg("m5", 10)], hasMore: true, nextCursor: "c1" },
        },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: { messages: [msg("o1", 70), msg("o2", 60)], hasMore: false, nextCursor: null } },
      });

    const { container } = render(
      <ChatWindow chat={sampleChat} currentUser={{ _id: "u1" }} socket={null} onToggleInfo={vi.fn()} unreadSnapshot={{ count: 0 }} />
    );
    await screen.findByText("message m5");

    // Simulated layout: every message row is 100px tall, stacked in DOM order.
    const scroller = container.querySelector(".chat-messages");
    const rows = () => Array.from(scroller.querySelectorAll('[id^="msg-"]'));
    Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => VIEWPORT });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, get: () => rows().length * ROW });
    const realRect = Element.prototype.getBoundingClientRect;
    const rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
      if (this === scroller) return { top: 0, bottom: VIEWPORT, left: 0, right: 0, width: 0, height: VIEWPORT };
      const idx = rows().indexOf(this);
      if (idx === -1) return realRect.call(this);
      const top = idx * ROW - scroller.scrollTop;
      return { top, bottom: top + ROW, left: 0, right: 0, width: 0, height: ROW };
    });

    // Reader scrolls up to the top: m1 is 20px above the top edge.
    scroller.scrollTop = 20;
    fireEvent.scroll(scroller);

    await screen.findByText("message o1");
    // Two 100px rows were added above: m1 must sit exactly where it was
    // (scrollTop 20 -> 220). The old code applied the shift twice (native +
    // manual) or snapped to the bottom.
    await waitFor(() => expect(scroller.scrollTop).toBe(220));
    const m1 = document.getElementById("msg-m1");
    expect(m1.getBoundingClientRect().top).toBe(-20);

    rectSpy.mockRestore();
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

  it("opens a message's menu on press-and-hold (phones have no hover chevron)", async () => {
    apiClient.get.mockResolvedValue({
      data: { success: true, data: { messages: sampleMessages, hasMore: false } },
    });
    render(<ChatWindow chat={sampleChat} currentUser={{ _id: "u1" }} socket={null} onToggleInfo={vi.fn()} />);

    const bubble = (await screen.findByText("Hello there!")).closest(".message-bubble");
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();

    fireEvent.touchStart(bubble, { touches: [{ clientX: 50, clientY: 50 }] });
    await act(() => new Promise((r) => setTimeout(r, 500)));
    fireEvent.touchEnd(bubble);

    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "React to message" }).className).toContain("opacity-100");
  });
});
