import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatHeader from "../ChatHeader";

describe("ChatHeader Component", () => {
  const currentUser = { _id: "u1", username: "tanish" };

  const groupChat = {
    _id: "g1",
    isGroup: true,
    chatName: "MNNIT CSE Batch",
    participants: [{ _id: "u1" }, { _id: "u2" }, { _id: "u3" }],
  };

  it("does NOT render the 'i' (info_outline) button in group chat header", () => {
    console.log("TRACE [ChatHeader.test.jsx]: Verifying standalone 'i' button is removed");
    render(
      <ChatHeader
        chat={groupChat}
        currentUser={currentUser}
        onToggleInfo={vi.fn()}
        onToggleSearch={vi.fn()}
      />
    );

    // Verify info_outline is NOT in the document
    expect(screen.queryByText("info_outline")).toBeNull();
    console.log("TRACE [ChatHeader.test.jsx]: Confirmed info_outline 'i' button absent");
  });

  it("calls onToggleInfo when clicking the group header card", () => {
    console.log("TRACE [ChatHeader.test.jsx]: Testing clicking group header card triggers onToggleInfo");
    const onToggleInfo = vi.fn();

    render(
      <ChatHeader
        chat={groupChat}
        currentUser={currentUser}
        onToggleInfo={onToggleInfo}
        onToggleSearch={vi.fn()}
      />
    );

    const groupNameEl = screen.getByText("MNNIT CSE Batch");
    expect(groupNameEl).toBeInTheDocument();

    // Click the header user/group card
    fireEvent.click(groupNameEl.closest(".chat-header-user"));
    expect(onToggleInfo).toHaveBeenCalledTimes(1);
    console.log("TRACE [ChatHeader.test.jsx]: Group header click toggle verified");
  });

  it("renders member count for groups and toggles search", () => {
    console.log("TRACE [ChatHeader.test.jsx]: Testing search toggle and member count");
    const onToggleSearch = vi.fn();

    render(
      <ChatHeader
        chat={groupChat}
        currentUser={currentUser}
        onToggleInfo={vi.fn()}
        onToggleSearch={onToggleSearch}
      />
    );

    expect(screen.getByText("3 members")).toBeInTheDocument();

    const searchBtn = screen.getByTitle("Search messages");
    fireEvent.click(searchBtn);
    expect(onToggleSearch).toHaveBeenCalledTimes(1);
    console.log("TRACE [ChatHeader.test.jsx]: Search toggle and member count verified");
  });
});
