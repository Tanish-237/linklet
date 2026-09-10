import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
      lastMessage: { content: "Hey there!", createdAt: new Date().toISOString() },
    },
    {
      _id: "c2",
      isGroup: true,
      chatName: "React Developers",
      participants: [{ _id: "user1" }],
      lastMessage: { content: "Welcome all!", createdAt: new Date().toISOString() },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
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
});
