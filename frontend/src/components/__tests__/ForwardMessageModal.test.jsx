import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import ForwardMessageModal from "../ForwardMessageModal";

describe("ForwardMessageModal Component (WhatsApp-style Multi-select Forwarding)", () => {
  const sampleChats = [
    {
      _id: "c1",
      isGroup: false,
      participants: [{ username: "alice", fullName: "Alice Smith" }],
    },
    {
      _id: "c2",
      isGroup: false,
      participants: [{ username: "bob", fullName: "Bob Jones" }],
    },
    {
      _id: "c3",
      isGroup: true,
      chatName: "Developers Group",
      participants: [{ username: "alice" }, { username: "bob" }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    console.log("TRACE [ForwardMessageModal.test.jsx]: Testing modal hidden when isOpen=false");
    const { container } = render(
      <ForwardMessageModal
        isOpen={false}
        chats={sampleChats}
        selectedMessageCount={2}
        onConfirmForward={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
    console.log("TRACE [ForwardMessageModal.test.jsx]: Confirmed modal is null when closed");
  });

  it("renders WhatsApp-style 'Send to' header with selected messages count and list of chats", () => {
    console.log("TRACE [ForwardMessageModal.test.jsx]: Testing modal header and chat options");
    render(
      <ForwardMessageModal
        isOpen={true}
        chats={sampleChats}
        selectedMessageCount={3}
        onConfirmForward={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Send to")).toBeInTheDocument();
    expect(screen.getByText("(3 messages)")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("Developers Group")).toBeInTheDocument();
    console.log("TRACE [ForwardMessageModal.test.jsx]: Verified chat list and header count");
  });

  it("filters chats based on search input", () => {
    console.log("TRACE [ForwardMessageModal.test.jsx]: Testing search filter in forward modal");
    render(
      <ForwardMessageModal
        isOpen={true}
        chats={sampleChats}
        selectedMessageCount={1}
        onConfirmForward={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "bob" } });

    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
    console.log("TRACE [ForwardMessageModal.test.jsx]: Search filter successfully isolated matching chat");
  });

  it("allows selecting multiple chats and forwards to all selected chat IDs", async () => {
    console.log("TRACE [ForwardMessageModal.test.jsx]: Testing multi-select forwarding callback");
    const onConfirmForward = vi.fn().mockResolvedValue();

    render(
      <ForwardMessageModal
        isOpen={true}
        chats={sampleChats}
        selectedMessageCount={2}
        onConfirmForward={onConfirmForward}
        onClose={vi.fn()}
      />
    );

    // Click Alice Smith to select
    fireEvent.click(screen.getByText("Alice Smith"));
    expect(screen.getByText("1 conversation selected")).toBeInTheDocument();

    // Click Developers Group to select a second destination
    fireEvent.click(screen.getByText("Developers Group"));
    expect(screen.getByText("2 conversations selected")).toBeInTheDocument();
    expect(screen.getByText("Send to 2")).toBeInTheDocument();

    // Click Send
    fireEvent.click(screen.getByText("Send to 2"));
    expect(onConfirmForward).toHaveBeenCalledWith(["c1", "c3"]);
    console.log("TRACE [ForwardMessageModal.test.jsx]: Verified multi-select forward invoked with ['c1', 'c3']");
  });

  it("triggers onClose when close button is clicked", () => {
    console.log("TRACE [ForwardMessageModal.test.jsx]: Testing close button");
    const onClose = vi.fn();
    render(
      <ForwardMessageModal
        isOpen={true}
        chats={sampleChats}
        selectedMessageCount={1}
        onConfirmForward={vi.fn()}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
    console.log("TRACE [ForwardMessageModal.test.jsx]: Close button verified");
  });
});
