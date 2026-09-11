import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatComposer from "../ChatComposer";

describe("ChatComposer Attachments and Voice Recording Tests", () => {
  const defaultProps = {
    newMessage: "",
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
    onSendMessage: vi.fn(),
    onFileSelect: vi.fn(),
    onRemoveFile: vi.fn(),
    onCancelReply: vi.fn(),
    onCancelEdit: vi.fn(),
    onTyping: vi.fn(),
    onStartRecordAudio: vi.fn(),
    onCancelRecordAudio: vi.fn(),
    onStopAndSendAudio: vi.fn(),
  };

  it("renders attachment previews tray when filePreviews are present and triggers remove", () => {
    console.log("TRACE [ChatComposerAttachments.test.jsx]: Testing attachment preview rendering in composer");
    const onRemoveFile = vi.fn();
    const previews = [
      {
        url: "blob:http://localhost/image1",
        name: "test-diagram.png",
        type: "image",
        size: "1.2 MB",
      },
      {
        url: "blob:http://localhost/doc1",
        name: "project-notes.pdf",
        type: "document",
        size: "0.5 MB",
      },
    ];

    render(
      <ChatComposer
        {...defaultProps}
        selectedFiles={[{ name: "test-diagram.png" }, { name: "project-notes.pdf" }]}
        filePreviews={previews}
        onRemoveFile={onRemoveFile}
      />
    );

    // Both attachments should be visible
    expect(screen.getByText("test-diagram.png")).toBeInTheDocument();
    expect(screen.getByText("project-notes.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.2 MB")).toBeInTheDocument();

    // Click remove on the first attachment
    const removeButtons = screen.getAllByTitle("Remove attachment");
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]);

    expect(onRemoveFile).toHaveBeenCalledWith(0);
    console.log("TRACE [ChatComposerAttachments.test.jsx]: Attachment preview rendering verified successfully");
  });

  it("renders voice note recording tray without disappearing when isRecordingAudio is true", () => {
    console.log("TRACE [ChatComposerAttachments.test.jsx]: Testing voice recording tray rendering");
    const onCancelRecordAudio = vi.fn();
    const onStopAndSendAudio = vi.fn();

    render(
      <ChatComposer
        {...defaultProps}
        isRecordingAudio={true}
        recordingSeconds={42}
        onCancelRecordAudio={onCancelRecordAudio}
        onStopAndSendAudio={onStopAndSendAudio}
      />
    );

    // Recording label and timer should be clearly visible in bottom area
    expect(screen.getByText("Recording")).toBeInTheDocument();
    expect(screen.getByText("0:42")).toBeInTheDocument();

    // Cancel and Send buttons should exist and be clickable
    const cancelBtn = screen.getByTitle("Cancel recording");
    const sendBtn = screen.getByTitle("Send voice note");
    expect(cancelBtn).toBeInTheDocument();
    expect(sendBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);
    expect(onCancelRecordAudio).toHaveBeenCalledTimes(1);

    fireEvent.click(sendBtn);
    expect(onStopAndSendAudio).toHaveBeenCalledTimes(1);
    console.log("TRACE [ChatComposerAttachments.test.jsx]: Voice recording tray stability verified successfully");
  });
});
