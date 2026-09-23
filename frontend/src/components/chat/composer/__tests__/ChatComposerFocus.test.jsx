import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatComposer from "../ChatComposer";

const props = (over = {}) => ({
  newMessage: "hello",
  setNewMessage: vi.fn(),
  selectedFiles: [],
  filePreviews: [],
  replyingTo: null,
  editingMessage: null,
  isRecordingAudio: false,
  recordingSeconds: 0,
  isEmojiPickerOpen: false,
  setIsEmojiPickerOpen: vi.fn(),
  isSending: false,
  onSendMessage: vi.fn((e) => e.preventDefault()),
  onFileSelect: vi.fn(),
  onRemoveFile: vi.fn(),
  onCancelReply: vi.fn(),
  onCancelEdit: vi.fn(),
  onTyping: vi.fn(),
  onStartRecordAudio: vi.fn(),
  onCancelRecordAudio: vi.fn(),
  onStopAndSendAudio: vi.fn(),
  ...over,
});

describe("ChatComposer keeps the keyboard up", () => {
  it("pressing Send doesn't take focus away from the text box", () => {
    render(<ChatComposer {...props()} />);
    const send = screen.getByTitle("Send message");
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    send.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });

  it("returns focus to the text box after sending if it had it", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    const p = props();
    const { rerender } = render(<ChatComposer {...p} />);
    const input = screen.getByPlaceholderText("Type a message...");
    input.focus();
    fireEvent.submit(input.closest("form"));
    expect(p.onSendMessage).toHaveBeenCalled();
    // Message cleared: the send button is swapped for the mic button
    rerender(<ChatComposer {...p} newMessage="" />);
    input.blur();
    await act(async () => vi.advanceTimersToNextFrame());
    expect(document.activeElement).toBe(input);
    vi.useRealTimers();
  });

  it("starting a reply puts the cursor in the text box", () => {
    const { rerender } = render(<ChatComposer {...props({ newMessage: "" })} />);
    const input = screen.getByPlaceholderText("Type a message...");
    expect(document.activeElement).not.toBe(input);
    rerender(<ChatComposer {...props({ newMessage: "", replyingTo: { _id: "m1", content: "hi", sender: { username: "bob" } } })} />);
    expect(document.activeElement).toBe(input);
  });
});
