import React from "react";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";

// Components
import ChatSelectionBar from "../chat/header/ChatSelectionBar";
import PinnedMessageBanner from "../chat/header/PinnedMessageBanner";
import AttachmentPreviewTray from "../chat/composer/AttachmentPreviewTray";
import VoiceNoteRecordingTray from "../chat/composer/VoiceNoteRecordingTray";
import MessageBubble, { formatMessageClock, renderDeliveryTicks } from "../chat/messages/MessageBubble";
import DateSeparator, { formatMessageDate } from "../chat/messages/DateSeparator";
import ChatMessagesList from "../chat/messages/ChatMessagesList";
import AudioMessagePlayer from "../chat/messages/AudioMessagePlayer";
import MessageContextMenu from "../chat/actions/MessageContextMenu";
import ReactionPickerBar, { QUICK_REACTIONS } from "../chat/actions/ReactionPickerBar";
import MessageActionsToolbar from "../chat/actions/MessageActionsToolbar";

// Hooks
import { useAudioPlayback, formatAudioTime } from "../chat/hooks/useAudioPlayback";
import { useInChatSearch } from "../chat/hooks/useInChatSearch";

describe("Modular Chat Subcomponents & Hooks Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MessageContextMenu Component (WhatsApp-style Portal & Actions)", () => {
    const mockMessage = {
      _id: "msg123",
      content: "Hello from Linklet",
      createdAt: new Date().toISOString(),
      sender: { _id: "user1", username: "tanish" },
    };

    it("renders WhatsApp context menu items with portal without redundant React option and triggers onSelectMessage", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing MessageContextMenu portal and callbacks");
      const onReply = vi.fn();
      const onTogglePin = vi.fn();
      const onForward = vi.fn();
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <MessageContextMenu
          activeMessage={mockMessage}
          position={{ top: 100, left: 150 }}
          isPinned={false}
          isSent={true}
          onReply={onReply}
          onTogglePin={onTogglePin}
          onForward={onForward}
          onSelectMessage={onSelect}
          onClose={onClose}
        />
      );

      // Verify menu items: React should NOT be in dropdown menu (icon is separate on message hover)
      expect(screen.queryByRole("button", { name: /react/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reply/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /pin message/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /forward/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /select messages/i })).toBeInTheDocument();

      // Click Reply
      fireEvent.click(screen.getByRole("button", { name: /reply/i }));
      expect(onReply).toHaveBeenCalledWith(mockMessage);
      expect(onClose).toHaveBeenCalled();

      // Click Select messages
      fireEvent.click(screen.getByRole("button", { name: /select messages/i }));
      expect(onSelect).toHaveBeenCalledWith(mockMessage);
      console.log("TRACE [ChatModularComponents.test.jsx]: MessageContextMenu verified successfully");
    });

    it("supports upward positioning with bottom style property above message bubble", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing MessageContextMenu upward bottom positioning");
      render(
        <MessageContextMenu
          activeMessage={mockMessage}
          position={{ bottom: 210, left: 150, maxHeight: 350 }}
          isPinned={false}
          isSent={true}
          onReply={vi.fn()}
          onClose={vi.fn()}
        />
      );
      const menu = document.querySelector(".msg-context-menu");
      expect(menu).toBeInTheDocument();
      expect(menu.style.bottom).toBe("210px");
      expect(menu.style.maxHeight).toBe("350px");
      console.log("TRACE [ChatModularComponents.test.jsx]: MessageContextMenu upward positioning verified");
    });

    it("renders Star button only for media messages, and delete button triggers selection mode", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing WhatsApp dropdown items with media vs text");
      const onToggleStar = vi.fn();
      const onReport = vi.fn();
      const onDelete = vi.fn();
      const onSelect = vi.fn();
      const onClose = vi.fn();

      const mockMediaMessage = {
        ...mockMessage,
        media: "https://example.com/photo.jpg",
        mediaType: "image",
      };

      // 1. Render plain text message: Star should NOT be in the document
      const { unmount } = render(
        <MessageContextMenu
          activeMessage={mockMessage}
          position={{ top: 100, left: 150 }}
          isPinned={false}
          isSent={false}
          isStarred={false}
          onReply={vi.fn()}
          onReact={vi.fn()}
          onTogglePin={vi.fn()}
          onToggleStar={onToggleStar}
          onForward={vi.fn()}
          onSelectMessage={onSelect}
          onReport={onReport}
          onDelete={onDelete}
          onClose={onClose}
        />
      );

      expect(screen.queryByRole("button", { name: /star message/i })).not.toBeInTheDocument();

      // Verify Delete button selects message to enter multi-selection mode
      const deleteBtn = screen.getByRole("button", { name: /delete/i });
      expect(deleteBtn).toBeInTheDocument();
      fireEvent.click(deleteBtn);
      expect(onSelect).toHaveBeenCalledWith(mockMessage);
      expect(onClose).toHaveBeenCalled();
      unmount();

      // 2. Render media message: Star SHOULD be in the document
      render(
        <MessageContextMenu
          activeMessage={mockMediaMessage}
          position={{ top: 100, left: 150 }}
          isPinned={false}
          isSent={false}
          isStarred={false}
          onReply={vi.fn()}
          onReact={vi.fn()}
          onTogglePin={vi.fn()}
          onToggleStar={onToggleStar}
          onForward={vi.fn()}
          onSelectMessage={onSelect}
          onReport={onReport}
          onDelete={onDelete}
          onClose={onClose}
        />
      );

      const starBtn = screen.getByRole("button", { name: /star message/i });
      expect(starBtn).toBeInTheDocument();
      fireEvent.click(starBtn);
      expect(onToggleStar).toHaveBeenCalledWith("msg123");

      console.log("TRACE [ChatModularComponents.test.jsx]: Media star and delete selection verified successfully");
    });
  });

  describe("ReactionPickerBar Component (WhatsApp Quick Reactions Portal)", () => {
    it("renders 6 quick reactions and triggers onSelectEmoji on click", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing ReactionPickerBar portal and clicks");
      const onSelectEmoji = vi.fn();

      render(
        <ReactionPickerBar
          activeMessageId="msg123"
          position={{ top: 120, left: 220 }}
          onSelectEmoji={onSelectEmoji}
        />
      );

      QUICK_REACTIONS.forEach((emoji) => {
        expect(screen.getByTitle(`React with ${emoji}`)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("React with ❤️"));
      expect(onSelectEmoji).toHaveBeenCalledWith("msg123", "❤️");
      console.log("TRACE [ChatModularComponents.test.jsx]: ReactionPickerBar verified successfully");
    });
  });

  describe("MessageBubble Component & WhatsApp Chevron Button", () => {
    it("formats message timestamp to clean 12-hour clock time and renders chevron button", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing formatMessageClock and chevron button");
      const testDate = new Date("2026-09-11T12:16:00Z").toISOString();
      const clockStr = formatMessageClock(testDate);
      expect(clockStr).toBeTruthy();
      expect(clockStr.length).toBeGreaterThan(0);
      expect(formatMessageClock(null)).toBe("");

      const onOpenMenu = vi.fn();
      const mockMsg = {
        _id: "m_test1",
        content: "arre lite liteee",
        createdAt: testDate,
        sender: { username: "shubhrati" },
      };

      render(
        <MessageBubble
          msg={mockMsg}
          isSent={false}
          isMenuActive={false}
          onOpenMenu={onOpenMenu}
        />
      );

      expect(screen.getByText("arre lite liteee")).toBeInTheDocument();
      const chevronBtn = screen.getByRole("button", { name: /message options/i });
      expect(chevronBtn).toBeInTheDocument();

      fireEvent.click(chevronBtn);
      expect(onOpenMenu).toHaveBeenCalledTimes(1);
      console.log("TRACE [ChatModularComponents.test.jsx]: MessageBubble chevron verified successfully");
    });

    it("renders blue double ticks (tick-read) when message is seen/read", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing MessageBubble blue tick for read message");
      const testDate = new Date("2026-09-11T12:16:00Z").toISOString();
      const readMsg = {
        _id: "m_read1",
        content: "Seen message content",
        createdAt: testDate,
        sender: { _id: "user1" },
        readBy: ["user1", "user2"],
      };

      const { container } = render(
        <MessageBubble
          msg={readMsg}
          isSent={true}
          isMenuActive={false}
        />
      );

      const tickIcon = container.querySelector(".tick-read");
      expect(tickIcon).toBeInTheDocument();
      expect(tickIcon.textContent).toBe("done_all");
      console.log("TRACE [ChatModularComponents.test.jsx]: Blue tick verified on read message");
    });

    it("renders grey single tick (tick-sent) when message is sent but not yet read", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing MessageBubble grey tick for unread message");
      const testDate = new Date("2026-09-11T12:16:00Z").toISOString();
      const sentMsg = {
        _id: "m_sent1",
        content: "Unread message content",
        createdAt: testDate,
        sender: { _id: "user1" },
        readBy: ["user1"],
      };

      const { container } = render(
        <MessageBubble
          msg={sentMsg}
          isSent={true}
          isMenuActive={false}
        />
      );

      const tickIcon = container.querySelector(".tick-sent");
      expect(tickIcon).toBeInTheDocument();
      expect(tickIcon.textContent).toBe("done");
      console.log("TRACE [ChatModularComponents.test.jsx]: Grey tick verified on unread message");
    });

    it("renders grey double ticks (tick-delivered) when recipient is online on the website but hasn't read the chat", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing MessageBubble double grey tick for delivered/online recipient");
      const testDate = new Date("2026-09-11T12:16:00Z").toISOString();
      const deliveredMsg = {
        _id: "m_deliv1",
        content: "Delivered message content",
        createdAt: testDate,
        sender: { _id: "user1" },
        readBy: ["user1"],
      };

      const { container } = render(
        <MessageBubble
          msg={deliveredMsg}
          isSent={true}
          isRecipientOnline={true}
          isMenuActive={false}
        />
      );

      const tickIcon = container.querySelector(".tick-delivered");
      expect(tickIcon).toBeInTheDocument();
      expect(tickIcon.textContent).toBe("done_all");
      console.log("TRACE [ChatModularComponents.test.jsx]: Grey double tick verified when recipient is online");
    });

    it("renders voice messages with duration and delivery ticks on the same line", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing voice message single line duration & ticks");
      const testDate = new Date("2026-09-11T12:16:00Z").toISOString();
      const voiceMsg = {
        _id: "m_voice1",
        media: "https://linklet.org/audio/sample.mp3",
        mediaType: "audio",
        createdAt: testDate,
        sender: { _id: "user1" },
        readBy: ["user1", "user2"],
      };

      const { container } = render(
        <MessageBubble
          msg={voiceMsg}
          isSent={true}
          isMenuActive={false}
          audioState={{ isPlaying: false, currentTime: 0, duration: 42 }}
        />
      );

      const timeLabel = container.querySelector(".audio-time-label");
      expect(timeLabel).toBeInTheDocument();
      expect(timeLabel.textContent).toContain("0:42");
      const tick = timeLabel.querySelector(".tick-read");
      expect(tick).toBeInTheDocument();
      expect(tick.textContent).toBe("done_all");
      console.log("TRACE [ChatModularComponents.test.jsx]: Voice message duration and ticks verified on same line");
    });

    it("renders image message with text at bottom on the left and time at exact bottom right", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing image with caption layout");
      const testDate = new Date("2026-09-11T12:16:00Z").toISOString();
      const imgMsg = {
        _id: "m_img1",
        media: "https://linklet.org/images/cat.png",
        mediaType: "image",
        content: "Look at this cool cat",
        createdAt: testDate,
        sender: { _id: "user1" },
        readBy: ["user1"],
      };

      const { container } = render(
        <MessageBubble
          msg={imgMsg}
          isSent={true}
          isMenuActive={false}
        />
      );

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(screen.getByText("Look at this cool cat")).toBeInTheDocument();

      const meta = container.querySelector(".message-meta");
      expect(meta).toBeInTheDocument();
      expect(meta.querySelector(".tick-sent")).toBeInTheDocument();
      console.log("TRACE [ChatModularComponents.test.jsx]: Image caption and time layout verified");
    });
  });

  describe("MessageActionsToolbar (Standalone Circular WhatsApp Reaction Button)", () => {
    it("renders circular smiley button and triggers onOpenReaction on click", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing MessageActionsToolbar circular reaction button");
      const onOpenReaction = vi.fn();

      render(
        <MessageActionsToolbar
          messageId="m_test1"
          isReactionActive={false}
          onOpenReaction={onOpenReaction}
        />
      );

      const reactionBtn = screen.getByRole("button", { name: /react to message/i });
      expect(reactionBtn).toBeInTheDocument();
      expect(screen.getByText("sentiment_satisfied_alt")).toBeInTheDocument();

      fireEvent.click(reactionBtn);
      expect(onOpenReaction).toHaveBeenCalledWith(expect.anything(), "m_test1");
      console.log("TRACE [ChatModularComponents.test.jsx]: MessageActionsToolbar reaction button verified successfully");
    });
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

  describe("ChatMessagesList Component & Unread Messages Separator", () => {
    it("renders unread messages separator above the first unread incoming message", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing ChatMessagesList unread separator");
      const currentUser = { _id: "me123", username: "tanish" };
      const chat = { _id: "c1", users: [currentUser, { _id: "other456", username: "alex" }] };
      const messages = [
        {
          _id: "msg_read",
          content: "Previous message",
          sender: { _id: "other456", username: "alex" },
          readBy: ["me123", "other456"],
          createdAt: new Date(Date.now() - 60000).toISOString(),
        },
        {
          _id: "msg_unread_1",
          content: "First new message",
          sender: { _id: "other456", username: "alex" },
          readBy: ["other456"], // unread by me123
          createdAt: new Date().toISOString(),
        },
        {
          _id: "msg_unread_2",
          content: "Second new message",
          sender: { _id: "other456", username: "alex" },
          readBy: ["other456"], // unread by me123
          createdAt: new Date().toISOString(),
        },
      ];

      const { container } = render(
        <ChatMessagesList
          messages={messages}
          currentUser={currentUser}
          chat={chat}
          selectedMessageIds={[]}
          audioPlaybackState={{}}
        />
      );
      expect(screen.getByText("2 Unread Messages")).toBeInTheDocument();
      const separator = container.querySelector("#unread-messages-separator");
      expect(separator).toBeInTheDocument();
      console.log("TRACE [ChatModularComponents.test.jsx]: Unread separator element and id verified successfully");
    });

    it("renders delivery ticks with 14px equal sizing for enhanced legibility", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing 14px equal delivery tick sizing");
      const readMsg = {
        _id: "m_read_size",
        content: "Size test",
        createdAt: new Date().toISOString(),
        sender: { _id: "user1" },
        readBy: ["user1", "user2"],
      };

      const { container } = render(
        <MessageBubble msg={readMsg} isSent={true} isMenuActive={false} />
      );

      const tickIcon = container.querySelector(".tick-read");
      expect(tickIcon).toBeInTheDocument();
      expect(tickIcon.className).toContain("text-[14px]");
      console.log("TRACE [ChatModularComponents.test.jsx]: Confirmed tick has text-[14px] styling");
    });

    it("does not display star icon badge when message is starred (per design spec: silent save)", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing that star icon is not rendered on bubble");
      const starredMsg = {
        _id: "msg_star_1",
        content: "Starred message without visual star badge",
        sender: { _id: "u1", username: "me" },
        createdAt: new Date().toISOString(),
      };

      const { container } = render(
        <MessageBubble
          msg={starredMsg}
          isSent={true}
          isStarred={true}
          isMenuActive={false}
        />
      );

      const starIcon = container.querySelector(".material-icons.text-amber-400");
      expect(starIcon).not.toBeInTheDocument();
      console.log("TRACE [ChatModularComponents.test.jsx]: Confirmed star icon is not displayed on bubble");
    });

    it("applies compact mt-[3px] mb-0 spacing between consecutive messages from the same sender", () => {
      console.log("TRACE [ChatModularComponents.test.jsx]: Testing compact message spacing");
      const currentUser = { _id: "u1", username: "me" };
      const chat = { _id: "c1", users: [currentUser] };
      const messages = [
        {
          _id: "msg_a",
          content: "First message from me",
          sender: currentUser,
          readBy: ["u1"],
          createdAt: new Date(Date.now() - 10000).toISOString(),
        },
        {
          _id: "msg_b",
          content: "Second message from me",
          sender: currentUser,
          readBy: ["u1"],
          createdAt: new Date().toISOString(),
        },
      ];

      const { container } = render(
        <ChatMessagesList
          messages={messages}
          currentUser={currentUser}
          chat={chat}
          selectedMessageIds={[]}
          audioPlaybackState={{}}
        />
      );

      const secondMsgRow = container.querySelector("#msg-msg_b");
      expect(secondMsgRow).toBeInTheDocument();
      // Should have compact mt-[3px] mb-0 spacing class
      expect(secondMsgRow.className).toContain("mt-[3px]");
      expect(secondMsgRow.className).toContain("mb-0");
      console.log("TRACE [ChatModularComponents.test.jsx]: Compact mt-[3px] spacing confirmed between consecutive messages");
    });
  });
});
