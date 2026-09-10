import React, { useState, useEffect, useRef, useCallback } from "react";
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
  onToggleInfo,
  onBackToSidebar,
  onUpdateLastMessage,
  allChats = [],
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

  // Scroll to bottom & unread badge state
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [scrolledUnreadCount, setScrolledUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

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
        status: "sending",
        readBy: [currentUser?._id],
      };

      setMessages((prev) => [...prev, optimisticAudioMsg]);

      try {
        const formData = new FormData();
        formData.append("chatId", chat._id);
        formData.append("file", audioFile);
        formData.append("mediaType", "audio");

        const res = await apiClient.post("/chat/message", formData);

        if (res.data.success) {
          const confirmed = res.data.data;
          setMessages((prev) =>
            prev.map((m) => (m._id === optimisticId ? confirmed : m))
          );
          socket?.emit("new message", confirmed);
          if (onUpdateLastMessage) onUpdateLastMessage(chat._id, confirmed);
        }
      } catch (error) {
        toast.error("Failed to send voice note");
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
    messagesEndRef.current?.scrollIntoView({ behavior });
    setScrolledUnreadCount(0);
  }, []);

  // Multi-selection handler
  const toggleSelectMessage = useCallback((messageId) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  }, []);

  // Viewport-clamped menu opener
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

      const menuWidth = 175;
      const estimatedMenuHeight = 220;
      const viewportHeight = window.innerHeight || 800;
      const viewportWidth = window.innerWidth || 1200;

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      const openUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

      let top = openUpward ? rect.top - estimatedMenuHeight - 6 : rect.bottom + 6;
      top = Math.max(72, Math.min(top, Math.max(72, viewportHeight - estimatedMenuHeight - 16)));

      let left = rect.left;
      if (rect.right + menuWidth > viewportWidth - 12) {
        left = rect.right - menuWidth;
      }
      left = Math.max(12, Math.min(left, Math.max(12, viewportWidth - menuWidth - 12)));

      setMenuPosition({ top, left });
      setActiveMenuMessageId(msgId);
    },
    [activeMenuMessageId]
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
      top = Math.max(72, Math.min(top, Math.max(72, viewportHeight - pickerHeight - 20)));

      let left = rect.left - pickerWidth / 2 + (rect.width || 28) / 2;
      left = Math.max(12, Math.min(left, Math.max(12, viewportWidth - pickerWidth - 12)));

      setReactionPosition({ top, left });
      setActiveReactionMessageId(msgId);
    },
    [activeReactionMessageId]
  );

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
          socket?.emit("message updated", updated);
          setEditingMessage(null);
          setNewMessage("");
        }
      } catch (error) {
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
      status: "sending",
      readBy: [currentUser?._id],
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      let res;
      if (tempFiles.length > 0) {
        const formData = new FormData();
        formData.append("chatId", chat._id);
        formData.append("content", tempContent);
        if (tempReplyTo) formData.append("replyTo", tempReplyTo._id);
        tempFiles.forEach((file) => formData.append("files", file));
        res = await apiClient.post("/chat/message", formData);
      } else {
        res = await apiClient.post("/chat/message", {
          chatId: chat._id,
          content: tempContent,
          replyTo: tempReplyTo ? tempReplyTo._id : undefined,
        });
      }

      if (res.data.success) {
        const confirmed = res.data.data;
        setMessages((prev) =>
          prev.map((m) => (m._id === optimisticId ? confirmed : m))
        );
        socket?.emit("new message", confirmed);
        if (onUpdateLastMessage) onUpdateLastMessage(chat._id, confirmed);
      }
    } catch (error) {
      toast.error("Failed to send message");
      setMessages((prev) =>
        prev.map((m) => (m._id === optimisticId ? { ...m, status: "failed" } : m))
      );
    } finally {
      setIsSending(false);
    }
  };

  // Forward message handler
  const handleConfirmForward = async (targetChatIds) => {
    if (!targetChatIds || targetChatIds.length === 0 || selectedMessageIds.length === 0) return;
    try {
      const res = await apiClient.post("/chat/message/forward", {
        messageIds: selectedMessageIds,
        targetChatIds,
      });
      if (res.data.success) {
        toast.success("Messages forwarded");
        setSelectedMessageIds([]);
        setIsForwardModalOpen(false);
      }
    } catch (error) {
      toast.error("Failed to forward messages");
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

  const activeMenuIsSent =
    activeMenuMessage &&
    (activeMenuMessage.sender?._id || activeMenuMessage.sender)?.toString() ===
      currentUser?._id?.toString();

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
        loadingInitial={loadingInitial}
        loadingOlder={loadingOlder}
        hasMore={hasMore}
        onLoadOlder={loadOlderMessages}
        onScroll={handleMessagesScroll}
        chatContainerRef={chatContainerRef}
        messagesEndRef={messagesEndRef}
        selectedMessageIds={selectedMessageIds}
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
        onReply={(msg) => {
          setReplyingTo(msg);
          setEditingMessage(null);
        }}
        onTogglePin={(msgId, isPin) => togglePin(msgId, isPin)}
        onForward={(msg) => {
          setSelectedMessageIds([msg._id]);
          setIsForwardModalOpen(true);
        }}
        onEdit={(msg) => {
          setEditingMessage(msg);
          setNewMessage(msg.content || "");
          setReplyingTo(null);
        }}
        onDelete={(msgId) => setDeletingMessageId(msgId)}
        onClose={() => setActiveMenuMessageId(null)}
      />

      {/* Media Lightbox Modal */}
      <MediaLightboxModal
        media={lightboxMedia}
        onClose={() => setLightboxMedia(null)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingMessageId}
        title={
          deletingMessageId === "BULK" ? "Delete Messages" : "Delete Message"
        }
        message={
          deletingMessageId === "BULK"
            ? `Are you sure you want to delete ${selectedMessageIds.length} selected message(s)?`
            : "Are you sure you want to delete this message? This action cannot be undone."
        }
        confirmText="Delete"
        onConfirm={() => {
          if (deletingMessageId === "BULK") {
            bulkDeleteMessages(selectedMessageIds);
            setSelectedMessageIds([]);
          } else if (deletingMessageId) {
            deleteMessage(deletingMessageId);
          }
          setDeletingMessageId(null);
        }}
        onCancel={() => setDeletingMessageId(null)}
      />

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
