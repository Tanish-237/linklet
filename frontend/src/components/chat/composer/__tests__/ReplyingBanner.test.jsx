import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ReplyingBanner from "../ReplyingBanner";

describe("ReplyingBanner Component", () => {
  it("returns null and does not render when replyingTo is null or undefined", () => {
    console.log("TRACE [ReplyingBanner.test.jsx]: Testing null replyingTo state");
    const { container } = render(
      <ReplyingBanner replyingTo={null} onCancelReply={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
    console.log("TRACE [ReplyingBanner.test.jsx]: Null state verified");
  });

  it("renders sender name, message content, and cancel button properly", () => {
    console.log("TRACE [ReplyingBanner.test.jsx]: Testing valid replyingTo banner rendering");
    const replyingTo = {
      _id: "msg123",
      content: "Hello from Angel",
      sender: { fullName: "Angel", username: "angel_star" }
    };
    const onCancelReply = vi.fn();

    render(
      <ReplyingBanner replyingTo={replyingTo} onCancelReply={onCancelReply} />
    );

    const senderElement = screen.getByText("Angel");
    expect(senderElement).toBeInTheDocument();
    expect(senderElement.className).toContain("reply-preview-sender");

    const textElement = screen.getByText("Hello from Angel");
    expect(textElement).toBeInTheDocument();
    expect(textElement.className).toContain("reply-preview-text");

    const closeBtn = screen.getByLabelText("Cancel reply");
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(onCancelReply).toHaveBeenCalledTimes(1);
    console.log("TRACE [ReplyingBanner.test.jsx]: Valid banner and cancel interaction verified");
  });

  it("handles fallback to username or mediaType when fullName or content is missing", () => {
    console.log("TRACE [ReplyingBanner.test.jsx]: Testing fallback sender and media preview");
    const replyingTo = {
      _id: "msg456",
      mediaType: "image",
      sender: { username: "johndoe" }
    };

    render(
      <ReplyingBanner replyingTo={replyingTo} onCancelReply={vi.fn()} />
    );

    expect(screen.getByText("johndoe")).toBeInTheDocument();
    expect(screen.getByText("[image]")).toBeInTheDocument();
    console.log("TRACE [ReplyingBanner.test.jsx]: Fallbacks verified successfully");
  });
});
