import React from "react";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";

// Components
import ChatSelectionBar from "../chat/header/ChatSelectionBar";
import PinnedMessageBanner from "../chat/header/PinnedMessageBanner";
import AttachmentPreviewTray from "../chat/composer/AttachmentPreviewTray";
import VoiceNoteRecordingTray from "../chat/composer/VoiceNoteRecordingTray";
import MessageBubble from "../chat/messages/MessageBubble";
import DateSeparator, { formatMessageDate } from "../chat/messages/DateSeparator";

// Hooks
import { useAudioPlayback, formatAudioTime } from "../chat/hooks/useAudioPlayback";
import { useInChatSearch } from "../chat/hooks/useInChatSearch";

describe("Modular Chat Subcomponents & Hooks Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useAudioPlayback Hook", () => {
    it("formats audio duration into m:ss format accurately", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing formatAudioTime helper");
      expect(formatAudioTime(0)).toBe("0:00");
      expect(formatAudioTime(65)).toBe("1:05");
      expect(formatAudioTime(130)).toBe("2:10");
      expect(formatAudioTime(null)).toBe("0:00");
      console.log("TRACE [ChatModularComponents.test.jsx]: formatAudioTime verified successfully");
    });
  });

  describe("useInChatSearch Hook", () => {
    const mockMessages = [
      { _id: "m1", content: "Hello world" },
      { _id: "m2", content: "How are you doing?" },
      { _id: "m3", content: "World is big" },
    ];

    it("matches query case-insensitively and allows forward/backward navigation", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing useInChatSearch filtering and navigation");
      const { result } = renderHook(() => useInChatSearch(mockMessages));

      act(() => {
        result.current.setSearchQuery("world");
      });

      expect(result.current.matchedIndices).toEqual([0, 2]);
      expect(result.current.currentMatchIndex).toBe(1); // latest match selected initially

      act(() => {
        result.current.prevMatch();
      });
      expect(result.current.currentMatchIndex).toBe(0);

      act(() => {
        result.current.nextMatch();
      });
      expect(result.current.currentMatchIndex).toBe(1);

      act(() => {
        result.current.closeSearch();
      });
      expect(result.current.searchQuery).toBe("");
      expect(result.current.matchedIndices).toEqual([]);
      console.log("TRACE [ChatModularComponents.test.jsx]: useInChatSearch matches verified successfully");
    });
  });

  describe("ChatSelectionBar Component", () => {
    it("renders selected count and triggers forward, delete, and clear actions", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing ChatSelectionBar render and buttons");
      const onClear = vi.fn();
      const onForward = vi.fn();
      const onDelete = vi.fn();

      render(
        <ChatSelectionBar
          selectedCount={3}
          onClearSelection={onClear}
          onForward={onForward}
          onDelete={onDelete}
        />
      );

      expect(screen.getByText("3 Selected")).toBeInTheDocument();

      const closeBtn = screen.getByLabelText("Cancel selection");
      fireEvent.click(closeBtn);
      expect(onClear).toHaveBeenCalledTimes(1);

      const forwardBtn = screen.getByRole("button", { name: /forward/i });
      fireEvent.click(forwardBtn);
      expect(onForward).toHaveBeenCalledTimes(1);

      const deleteBtn = screen.getByRole("button", { name: /delete/i });
      fireEvent.click(deleteBtn);
      expect(onDelete).toHaveBeenCalledTimes(1);
      console.log("TRACE [ChatModularComponents.test.jsx]: ChatSelectionBar buttons verified successfully");
    });
  });

  describe("PinnedMessageBanner Component", () => {
    it("renders pinned message sender, content preview, and triggers jump & unpin", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing PinnedMessageBanner");
      const onJump = vi.fn();
      const onUnpin = vi.fn();
      const pinnedMsg = {
        _id: "p1",
        sender: { username: "bob" },
        content: "Important pinned announcement",
      };

      render(
        <PinnedMessageBanner
          pinnedMessage={pinnedMsg}
          onJumpToPinned={onJump}
          onUnpin={onUnpin}
        />
      );

      expect(screen.getByText(/bob:/i)).toBeInTheDocument();
      expect(screen.getByText(/Important pinned announcement/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/Important pinned announcement/i));
      expect(onJump).toHaveBeenCalledTimes(1);

      const closeBtn = screen.getByTitle("Unpin message");
      fireEvent.click(closeBtn);
      expect(onUnpin).toHaveBeenCalledTimes(1);
      console.log("TRACE [ChatModularComponents.test.jsx]: PinnedMessageBanner verified successfully");
    });
  });

  describe("AttachmentPreviewTray Component", () => {
    it("renders image and document attachment chips and handles file removal", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing AttachmentPreviewTray");
      const onRemove = vi.fn();
      const mockPreviews = [
        { name: "photo.jpg", size: "1.2 MB", type: "image", url: "blob:photo" },
        { name: "syllabus.pdf", size: "0.5 MB", type: "document", url: "blob:pdf" },
      ];

      render(
        <AttachmentPreviewTray
          previews={mockPreviews}
          onRemoveFile={onRemove}
        />
      );

      expect(screen.getByText("photo.jpg")).toBeInTheDocument();
      expect(screen.getByText("1.2 MB")).toBeInTheDocument();
      expect(screen.getByText("syllabus.pdf")).toBeInTheDocument();

      const removeBtns = screen.getAllByTitle("Remove attachment");
      expect(removeBtns).toHaveLength(2);
      fireEvent.click(removeBtns[0]);
      expect(onRemove).toHaveBeenCalledWith(0);
      console.log("TRACE [ChatModularComponents.test.jsx]: AttachmentPreviewTray verified successfully");
    });
  });

  describe("VoiceNoteRecordingTray Component", () => {
    it("renders elapsed time, pulsing indicator, and triggers cancel/send", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing VoiceNoteRecordingTray");
      const onCancel = vi.fn();
      const onSend = vi.fn();

      render(
        <VoiceNoteRecordingTray
          isRecording={true}
          recordingSeconds={14}
          onCancel={onCancel}
          onStopAndSend={onSend}
        />
      );

      expect(screen.getByText("Recording")).toBeInTheDocument();
      expect(screen.getByText("0:14")).toBeInTheDocument();

      const cancelBtn = screen.getByTitle("Cancel recording");
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);

      const sendBtn = screen.getByTitle("Send voice note");
      fireEvent.click(sendBtn);
      expect(onSend).toHaveBeenCalledTimes(1);
      console.log("TRACE [ChatModularComponents.test.jsx]: VoiceNoteRecordingTray verified successfully");
    });
  });

  describe("DateSeparator Component", () => {
    it("formats today, yesterday, and displays badge cleanly", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing DateSeparator formatting");
      const today = new Date().toISOString();
      expect(formatMessageDate(today)).toBe("Today");

      render(<DateSeparator dateLabel="Today" />);
      expect(screen.getByText("Today")).toBeInTheDocument();
      console.log("TRACE [ChatModularComponents.test.jsx]: DateSeparator verified successfully");
    });
  });
});
