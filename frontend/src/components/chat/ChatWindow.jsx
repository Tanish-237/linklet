import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { apiClient } from "../../api/apiClient";

// Chat Subcomponents
import ChatHeader from "./header/ChatHeader";
import ChatSelectionBar from "./header/ChatSelectionBar";
import PinnedMessageBanner from "./header/PinnedMessageBanner";
import InChatSearchBar from "./search/InChatSearchBar";
import ChatMessagesList from "./messages/ChatMessagesList";
import ChatComposer from "./composer/ChatComposer";
import MessageContextMenu from "./actions/MessageContextMenu";
import ReactionPickerBar from "./actions/ReactionPickerBar";
import ScrollToBottomButton from "./controls/ScrollToBottomButton";
import MediaLightboxModal from "./modals/MediaLightboxModal";
import ConfirmDeleteModal from "../ConfirmDeleteModal";
import ForwardMessageModal from "../ForwardMessageModal";

// Custom Hooks
import { useChatMessages } from "./hooks/useChatMessages";
import { useVoiceRecorder } from "./hooks/useVoiceRecorder";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { useInChatSearch } from "./hooks/useInChatSearch";

const ChatWindow = ({
  chat,
  currentUser,
  socket,
  onlineUsers = [],
  lastSeenMap = {},
  onToggleInfo,
  onBackToSidebar,
  onUpdateLastMessage,
  allChats = [],
  isBlocked = false,
  highlightMessageId = null,
  onClearHighlight,
}) => {
  // Messages & Socket lifecycle hook
  const {
    messages,
    setMessages,
    loadingInitial,
    loadingOlder,
    hasMore,
    typingUsers,
    loadOlderMessages,
    emitTypingActivity,
    emitStopTypingImmediate,
    toggleReaction,
    togglePin,
    deleteMessage,
    bulkDeleteMessages,
  } = useChatMessages({
    chat,
    currentUser,
    socket,
    onUpdateLastMessage,
  });

  // In-Chat Search hook
  const {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    matchedIndices,
    currentMatchIndex,
    nextMatch,
    prevMatch,
    closeSearch,
  } = useInChatSearch(messages);

  // Audio Playback hook
  const { audioPlaybackState, toggleAudioPlay, seekAudio } = useAudioPlayback();

  // Composer and selections state
  const [newMessage, setNewMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // Floating Context Menu & Reaction picker state
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [reactionPosition, setReactionPosition] = useState({ top: 0, left: 0 });

  // Multi-selection & Modals state
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [reportingMessage, setReportingMessage] = useState(null);
  const [starredMessageIds, setStarredMessageIds] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem(
          `linklet_starred_msgs_${currentUser?._id}`
        );
        return saved ? JSON.parse(saved) : [];
      }
    } catch {
      return [];
    }
    return [];
  });

  // Scroll to bottom & unread badge state
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [scrolledUnreadCount, setScrolledUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const initialScrollDoneChatIdRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const prevLastMsgIdRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    const handleWindowClick = () => {
      setActiveMenuMessageId(null);
      setActiveReactionMessageId(null);
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  // Clean up object URLs on unmount or preview changes
  useEffect(() => {
    return () => {
      filePreviews.forEach((f) => {
        if (f.url) URL.revokeObjectURL(f.url);
      });
    };
  }, [filePreviews]);

  // Audio voice note recording handler
  const handleSendAudioFile = useCallback(
    async (audioFile) => {
      if (!audioFile || !chat?._id) return;
      setIsSending(true);

      const optimisticId = `opt_${Date.now()}`;
      const optimisticAudioMsg = {
        _id: optimisticId,
        sender: currentUser,
        chat: chat._id,
        content: "",
        media: URL.createObjectURL(audioFile),
        mediaType: "audio",
        createdAt: new Date().toISOString(),
        status: "sent",
        readBy: [currentUser?._id],
      };

      setMessages((prev) => [...prev, optimisticAudioMsg]);

      try {
        const formData = new FormData();
        formData.append("chatId", chat._id);
        formData.append("media", audioFile);
        formData.append("file", audioFile);
        formData.append("mediaType", "audio");

        const res = await apiClient.post("/chat/message", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (res.data.success) {
          const confirmed = Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;
          setMessages((prev) =>
            prev.map((m) => (m._id === optimisticId ? confirmed : m))
          );
          // The server broadcasts "message received" to the chat room and every
          // participant's personal room right after persisting the message — the
          // client no longer relays this itself (see backend socket.js notifyNewMessage).
          if (onUpdateLastMessage) onUpdateLastMessage(chat._id, confirmed);
        }
      } catch (error) {
        console.error("Failed to send voice note:", error.response?.data || error.message);
        toast.error(error.response?.data?.message || "Failed to send voice note");
        setMessages((prev) =>
          prev.map((m) => (m._id === optimisticId ? { ...m, status: "failed" } : m))
        );
      } finally {
        setIsSending(false);
      }
    },
    [chat?._id, currentUser, setMessages, socket, onUpdateLastMessage]
  );

  const {
    isRecordingAudio,
    recordingSeconds,
    startRecordingAudio,
    stopAndSendAudio,
    cancelRecordingAudio,
  } = useVoiceRecorder(handleSendAudioFile);

  // Scroll listener: dismiss menus, show scroll-to-bottom button, infinite scroll
  const handleMessagesScroll = useCallback(
    (e) => {
      const container = e.currentTarget;
      if (!container) return;

      if (activeMenuMessageId || activeReactionMessageId) {
        setActiveMenuMessageId(null);
        setActiveReactionMessageId(null);
      }

      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const isScrolledUp = distanceFromBottom > 180;
      setShowScrollBottom(isScrolledUp);

      if (!isScrolledUp) {
        setScrolledUnreadCount(0);
      }

      if (container.scrollTop <= 40 && hasMore && !loadingOlder) {
        loadOlderMessages(container);
      }
    },
    [activeMenuMessageId, activeReactionMessageId, hasMore, loadingOlder, loadOlderMessages]
  );

  const scrollToBottom = useCallback((behavior = "smooth") => {
    const container = chatContainerRef.current;
    if (container) {
      if (behavior === "auto") {
        container.style.scrollBehavior = "auto";
        container.scrollTop = container.scrollHeight;
      } else {
        container.style.scrollBehavior = "smooth";
        container.scrollTop = container.scrollHeight;
        setTimeout(() => {
          if (container) container.style.scrollBehavior = "auto";
        }, 400);
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
    setShowScrollBottom(false);
    setScrolledUnreadCount(0);
  }, []);

  // Reset scroll anchoring tracking whenever active chat changes
  useEffect(() => {
    initialScrollDoneChatIdRef.current = null;
    prevMessagesLengthRef.current = 0;
    prevLastMsgIdRef.current = null;
  }, [chat?._id]);

  // WhatsApp-grade instant scroll anchoring on opening a chat (zero up-to-down animation)
  useLayoutEffect(() => {
    if (!chat?._id || messages.length === 0) return;
    if (initialScrollDoneChatIdRef.current === chat._id) return;

    const container = chatContainerRef.current;
    if (!container) return;

    const anchorPosition = () => {
      if (!container) return;

      // If a specific target message is requested (e.g. from Saved starred media)
      if (highlightMessageId) {
        const targetElem = document.getElementById(`msg-${highlightMessageId}`);
        if (targetElem) {
          targetElem.scrollIntoView({ behavior: "auto", block: "center" });
          targetElem.classList.add("highlight-target-msg");
          setTimeout(() => targetElem.classList.remove("highlight-target-msg"), 2500);
          initialScrollDoneChatIdRef.current = chat._id;
          prevMessagesLengthRef.current = messages.length;
          prevLastMsgIdRef.current = messages[messages.length - 1]?._id;
          if (onClearHighlight) onClearHighlight();
          return;
        }
      }

      // Identify first unread message from another user
      const firstUnread = messages.find((m) => {
        const isSentByMe =
          (m.sender?._id || m.sender)?.toString() ===
          currentUser?._id?.toString();
        if (isSentByMe) return false;
        const isReadByMe = m.readBy?.some(
          (u) => (u._id || u)?.toString() === currentUser?._id?.toString()
        );
        return !isReadByMe;
      });

      // Force instant positioning without smooth scrolling
      container.style.scrollBehavior = "auto";

      if (firstUnread) {
        const unreadElem =
          document.getElementById("unread-messages-separator") ||
          document.getElementById(`msg-${firstUnread._id}`);

        if (unreadElem) {
          const containerRect = container.getBoundingClientRect();
          const unreadRect = unreadElem.getBoundingClientRect();
          const targetTop =
            unreadRect.top - containerRect.top + container.scrollTop - 20;
          container.scrollTop = Math.max(0, targetTop);
          initialScrollDoneChatIdRef.current = chat._id;
          prevMessagesLengthRef.current = messages.length;
          prevLastMsgIdRef.current = messages[messages.length - 1]?._id;
          return;
        }
      }

      // If all read: instantly show most recent messages at bottom
      container.scrollTop = container.scrollHeight;
      initialScrollDoneChatIdRef.current = chat._id;
      prevMessagesLengthRef.current = messages.length;
      prevLastMsgIdRef.current = messages[messages.length - 1]?._id;
    };

    anchorPosition();
    const rafId = requestAnimationFrame(anchorPosition);
    return () => cancelAnimationFrame(rafId);
  }, [chat?._id, messages, currentUser?._id, highlightMessageId]);

  // Secondary effect to jump and highlight if messages loaded asynchronously
  useEffect(() => {
    if (!highlightMessageId || loadingInitial || messages.length === 0) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`msg-${highlightMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-target-msg");
        setTimeout(() => el.classList.remove("highlight-target-msg"), 2500);
        if (onClearHighlight) onClearHighlight();
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [highlightMessageId, loadingInitial, messages.length, onClearHighlight]);

  // Real-time scroll handler for newly arriving or sent messages
  useEffect(() => {
    if (!chat?._id || messages.length === 0) return;

    // Baseline initialization: do not treat initial message load as new append
    if (prevMessagesLengthRef.current === 0) {
      prevMessagesLengthRef.current = messages.length;
      prevLastMsgIdRef.current = messages[messages.length - 1]?._id;
      return;
    }

    const lastMsg = messages[messages.length - 1];
    const isNewAppend =
      lastMsg &&
      lastMsg._id !== prevLastMsgIdRef.current &&
      messages.length > prevMessagesLengthRef.current;

    prevMessagesLengthRef.current = messages.length;
    prevLastMsgIdRef.current = lastMsg?._id;

    if (initialScrollDoneChatIdRef.current === chat._id && isNewAppend) {
      const isSentByMe =
        (lastMsg.sender?._id || lastMsg.sender)?.toString() ===
        currentUser?._id?.toString();

      if (isSentByMe) {
        scrollToBottom("smooth");
      } else {
        const container = chatContainerRef.current;
        if (container) {
          const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;
          if (distanceFromBottom <= 180) {
            scrollToBottom("smooth");
          } else {
            setScrolledUnreadCount((prev) => prev + 1);
          }
        }
      }
    }
  }, [messages, chat?._id, currentUser?._id, scrollToBottom]);

  // Multi-selection handler
  const toggleSelectMessage = useCallback((messageId) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  }, []);

  // Viewport-clamped menu opener (anchored directly to chevron button like WhatsApp)
  const handleOpenMenu = useCallback(
    (e, msgId) => {
      e.stopPropagation();
      if (activeMenuMessageId === msgId) {
        setActiveMenuMessageId(null);
        return;
      }
      setActiveReactionMessageId(null);

      const rect = e.currentTarget?.getBoundingClientRect
        ? e.currentTarget.getBoundingClientRect()
        : { top: 150, bottom: 180, left: 200, right: 230, width: 28, height: 28 };

      const menuWidth = 190;
      const estimatedMenuHeight = 310;
      const viewportHeight = window.innerHeight || 800;
      const viewportWidth = window.innerWidth || 1200;

      const msg = messages.find((m) => m._id === msgId);
      const isSent =
        (msg?.sender?._id || msg?.sender)?.toString() ===
        currentUser?._id?.toString();

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // In WhatsApp Web, messages in the lower half of the screen or near composer always open UPWARDS
      const openUpward =
        spaceBelow < estimatedMenuHeight + 80 ||
        (rect.top > viewportHeight * 0.45 && spaceAbove > 240);

      // WhatsApp anchor: align left edge on received, align right edge on sent
      let left = isSent ? rect.right - menuWidth : rect.left;
      left = Math.max(12, Math.min(left, viewportWidth - menuWidth - 12));

      if (openUpward) {
        const bottom = Math.max(16, viewportHeight - rect.top + 6);
        const maxHeight = Math.max(200, rect.top - 80);
        setMenuPosition({ bottom, left, maxHeight });
      } else {
        const top = Math.max(76, rect.bottom + 6);
        const maxHeight = Math.max(200, viewportHeight - top - 16);
        setMenuPosition({ top, left, maxHeight });
      }

      setActiveMenuMessageId(msgId);
    },
    [activeMenuMessageId, messages, currentUser]
  );

  // Viewport-clamped reaction picker opener
  const handleOpenReaction = useCallback(
    (e, msgId) => {
      e.stopPropagation();
      if (activeReactionMessageId === msgId) {
        setActiveReactionMessageId(null);
        return;
      }
      setActiveMenuMessageId(null);

      const rect = e.currentTarget?.getBoundingClientRect
        ? e.currentTarget.getBoundingClientRect()
        : { top: 150, bottom: 180, left: 200, right: 230, width: 28, height: 28 };

      const pickerWidth = 245;
      const pickerHeight = 44;
      const viewportHeight = window.innerHeight || 800;
      const viewportWidth = window.innerWidth || 1200;

      const openAbove = rect.top >= 72 + pickerHeight + 8;
      let top = openAbove ? rect.top - pickerHeight - 8 : rect.bottom + 8;
      top = Math.max(72, Math.min(top, viewportHeight - pickerHeight - 16));

      let left = rect.left - pickerWidth / 2 + (rect.width || 28) / 2;
      left = Math.max(12, Math.min(left, viewportWidth - pickerWidth - 12));

      setReactionPosition({ top, left });
      setActiveReactionMessageId(msgId);
    },
    [activeReactionMessageId]
  );


  // WhatsApp-style multi-selection trigger from context menu
  const handleSelectMessageFromMenu = useCallback((msg) => {
    if (!msg) return;
    setSelectedMessageIds([msg._id]);
  }, []);

  // File selection & preview generation
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const newPreviews = files.map((file) => {
      const isImg = file.type.startsWith("image/");
      const isVid = file.type.startsWith("video/");
      const isAud = file.type.startsWith("audio/");
      return {
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        type: isImg ? "image" : isVid ? "video" : isAud ? "audio" : "document",
        size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
      };
    });

    setSelectedFiles((prev) => [...prev, ...files]);
    setFilePreviews((prev) => [...prev, ...newPreviews]);
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      const target = prev[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Send message or edit message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    emitStopTypingImmediate();
    setIsEmojiPickerOpen(false);

    // Edit message flow
    if (editingMessage) {
      try {
        const res = await apiClient.put(`/chat/message/${editingMessage._id}`, {
          content: newMessage.trim(),
        });
        if (res.data.success) {
          const updated = res.data.data;
          setMessages((prev) =>
            prev.map((m) => (m._id === editingMessage._id ? updated : m))
          );
          // Server broadcasts "message updated" after persisting the edit.
          setEditingMessage(null);
          setNewMessage("");
        }
      } catch {
        toast.error("Failed to edit message");
      }
      return;
    }

    // Send new message flow
    setIsSending(true);
    const tempContent = newMessage.trim();
    const tempReplyTo = replyingTo;
    const tempFiles = [...selectedFiles];

    setNewMessage("");
    setReplyingTo(null);
    setSelectedFiles([]);
    setFilePreviews([]);

    const optimisticId = `opt_${Date.now()}`;
    const optimisticMsg = {
      _id: optimisticId,
      sender: currentUser,
      chat: chat._id,
      content: tempContent,
      replyTo: tempReplyTo,
      createdAt: new Date().toISOString(),
      status: "sent",
      readBy: [currentUser?._id],
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      let res;
      if (tempFiles.length > 0) {
        const formData = new FormData();
        formData.append("chatId", chat._id);
        if (tempContent) formData.append("content", tempContent);
        if (tempReplyTo) formData.append("replyTo", tempReplyTo._id);
        tempFiles.forEach((file) => formData.append("media", file));
        res = await apiClient.post("/chat/message", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await apiClient.post("/chat/message", {
          chatId: chat._id,
          content: tempContent,
          replyTo: tempReplyTo ? tempReplyTo._id : undefined,
        });
      }

      if (res.data.success) {
        const confirmed = res.data.data;
        if (Array.isArray(confirmed)) {
          setMessages((prev) => [
            ...prev.filter((m) => m._id !== optimisticId),
            ...confirmed,
          ]);
          // Server broadcasts "message received" for each created message.
          if (onUpdateLastMessage && confirmed.length > 0) {
            onUpdateLastMessage(chat._id, confirmed[confirmed.length - 1]);
          }
        } else {
          setMessages((prev) =>
            prev.map((m) => (m._id === optimisticId ? confirmed : m))
          );
          // Server broadcasts "message received" after persisting the message.
          if (onUpdateLastMessage) onUpdateLastMessage(chat._id, confirmed);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error.response?.data || error.message);
      toast.error(error.response?.data?.message || "Failed to send message");
      setMessages((prev) =>
        prev.map((m) => (m._id === optimisticId ? { ...m, status: "failed" } : m))
      );
    } finally {
      setIsSending(false);
    }
  };

  // Forward message handler — supports multiple target chats (WhatsApp-style)
  const handleConfirmForward = async (targetChatIds) => {
    const targets = Array.isArray(targetChatIds) ? targetChatIds : [targetChatIds];
    if (targets.length === 0 || selectedMessageIds.length === 0) return;

    // Chronological order: Sort selectedMessageIds based on original messages' createdAt
    const sortedMessageIds = [...selectedMessageIds].sort((a, b) => {
      const msgA = messages.find((m) => m._id === a);
      const msgB = messages.find((m) => m._id === b);
      if (!msgA || !msgB) return 0;
      return new Date(msgA.createdAt).getTime() - new Date(msgB.createdAt).getTime();
    });

    try {
      let successCount = 0;
      for (const targetChatId of targets) {
        const res = await apiClient.post("/chat/message/forward", {
          messageIds: sortedMessageIds,
          targetChatId,
        });
        if (res.data.success) {
          successCount++;
          // Server broadcasts "message received" for each forwarded message.
        }
      }
      if (successCount > 0) {
        toast.success(
          `${sortedMessageIds.length} message${sortedMessageIds.length > 1 ? "s" : ""} forwarded to ${successCount} chat${successCount > 1 ? "s" : ""}`
        );
        setSelectedMessageIds([]);
        setIsForwardModalOpen(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to forward messages");
    }
  };

  // Derived variables for menus
  const activeMenuMessage = activeMenuMessageId
    ? messages.find((m) => m._id === activeMenuMessageId)
    : null;

  const activeMenuIsPinned =
    activeMenuMessage &&
    chat?.pinnedMessages?.some(
      (p) => (p._id || p).toString() === activeMenuMessage._id?.toString()
    );

  const activeMenuIsStarred = Boolean(
    activeMenuMessage && starredMessageIds.includes(activeMenuMessage._id)
  );

  const activeMenuIsSent =
    activeMenuMessage &&
    (activeMenuMessage.sender?._id || activeMenuMessage.sender)?.toString() ===
      currentUser?._id?.toString();

  const handleToggleStar = useCallback(
    (msgId) => {
      setStarredMessageIds((prev) => {
        const isStarred = prev.includes(msgId);
        const next = isStarred
          ? prev.filter((id) => id !== msgId)
          : [...prev, msgId];
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(
              `linklet_starred_msgs_${currentUser?._id}`,
              JSON.stringify(next)
            );

            // Sync starred chat media (only attachments, not plain messages) into saved section
            const msg = messages.find((m) => m._id === msgId);
            if (
              msg &&
              (msg.media ||
                ["image", "video", "document", "audio"].includes(msg.mediaType))
            ) {
              const savedMediaKey = `linklet_starred_chat_media_${currentUser?._id}`;
              const existingRaw = localStorage.getItem(savedMediaKey);
              const existingMedia = existingRaw ? JSON.parse(existingRaw) : [];
              let updatedMedia;
              if (isStarred) {
                // unstarring: remove
                updatedMedia = existingMedia.filter((item) => item._id !== msgId);
              } else {
                // starring: add attachment
                const otherUser = chat.isGroup
                  ? null
                  : chat.participants?.find(
                      (p) =>
                        (p._id || p)?.toString() !== currentUser?._id?.toString()
                    );
                const chatName = chat.isGroup
                  ? chat.chatName
                  : otherUser?.fullName || otherUser?.username || "Chat";
                const newItem = {
                  _id: msg._id,
                  chatId: chat._id,
                  chatName,
                  media: msg.media,
                  mediaType: msg.mediaType || "image",
                  content: msg.content || "",
                  sender: msg.sender,
                  createdAt: msg.createdAt,
                };
                updatedMedia = [
                  newItem,
                  ...existingMedia.filter((item) => item._id !== msgId),
                ];
              }
              localStorage.setItem(savedMediaKey, JSON.stringify(updatedMedia));
            }
          }
        } catch {}
        toast.success(isStarred ? "Message unstarred" : "Message starred");
        return next;
      });
    },
    [currentUser?._id, messages, chat]
  );

  const handleConfirmReport = useCallback(async () => {
    if (!reportingMessage) return;
    try {
      await apiClient.post("/chat/message/report", {
        messageId: reportingMessage._id,
        chatId: chat._id,
        senderId: reportingMessage.sender?._id || reportingMessage.sender,
        messageContent: reportingMessage.content || "",
        reason: "Reported by user",
      });
      toast.success("Message reported to moderators for review. Thank you.");
    } catch {
      toast.error("Failed to submit report. Please try again.");
    }
    setReportingMessage(null);
  }, [reportingMessage, chat._id]);

  const pinnedMessage = chat.pinnedMessages?.[chat.pinnedMessages.length - 1];

  return (
    <div className="chat-window relative fixed inset-0 z-40 md:relative md:inset-auto md:z-auto bg-gray-950 flex flex-col h-full h-[100dvh] md:h-full">
      {/* Header: Multi-Selection Bar OR Normal Header */}
      {selectedMessageIds.length > 0 ? (
        <ChatSelectionBar
          selectedCount={selectedMessageIds.length}
          onClearSelection={() => setSelectedMessageIds([])}
          onForward={() => setIsForwardModalOpen(true)}
          onDelete={() => setDeletingMessageId("BULK")}
        />
      ) : (
        <ChatHeader
          chat={chat}
          currentUser={currentUser}
          onlineUsers={onlineUsers}
          lastSeenMap={lastSeenMap}
          typingUsers={typingUsers}
          onToggleInfo={onToggleInfo}
          onBackToSidebar={onBackToSidebar}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        />
      )}

      {/* In-Chat Search Bar */}
      <InChatSearchBar
        isOpen={isSearchOpen}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        matchCount={matchedIndices.length}
        currentMatchIndex={currentMatchIndex}
        onNextMatch={nextMatch}
        onPrevMatch={prevMatch}
        onClose={closeSearch}
      />

      {/* Pinned Messages Banner */}
      <PinnedMessageBanner
        pinnedMessage={pinnedMessage}
        onJumpToPinned={() => {
          const el = document.getElementById(`msg-${pinnedMessage._id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        onUnpin={() => togglePin(pinnedMessage._id, true)}
      />

      {/* Messages Feed */}
      <ChatMessagesList
        messages={messages}
        currentUser={currentUser}
        chat={chat}
        onlineUsers={onlineUsers}
        loadingInitial={loadingInitial}
        loadingOlder={loadingOlder}
        hasMore={hasMore}
        onLoadOlder={loadOlderMessages}
        onScroll={handleMessagesScroll}
        chatContainerRef={chatContainerRef}
        messagesEndRef={messagesEndRef}
        selectedMessageIds={selectedMessageIds}
        starredMessageIds={starredMessageIds}
        activeMenuMessageId={activeMenuMessageId}
        activeReactionMessageId={activeReactionMessageId}
        searchQuery={searchQuery}
        audioPlaybackState={audioPlaybackState}
        onToggleSelect={toggleSelectMessage}
        onOpenReaction={handleOpenReaction}
        onOpenMenu={handleOpenMenu}
        onToggleReaction={toggleReaction}
        onToggleAudioPlay={toggleAudioPlay}
        onSeekAudio={seekAudio}
        onOpenLightbox={setLightboxMedia}
      />

      {/* Floating Scroll-to-Bottom Button */}
      <ScrollToBottomButton
        isVisible={showScrollBottom}
        unreadCount={scrolledUnreadCount}
        onClick={() => scrollToBottom("smooth")}
      />

      {/* Composer Container */}
      {isBlocked ? (
        <div className="p-4 bg-gray-950/90 border-t border-gray-800/80 backdrop-blur-md flex items-center justify-center gap-2.5 text-sm text-gray-400">
          <span className="material-icons text-rose-400 text-base">block</span>
          <span>You have blocked this contact. Unblock them from the sidebar menu to send messages.</span>
        </div>
      ) : (
        <ChatComposer
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          selectedFiles={selectedFiles}
          filePreviews={filePreviews}
          replyingTo={replyingTo}
          editingMessage={editingMessage}
          isRecordingAudio={isRecordingAudio}
          recordingSeconds={recordingSeconds}
          isEmojiPickerOpen={isEmojiPickerOpen}
          setIsEmojiPickerOpen={setIsEmojiPickerOpen}
          isSending={isSending}
          onSendMessage={handleSendMessage}
          onFileSelect={handleFileSelect}
          onRemoveFile={handleRemoveFile}
          onCancelReply={() => setReplyingTo(null)}
          onCancelEdit={() => {
            setEditingMessage(null);
            setNewMessage("");
          }}
          onTyping={(e) => {
            setNewMessage(e.target.value);
            emitTypingActivity();
          }}
          onStartRecordAudio={startRecordingAudio}
          onCancelRecordAudio={cancelRecordingAudio}
          onStopAndSendAudio={stopAndSendAudio}
        />
      )}

      {/* Floating Quick Reaction Picker */}
      <ReactionPickerBar
        activeMessageId={activeReactionMessageId}
        position={reactionPosition}
        onSelectEmoji={(msgId, emoji) => {
          toggleReaction(msgId, emoji);
          setActiveReactionMessageId(null);
        }}
      />

      {/* Floating Message Context Menu */}
      <MessageContextMenu
        activeMessage={activeMenuMessage}
        position={menuPosition}
        isPinned={activeMenuIsPinned}
        isSent={activeMenuIsSent}
        isStarred={activeMenuIsStarred}
        onReply={(msg) => {
          setReplyingTo(msg);
          setEditingMessage(null);
          setTimeout(() => {
            document.querySelector(".chat-input")?.focus();
          }, 50);
        }}
        onTogglePin={(msgId, isPin) => togglePin(msgId, isPin)}
        onToggleStar={handleToggleStar}
        onForward={(msg) => {
          setSelectedMessageIds([msg._id]);
          setActiveMenuMessageId(null);
        }}
        onSelectMessage={handleSelectMessageFromMenu}
        onEdit={(msg) => {
          setEditingMessage(msg);
          setNewMessage(msg.content || "");
          setReplyingTo(null);
          setTimeout(() => {
            document.querySelector(".chat-input")?.focus();
          }, 50);
        }}
        onReport={(msg) => setReportingMessage(msg)}
        onDelete={(msgId) => setDeletingMessageId(msgId)}
        onClose={() => setActiveMenuMessageId(null)}
      />

      {/* Media Lightbox Modal */}
      <MediaLightboxModal
        media={lightboxMedia}
        onClose={() => setLightboxMedia(null)}
      />

      {/* Report Confirmation Modal */}
      {reportingMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setReportingMessage(null)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-400">
              <span className="material-icons text-2xl">report_problem</span>
              <h3 className="text-lg font-semibold text-white">Report Message</h3>
            </div>
            <p className="text-sm text-gray-300">
              Are you sure you want to report this message? The message and author will be flagged for review by moderators.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReportingMessage(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReport}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors flex items-center gap-1.5"
              >
                <span className="material-icons text-base">flag</span>
                Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {(() => {
        const activeDeletingMsg =
          deletingMessageId && deletingMessageId !== "BULK"
            ? messages.find((m) => m._id === deletingMessageId)
            : null;
        const isDeletingSentByMe =
          activeDeletingMsg &&
          (activeDeletingMsg.sender?._id || activeDeletingMsg.sender)?.toString() ===
            currentUser?._id?.toString();

        return (
          <ConfirmDeleteModal
            isOpen={!!deletingMessageId}
            title={
              deletingMessageId === "BULK"
                ? "Delete Messages"
                : isDeletingSentByMe
                ? "Delete Message"
                : "Delete Message for You"
            }
            message={
              deletingMessageId === "BULK"
                ? `Are you sure you want to delete ${selectedMessageIds.length} selected message(s)?`
                : isDeletingSentByMe
                ? "Are you sure you want to delete this message? This action cannot be undone."
                : "Delete this message from your view? Other participants will still be able to see it."
            }
            confirmText="Delete"
            onConfirm={() => {
              if (deletingMessageId === "BULK") {
                bulkDeleteMessages(selectedMessageIds);
                setSelectedMessageIds([]);
              } else if (deletingMessageId) {
                if (isDeletingSentByMe) {
                  deleteMessage(deletingMessageId);
                } else {
                  setMessages((prev) =>
                    prev.filter((m) => m._id !== deletingMessageId)
                  );
                  toast.success("Message deleted for you");
                }
              }
              setDeletingMessageId(null);
            }}
            onCancel={() => setDeletingMessageId(null)}
          />
        );
      })()}

      {/* Forward Message Modal */}
      <ForwardMessageModal
        isOpen={isForwardModalOpen}
        chats={allChats}
        selectedMessageCount={selectedMessageIds.length}
        onConfirmForward={handleConfirmForward}
        onClose={() => setIsForwardModalOpen(false)}
      />
    </div>
  );
};

export default ChatWindow;
