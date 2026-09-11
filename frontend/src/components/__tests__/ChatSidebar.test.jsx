import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import ChatSidebar from "../ChatSidebar";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("ChatSidebar Component", () => {
  const sampleChats = [
    {
      _id: "c1",
      isGroup: false,
      participants: [
        { _id: "user1", username: "me" },
        { _id: "user2", username: "bob" },
      ],
      lastMessage: { content: "Hey there!", createdAt: new Date(Date.now() + 10000).toISOString() },
    },
    {
      _id: "c2",
      isGroup: true,
      chatName: "React Developers",
      participants: [{ _id: "user1" }],
      lastMessage: { content: "Welcome all!", createdAt: new Date(Date.now() - 10000).toISOString() },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    try { localStorage.clear(); } catch {}
  });

  it("renders list of chats correctly", () => {
    console.log("TRACE [ChatSidebar.test.jsx]: Testing chat list rendering");
    render(
      <ChatSidebar
        chats={sampleChats}
        activeChat={sampleChats[0]}
        onSelectChat={vi.fn()}
        onOpenCreateGroup={vi.fn()}
        currentUser={{ _id: "user1" }}
      />
    );

    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("React Developers")).toBeInTheDocument();
    expect(screen.getByText("Hey there!")).toBeInTheDocument();
  });

  it("triggers onSelectChat when a chat item is clicked", () => {
    console.log("TRACE [ChatSidebar.test.jsx]: Testing chat item selection callback");
    const onSelectChat = vi.fn();
    render(
      <ChatSidebar
        chats={sampleChats}
        activeChat={null}
        onSelectChat={onSelectChat}
        onOpenCreateGroup={vi.fn()}
        currentUser={{ _id: "user1" }}
      />
    );

    fireEvent.click(screen.getByText("React Developers"));
    expect(onSelectChat).toHaveBeenCalledWith(sampleChats[1]);
  });

  it("renders unread badge and typing indicator when active", () => {
    console.log("TRACE [ChatSidebar.test.jsx]: Testing unread badge and typing indicator");
    render(
      <ChatSidebar
        chats={sampleChats}
        activeChat={null}
        onSelectChat={vi.fn()}
        onOpenCreateGroup={vi.fn()}
        currentUser={{ _id: "user1" }}
        unreadCounts={{ c1: 4 }}
        typingMap={{ c2: "alice" }}
      />
    );

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/typing.../i)).toBeInTheDocument();
    console.log("TRACE [ChatSidebar.test.jsx]: Verified unread badge (4) and typing indicator");
  });

  it("filters chats using WhatsApp filter pills (All, Unread, Groups)", () => {
    console.log("TRACE [ChatSidebar.test.jsx]: Testing filter pills");
    render(
      <ChatSidebar
        chats={sampleChats}
        activeChat={null}
        onSelectChat={vi.fn()}
        onOpenCreateGroup={vi.fn()}
        currentUser={{ _id: "user1" }}
        unreadCounts={{ c1: 2 }}
      />
    );

    // Initial state: both chats rendered under "All"
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("React Developers")).toBeInTheDocument();

    // Click "Groups" pill
    const groupsPill = screen.getByRole("button", { name: /groups/i });
    fireEvent.click(groupsPill);

    // Only group chat should be visible
    expect(screen.getByText("React Developers")).toBeInTheDocument();
    expect(screen.queryByText("bob")).not.toBeInTheDocument();

    // Click "Unread" pill
    const unreadPill = screen.getByRole("button", { name: /unread/i });
    fireEvent.click(unreadPill);

    // Only unread chat (c1, bob) should be visible
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.queryByText("React Developers")).not.toBeInTheDocument();
    console.log("TRACE [ChatSidebar.test.jsx]: Filter pills verified successfully");
  });

  it("opens WhatsApp chat context menu with working actions (Mark as read, Pin, Mute)", () => {
    console.log("TRACE [ChatSidebar.test.jsx]: Testing chat item context menu");
    const onMarkAsRead = vi.fn();
    render(
      <ChatSidebar
        chats={sampleChats}
        activeChat={sampleChats[0]}
        onSelectChat={vi.fn()}
        onOpenCreateGroup={vi.fn()}
        currentUser={{ _id: "user1" }}
        unreadCounts={{ c1: 3 }}
        onMarkAsRead={onMarkAsRead}
      />
    );

    // Find chevron buttons
    const chevronButtons = screen.getAllByTitle("Chat options");
    expect(chevronButtons.length).toBeGreaterThan(0);

    // Click chevron for first chat
    fireEvent.click(chevronButtons[0]);

    // Context menu should appear with WhatsApp options
    expect(screen.getByText("Close Chat")).toBeInTheDocument();
    expect(screen.getByText("Mark as read")).toBeInTheDocument();
    expect(screen.getByText("Pin")).toBeInTheDocument();
    expect(screen.getByText("Mute")).toBeInTheDocument();

    // Click "Mark as read"
    fireEvent.click(screen.getByText("Mark as read"));
    expect(onMarkAsRead).toHaveBeenCalledWith("c1");
    console.log("TRACE [ChatSidebar.test.jsx]: Chat context menu actions verified");
  });

  it("toggles context menu closed on re-clicking the chevron and closes on outside click", () => {
    console.log("TRACE [ChatSidebar.test.jsx]: Testing toggle on re-click and outside click");
    render(
      <ChatSidebar
        chats={sampleChats}
        activeChat={null}
        onSelectChat={vi.fn()}
        onOpenCreateGroup={vi.fn()}
        currentUser={{ _id: "user1" }}
      />
    );

    const chevronButtons = screen.getAllByTitle("Chat options");
    expect(chevronButtons.length).toBeGreaterThan(0);

    // 1. Click opens menu
    fireEvent.click(chevronButtons[0]);
    expect(screen.getByText("Pin")).toBeInTheDocument();

    // 2. Re-click chevron closes menu
    fireEvent.click(chevronButtons[0]);
    expect(screen.queryByText("Pin")).not.toBeInTheDocument();

    // 3. Open again, then click outside
    fireEvent.click(chevronButtons[0]);
    expect(screen.getByText("Pin")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Pin")).not.toBeInTheDocument();
    console.log("TRACE [ChatSidebar.test.jsx]: Re-click toggle and outside click verified");
  });

  it("calls onMarkAsUnread when selecting 'Mark as unread' from context menu", () => {
    console.log("TRACE [ChatSidebar.test.jsx]: Testing onMarkAsUnread callback from context menu");
    const onMarkAsUnread = vi.fn();
    const sentByMeChat = [
      {
        _id: "c_sent",
        isGroup: true,
        chatName: "Shanks & me",
        participants: [{ _id: "user1" }, { _id: "user2" }],
        lastMessage: {
          content: "Ok no",
          sender: { _id: "user1", username: "me" },
          createdAt: new Date().toISOString(),
        },
      },
    ];

    render(
      <ChatSidebar
        chats={sentByMeChat}
        activeChat={null}
        onSelectChat={vi.fn()}
        onOpenCreateGroup={vi.fn()}
        currentUser={{ _id: "user1" }}
        unreadCounts={{ c_sent: 0 }}
        onMarkAsUnread={onMarkAsUnread}
      />
    );

    // Initial state: unread badge '1' should NOT be in the document
    expect(screen.queryByText("1")).toBeNull();

    // Click chevron for options menu
    const chevronBtn = screen.getByTitle("Chat options");
    fireEvent.click(chevronBtn);

    // Click "Mark as unread"
    const markUnreadBtn = screen.getByText("Mark as unread");
    fireEvent.click(markUnreadBtn);

    expect(onMarkAsUnread).toHaveBeenCalledWith("c_sent");
    console.log("TRACE [ChatSidebar.test.jsx]: Confirmed onMarkAsUnread is triggered with chat ID");
  });

  it("debounces user search queries with 300ms delay", async () => {
    console.log("TRACE [ChatSidebar.test.jsx]: Testing user search debouncing");
    vi.useFakeTimers();
    const { apiClient } = await import("../../api/apiClient");
    apiClient.get.mockResolvedValue({
      data: { success: true, data: [{ _id: "u3", username: "charlie", fullName: "Charlie Brown" }] },
    });

    render(
      <ChatSidebar
        chats={sampleChats}
        activeChat={null}
        onSelectChat={vi.fn()}
        currentUser={{ _id: "user1" }}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search");
    fireEvent.change(searchInput, { target: { value: "ch" } });

    // Should NOT have called apiClient immediately
    expect(apiClient.get).not.toHaveBeenCalled();

    // Advance timer by 290ms - still not called
    act(() => {
      vi.advanceTimersByTime(290);
    });
    expect(apiClient.get).not.toHaveBeenCalled();

    // Advance past 300ms
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining("ch"),
      expect.objectContaining({ signal: expect.any(Object) })
    );

    vi.useRealTimers();
    console.log("TRACE [ChatSidebar.test.jsx]: Verified search debouncing past 300ms threshold");
  });
});

