import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MessageItem from "../MessageItem";

describe("MessageItem Component", () => {
  const currentUser = { _id: "me123", username: "current_user" };
  const groupChat = { _id: "group1", isGroup: true };
  const directChat = { _id: "dm1", isGroup: false };

  it("renders sender username in group chat when isSameSenderAsPrev is false", () => {
    console.log("TRACE [MessageItem.test.jsx]: Testing sender username in group for first message of block");
    const msg = {
      _id: "m1",
      content: "Hello from Sakshi",
      sender: { _id: "user_sakshi", username: "sakshi_patil" },
      createdAt: new Date().toISOString(),
    };

    render(
      <MessageItem
        msg={msg}
        currentUser={currentUser}
        chat={groupChat}
        isSameSenderAsPrev={false}
      />
    );

    const senderEl = screen.getByText("sakshi_patil");
    expect(senderEl).toBeInTheDocument();
    expect(senderEl.className).toContain("message-sender-name");
    console.log("TRACE [MessageItem.test.jsx]: Sender username verified in group chat");
  });

  it("does NOT render sender username when isSameSenderAsPrev is true (consecutive messages)", () => {
    console.log("TRACE [MessageItem.test.jsx]: Testing sender username deduplication on consecutive messages");
    const msg = {
      _id: "m2",
      content: "Second message from Sakshi",
      sender: { _id: "user_sakshi", username: "sakshi_patil" },
      createdAt: new Date().toISOString(),
    };

    render(
      <MessageItem
        msg={msg}
        currentUser={currentUser}
        chat={groupChat}
        isSameSenderAsPrev={true}
      />
    );

    expect(screen.queryByText("sakshi_patil")).toBeNull();
    console.log("TRACE [MessageItem.test.jsx]: Confirmed consecutive message does not repeat sender username");
  });

  it("does NOT render sender username in direct (1-on-1) chats", () => {
    console.log("TRACE [MessageItem.test.jsx]: Testing direct chat without sender name above bubble");
    const msg = {
      _id: "m3",
      content: "Direct message",
      sender: { _id: "user_sakshi", username: "sakshi_patil" },
      createdAt: new Date().toISOString(),
    };

    render(
      <MessageItem
        msg={msg}
        currentUser={currentUser}
        chat={directChat}
        isSameSenderAsPrev={false}
      />
    );

    expect(screen.queryByText("sakshi_patil")).toBeNull();
    console.log("TRACE [MessageItem.test.jsx]: Confirmed direct chat hides redundant sender name");
  });

  it("does NOT render sender username when message belongs to another chat during transition", () => {
    console.log("TRACE [MessageItem.test.jsx]: Testing transition guard when message chat does not match active group chat");
    const msg = {
      _id: "m4",
      chat: "old_dm_chat",
      content: "Message from old chat",
      sender: { _id: "user_sakshi", username: "sakshi_patil" },
      createdAt: new Date().toISOString(),
    };

    render(
      <MessageItem
        msg={msg}
        currentUser={currentUser}
        chat={groupChat}
        isSameSenderAsPrev={false}
      />
    );

    expect(screen.queryByText("sakshi_patil")).toBeNull();
    console.log("TRACE [MessageItem.test.jsx]: Confirmed foreign chat message does not display group sender name");
  });

  describe("reply quote", () => {
    const me = { _id: "me" };
    const dm = { _id: "c1", isGroup: false };
    const reply = {
      _id: "m9",
      chat: "c1",
      content: "True bhai",
      sender: { _id: "me", username: "me" },
      replyTo: { _id: "orig-1", content: "whatapp ki mkc", sender: { username: "shankkyvibe" } },
      createdAt: new Date().toISOString(),
    };

    it("tapping the quoted message jumps to the original", () => {
      const onJumpToMessage = vi.fn();
      render(<MessageItem msg={reply} currentUser={me} chat={dm} onJumpToMessage={onJumpToMessage} />);
      fireEvent.click(screen.getByRole("button", { name: /go to the original message/i }));
      expect(onJumpToMessage).toHaveBeenCalledWith("orig-1");
    });

    it("is keyboard accessible (Enter jumps too)", () => {
      const onJumpToMessage = vi.fn();
      render(<MessageItem msg={reply} currentUser={me} chat={dm} onJumpToMessage={onJumpToMessage} />);
      fireEvent.keyDown(screen.getByRole("button", { name: /go to the original message/i }), { key: "Enter" });
      expect(onJumpToMessage).toHaveBeenCalledWith("orig-1");
    });

    it("in selection mode, tapping selects the message instead of jumping", () => {
      const onJumpToMessage = vi.fn();
      const onToggleSelect = vi.fn();
      render(
        <MessageItem
          msg={reply}
          currentUser={me}
          chat={dm}
          isSelectionActive
          onToggleSelect={onToggleSelect}
          onJumpToMessage={onJumpToMessage}
        />
      );
      expect(screen.queryByRole("button", { name: /go to the original message/i })).toBeNull();
      fireEvent.click(screen.getByText("whatapp ki mkc"));
      expect(onJumpToMessage).not.toHaveBeenCalled();
      expect(onToggleSelect).toHaveBeenCalledWith("m9");
    });
  });
});
