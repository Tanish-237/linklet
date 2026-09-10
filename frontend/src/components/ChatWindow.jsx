import React, { useState, useEffect, useRef, useMemo } from "react";
import { apiClient } from "../api/apiClient";
import { toast } from "react-toastify";
import EmojiPicker from "emoji-picker-react";
import TimeAgo from "./TimeAgo";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import ForwardMessageModal from "./ForwardMessageModal";

// Helper: Format date for WhatsApp-style date separators
const formatMessageDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

// Helper: Format seconds to M:SS for audio
const formatAudioTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const ChatWindow = ({
  chat,
  allChats = [],
  currentUser,
  socket,
  onlineUsers = [],
  onToggleInfo,
  onBackToSidebar,
}) => {
  // Local storage cache keys
  const cacheKey = `linklet_cached_msgs_${chat?._id}`;

  // Initial messages from localStorage cache for instant 0ms render
  const [messages, setMessages] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
        const saved = window.localStorage.getItem(cacheKey);
        return saved ? JSON.parse(saved) : [];
      }
    } catch {
      return [];
    }
    return [];
  });

  const [newMessage, setNewMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [reactionPosition, setReactionPosition] = useState({ top: 0, left: 0 });
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // In-chat Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchedIndices, setMatchedIndices] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Floating Scroll-to-bottom & unread counter state
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [scrolledUnreadCount, setScrolledUnreadCount] = useState(0);

  // Media Lightbox Modal state
  const [lightboxMedia, setLightboxMedia] = useState(null); // { url, type }

  // Audio Voice Notes Recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Audio Playback states (messageId -> { isPlaying, currentTime, duration })
  const [audioPlaybackState, setAudioPlaybackState] = useState({});
  const activeAudioRefs = useRef({});

  // Typing & Pagination
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);

  // Sync messages to localStorage cache
  useEffect(() => {
    if (!chat?._id || messages.length === 0) return;
    try {
      if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
        const recent = messages.slice(-30);
        window.localStorage.setItem(cacheKey, JSON.stringify(recent));
      }
    } catch (e) {
      // safe fallback
    }
  }, [messages, chat?._id, cacheKey]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleWindowClick = () => {
      setActiveMenuMessageId(null);
      setActiveReactionMessageId(null);
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  // Fetch messages and mark as read on active chat change
  useEffect(() => {
    if (!chat?._id) return;

    // Load from cache if available
    try {
      if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
        const cached = window.localStorage.getItem(`linklet_cached_msgs_${chat._id}`);
        if (cached) {
          setMessages(JSON.parse(cached));
          setLoadingInitial(false);
        } else {
          setMessages([]);
          setLoadingInitial(true);
        }
      } else {
        setMessages([]);
        setLoadingInitial(true);
      }
    } catch {
      setMessages([]);
      setLoadingInitial(true);
    }

    const fetchMessages = async () => {
      try {
        const res = await apiClient.get(`/chat/message/${chat._id}`, {
          params: { limit: 25 },
        });
        if (res.data.success) {
          const fetchedMsgs = res.data.data.messages || [];
          setMessages(fetchedMsgs);
          setHasMore(res.data.data.hasMore);
          setNextCursor(res.data.data.nextCursor);
          scrollToBottom("auto");
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchMessages();
    setReplyingTo(null);
    setEditingMessage(null);
    setSelectedMessageIds([]);
    setIsSearchOpen(false);
    setSearchQuery("");
    setScrolledUnreadCount(0);

    // Call markAsRead API endpoint
    try {
      const putPromise = apiClient.put(`/chat/message/read/${chat._id}`);
      if (putPromise && typeof putPromise.catch === "function") {
        putPromise.catch((err) => {
          console.warn("Failed to mark chat as read:", err.message);
        });
      }
    } catch (err) {
      // safe fallback
    }

    // Join room & emit real-time read receipt
    if (socket) {
      socket.emit("join chat", chat._id);
      socket.emit("read receipt", { chatId: chat._id, userId: currentUser?._id });
    }
  }, [chat?._id, socket, currentUser?._id]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !chat?._id) return;

    const handleMessageReceived = (message) => {
      const msgChatId = typeof message.chat === "object" ? message.chat._id : message.chat;
      if (msgChatId === chat._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });

        // If user is scrolled up, show unread badge on bottom floating button
        if (showScrollBottom) {
          setScrolledUnreadCount((c) => c + 1);
        } else {
          scrollToBottom("smooth");
        }

        // Mark incoming message as read
        if (message.sender?._id !== currentUser?._id) {
          apiClient.put(`/chat/message/read/${chat._id}`).catch(() => {});
          socket.emit("read receipt", { chatId: chat._id, userId: currentUser?._id });
        }
      }
    };

    const handleMessageUpdated = (updated) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === updated._id ? updated : m))
      );
    };

    const handleMessageDeleted = (deletedId) => {
      setMessages((prev) => prev.filter((m) => m._id !== deletedId));
    };

    const handleTyping = ({ username, chatId }) => {
      if (chatId === chat._id && username !== currentUser?.username) {
        setTypingUsers((prev) => (prev.includes(username) ? prev : [...prev, username]));
      }
    };

    const handleStopTyping = ({ username, chatId }) => {
      if (chatId === chat._id) {
        setTypingUsers((prev) => prev.filter((u) => u !== username));
      }
    };

    const handleReadReceipt = ({ chatId, userId }) => {
      if (chatId === chat._id && userId !== currentUser?._id) {
        setMessages((prev) =>
          prev.map((m) => {
            const readBy = m.readBy || [];
            const hasUser = readBy.some((id) => (id._id || id).toString() === userId.toString());
            if (!hasUser) {
              return { ...m, readBy: [...readBy, userId] };
            }
            return m;
          })
        );
      }
    };

    const handleReactionUpdate = ({ chatId, messageId, reactions }) => {
      if (chatId === chat._id) {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
        );
      }
    };

    socket.on("message received", handleMessageReceived);
    socket.on("message updated", handleMessageUpdated);
    socket.on("message deleted", handleMessageDeleted);
    socket.on("typing", handleTyping);
    socket.on("stop typing", handleStopTyping);
    socket.on("read receipt", handleReadReceipt);
    socket.on("message reaction", handleReactionUpdate);

    return () => {
      socket.off("message received", handleMessageReceived);
      socket.off("message updated", handleMessageUpdated);
      socket.off("message deleted", handleMessageDeleted);
      socket.off("typing", handleTyping);
      socket.off("stop typing", handleStopTyping);
      socket.off("read receipt", handleReadReceipt);
      socket.off("message reaction", handleReactionUpdate);
    };
  }, [socket, chat?._id, currentUser?._id, showScrollBottom]);

  const scrollToBottom = (behavior = "smooth") => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView?.({ behavior });
      setShowScrollBottom(false);
      setScrolledUnreadCount(0);
    });
  };

  // Scroll listener for: Load Older Messages + Scroll-To-Bottom button visibility
  const handleMessagesScroll = (e) => {
    const container = e.currentTarget;
    if (!container) return;

    // Close open message options or reaction bar on scroll (like WhatsApp Web)
    if (activeMenuMessageId || activeReactionMessageId) {
      setActiveMenuMessageId(null);
      setActiveReactionMessageId(null);
    }

    // Show scroll-to-bottom button when scrolled up > 180px from bottom
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBottom(distanceFromBottom > 180);

    // Infinite scroll older messages
    if (container.scrollTop <= 40 && hasMore && !loadingOlder) {
      loadOlderMessages();
    }
  };

  const loadOlderMessages = async () => {
    if (!chat?._id || !hasMore || !nextCursor || loadingOlder) return;

    setLoadingOlder(true);
    const container = chatContainerRef.current;
    const previousScrollHeight = container ? container.scrollHeight : 0;

    try {
      const res = await apiClient.get(`/chat/message/${chat._id}`, {
        params: { cursor: nextCursor, limit: 25 },
      });

      if (res.data?.success) {
        const olderMsgs = res.data.data.messages || [];
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const newUnique = olderMsgs.filter((m) => !existingIds.has(m._id));
          return [...newUnique, ...prev];
        });

        setHasMore(Boolean(res.data.data.hasMore));
        setNextCursor(res.data.data.nextCursor || null);

        // Keep scroll position anchor stable
        if (container) {
          requestAnimationFrame(() => {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - previousScrollHeight;
          });
        }
      }
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Throttled typing handler
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socket || !chat?._id) return;

    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      socket.emit("typing", {
        chatId: chat._id,
        username: currentUser?.username,
      });
      lastTypingEmitRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop typing", {
        chatId: chat._id,
        username: currentUser?.username,
      });
    }, 2500);
  };

  // Pre-Send Attachment Previews
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);

      const previews = files.map((file) => ({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
        type: file.type,
        url: file.type.startsWith("image/") || file.type.startsWith("video/")
          ? URL.createObjectURL(file)
          : null,
      }));
      setFilePreviews((prev) => [...prev, ...previews]);
    }
    e.target.value = "";
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      const item = prev[index];
      if (item?.url) URL.revokeObjectURL(item.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Send message with Optimistic UI update
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (editingMessage) {
      handleEditMessage(editingMessage._id || editingMessage, newMessage);
      return;
    }

    if (isSending || (!newMessage.trim() && selectedFiles.length === 0)) return;

    const tempId = "temp_" + Date.now();
    const optimisticMsg = {
      _id: tempId,
      chat: chat._id,
      sender: currentUser,
      content: newMessage.trim(),
      media: filePreviews[0]?.url || null,
      mediaType: filePreviews[0]?.type.startsWith("image/")
        ? "image"
        : filePreviews[0]?.type.startsWith("video/")
        ? "video"
        : filePreviews[0]?.type.startsWith("audio/")
        ? "audio"
        : filePreviews[0]
        ? "document"
        : null,
      replyTo: replyingTo,
      createdAt: new Date().toISOString(),
      readBy: [currentUser?._id],
      status: "sending",
    };

    // Optimistic inject
    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom("smooth");

    const contentToSend = newMessage.trim();
    const filesToSend = [...selectedFiles];
    const replyToSend = replyingTo?._id;

    // Reset input fields immediately
    setNewMessage("");
    setSelectedFiles([]);
    setFilePreviews([]);
    setReplyingTo(null);
    setIsEmojiPickerOpen(false);

    setIsSending(true);

    const formData = new FormData();
    formData.append("chatId", chat._id);
    if (contentToSend) formData.append("content", contentToSend);
    if (replyToSend) formData.append("replyTo", replyToSend);
    filesToSend.forEach((file) => formData.append("media", file));

    try {
      const res = await apiClient.post("/chat/message", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        const confirmedData = res.data.data;
        const newMsgs = Array.isArray(confirmedData) ? confirmedData : [confirmedData];

        setMessages((prev) =>
          prev.map((m) => (m._id === tempId ? newMsgs[0] : m))
        );

        newMsgs.forEach((msg) => socket?.emit("new message", msg));
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, status: "failed" } : m))
      );
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Toggle emoji reactions
  const handleToggleReaction = async (messageId, emoji) => {
    try {
      const res = await apiClient.post("/chat/message/react", {
        chatId: chat._id,
        messageId,
        emoji,
      });

      if (res.data.success) {
        const updatedMsg = res.data.data;
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? updatedMsg : m))
        );
        socket?.emit("message reaction", {
          chatId: chat._id,
          messageId,
          reactions: updatedMsg.reactions,
        });
      }
    } catch (error) {
      toast.error("Failed to add reaction");
    }
    setActiveReactionMessageId(null);
  };

  // Pin & Unpin message
  const handleTogglePin = async (messageId, isAlreadyPinned) => {
    try {
      const endpoint = isAlreadyPinned ? "/chat/unpin" : "/chat/pin";
      const res = await apiClient.put(endpoint, {
        chatId: chat._id,
        messageId,
      });

      if (res.data.success) {
        const updatedChat = res.data.data;
        toast.success(isAlreadyPinned ? "Message unpinned" : "Message pinned");
        socket?.emit(isAlreadyPinned ? "message unpinned" : "message pinned", {
          chatId: chat._id,
          pinnedMessages: updatedChat.pinnedMessages,
        });
      }
    } catch (error) {
      toast.error("Failed to update pinned status");
    }
    setActiveMenuMessageId(null);
  };

  // Viewport-clamped menu & reaction openers to prevent clipping or overflowing
  const handleOpenMenu = (e, msgId) => {
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

    let top = openUpward
      ? rect.top - estimatedMenuHeight - 6
      : rect.bottom + 6;

    top = Math.max(72, Math.min(top, Math.max(72, viewportHeight - estimatedMenuHeight - 16)));

    let left = rect.left;
    if (rect.right + menuWidth > viewportWidth - 12) {
      left = rect.right - menuWidth;
    }
    left = Math.max(12, Math.min(left, Math.max(12, viewportWidth - menuWidth - 12)));

    setMenuPosition({ top, left });
    setActiveMenuMessageId(msgId);
  };

  const handleOpenReaction = (e, msgId) => {
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

    let top = openAbove
      ? rect.top - pickerHeight - 8
      : rect.bottom + 8;

    top = Math.max(72, Math.min(top, Math.max(72, viewportHeight - pickerHeight - 20)));

    let left = rect.left - pickerWidth / 2 + (rect.width || 28) / 2;
    left = Math.max(12, Math.min(left, Math.max(12, viewportWidth - pickerWidth - 12)));

    setReactionPosition({ top, left });
    setActiveReactionMessageId(msgId);
  };

  // Audio Voice Notes Recording
  const startRecordingAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length > 0 && !mediaRecorderRef.current?.cancelled) {
          const audioFile = new File([audioBlob], `voicenote_${Date.now()}.webm`, {
            type: "audio/webm",
          });
          // Send voice note
          const formData = new FormData();
          formData.append("chatId", chat._id);
          formData.append("media", audioFile);

          try {
            const res = await apiClient.post("/chat/message", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            if (res.data.success) {
              const newMsg = res.data.data;
              setMessages((prev) => [...prev, newMsg]);
              socket?.emit("new message", newMsg);
              scrollToBottom("smooth");
            }
          } catch (err) {
            toast.error("Failed to send voice note");
          }
        }
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err) {
      toast.error("Microphone access denied or unavailable");
    }
  };

  const stopAndSendAudio = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.cancelled = false;
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  };

  const cancelRecordingAudio = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.cancelled = true;
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
    }
  };

  // Audio Playback Controls
  const toggleAudioPlay = (msgId, audioUrl) => {
    let audio = activeAudioRefs.current[msgId];
    if (!audio) {
      audio = new Audio(audioUrl);
      activeAudioRefs.current[msgId] = audio;

      audio.ontimeupdate = () => {
        setAudioPlaybackState((prev) => ({
          ...prev,
          [msgId]: {
            ...prev[msgId],
            currentTime: audio.currentTime,
            duration: audio.duration || 0,
          },
        }));
      };

      audio.onended = () => {
        setAudioPlaybackState((prev) => ({
          ...prev,
          [msgId]: { ...prev[msgId], isPlaying: false, currentTime: 0 },
        }));
      };
    }

    if (audio.paused) {
      // Pause any other playing audio
      Object.entries(activeAudioRefs.current).forEach(([id, a]) => {
        if (id !== msgId) a.pause();
      });
      audio.play();
      setAudioPlaybackState((prev) => ({
        ...prev,
        [msgId]: { ...prev[msgId], isPlaying: true },
      }));
    } else {
      audio.pause();
      setAudioPlaybackState((prev) => ({
        ...prev,
        [msgId]: { ...prev[msgId], isPlaying: false },
      }));
    }
  };

  const handleEditMessage = async (msgId, updatedText) => {
    if (!updatedText || !updatedText.trim()) return;
    try {
      const res = await apiClient.put("/chat/message", {
        chatId: chat._id,
        messageId: msgId,
        content: updatedText.trim(),
      });

      if (res.data.success) {
        const updated = res.data.data;
        setMessages((prev) =>
          prev.map((m) => (m._id === msgId ? updated : m))
        );
        socket?.emit("message updated", updated);
        setEditingMessage(null);
        setNewMessage("");
        toast.success("Message updated");
      }
    } catch (error) {
      toast.error("Failed to edit message");
    }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      const res = await apiClient.delete("/chat/message", {
        data: { chatId: chat._id, messageId: msgId },
      });

      if (res.data.success) {
        setMessages((prev) => prev.filter((m) => m._id !== msgId));
        socket?.emit("message deleted", { chatId: chat._id, messageId: msgId });
        toast.success("Message deleted");
      }
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const toggleSelectMessage = (msgId) => {
    setSelectedMessageIds((prev) =>
      prev.includes(msgId)
        ? prev.filter((id) => id !== msgId)
        : [...prev, msgId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedMessageIds.length === 0) return;
    try {
      const res = await apiClient.delete("/chat/message/bulk-delete", {
        data: { chatId: chat._id, messageIds: selectedMessageIds },
      });

      if (res.data.success) {
        const deletedIds = res.data.data.deletedIds || selectedMessageIds;
        setMessages((prev) => prev.filter((m) => !deletedIds.includes(m._id)));
        deletedIds.forEach((id) =>
          socket?.emit("message deleted", { chatId: chat._id, messageId: id })
        );
        toast.success(`${deletedIds.length} message(s) deleted`);
        setSelectedMessageIds([]);
      }
    } catch (error) {
      toast.error("Failed to delete selected messages");
    }
  };

  const handleConfirmForward = async (targetChatId) => {
    if (selectedMessageIds.length === 0 || !targetChatId) return;
    try {
      const res = await apiClient.post("/chat/message/forward", {
        targetChatId,
        messageIds: selectedMessageIds,
      });

      if (res.data.success) {
        const forwardedMsgs = res.data.data;
        if (targetChatId === chat._id) {
          setMessages((prev) => [...prev, ...forwardedMsgs]);
          scrollToBottom("smooth");
        }
        forwardedMsgs.forEach((msg) => socket?.emit("new message", msg));
        toast.success(`${selectedMessageIds.length} message(s) forwarded!`);
        setSelectedMessageIds([]);
      }
    } catch (error) {
      toast.error("Failed to forward messages");
    }
  };

  // In-chat search indexing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchedIndices([]);
      setCurrentMatchIndex(0);
      return;
    }

    const q = searchQuery.toLowerCase();
    const indices = [];
    messages.forEach((m, idx) => {
      if (m.content && m.content.toLowerCase().includes(q)) {
        indices.push(idx);
      }
    });
    setMatchedIndices(indices);
    setCurrentMatchIndex(indices.length > 0 ? 0 : 0);
  }, [searchQuery, messages]);

  const jumpToMatch = (index) => {
    if (matchedIndices.length === 0) return;
    const targetMsgIdx = matchedIndices[index];
    const el = document.getElementById(`msg-${messages[targetMsgIdx]?._id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setCurrentMatchIndex(index);
  };

  const otherUser = useMemo(() => {
    if (chat.isGroup) return null;
    return chat.participants?.find(
      (p) => (p._id || p)?.toString() !== currentUser?._id?.toString()
    );
  }, [chat, currentUser]);

  const isOnline =
    otherUser &&
    onlineUsers.some((id) => id.toString() === (otherUser._id || otherUser)?.toString());

  const pinnedMessage = chat.pinnedMessages?.[chat.pinnedMessages.length - 1];

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

  return (
    <div className="chat-window relative fixed inset-0 z-40 md:relative md:inset-auto md:z-auto bg-gray-950 flex flex-col h-full h-[100dvh] md:h-full">
      {/* Header / Multi-Select Action Bar */}
      {selectedMessageIds.length > 0 ? (
        <div className="chat-header bg-slate-900 border-b border-violet-500/30 flex items-center justify-between px-6 py-3 z-20 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="chat-multi-select-close-btn"
              onClick={() => setSelectedMessageIds([])}
              className="text-gray-400 hover:text-white cursor-pointer flex items-center"
              aria-label="Cancel selection"
            >
              <span className="material-icons">close</span>
            </button>
            <span className="font-bold text-violet-300 text-sm">
              {selectedMessageIds.length} Selected
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsForwardModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/30 border border-violet-500/40 text-violet-200 rounded-lg text-xs font-semibold hover:bg-violet-600/50 transition-colors cursor-pointer"
            >
              <span className="material-icons text-sm">shortcut</span> Forward
            </button>
            <button
              onClick={() => setDeletingMessageId("BULK")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold hover:bg-red-500/30 transition-colors cursor-pointer"
            >
              <span className="material-icons text-sm">delete</span> Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-header">
          <div className="flex items-center gap-3">
            {/* Mobile back button */}
            {onBackToSidebar && (
              <button
                type="button"
                id="chat-back-to-sidebar-btn"
                onClick={onBackToSidebar}
                className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 text-gray-300 hover:text-white hover:bg-violet-950/50 active:scale-95 rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                title="Back to all chats"
                aria-label="Back to all chats"
              >
                <span className="material-icons text-2xl">arrow_back</span>
              </button>
            )}

            <div
              onClick={onToggleInfo}
              className="chat-header-user cursor-pointer hover:opacity-90 transition-opacity"
            >
              <img
                src={
                  chat.isGroup
                    ? chat.groupImage ||
                      "https://cdn-icons-png.flaticon.com/512/3177/3177440.png"
                    : otherUser?.avatar ||
                      "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
                }
                alt="Avatar"
                className="w-10 h-10 rounded-full border border-violet-500/30 object-cover"
              />
              <div>
                <div className="chat-header-name">
                  {chat.isGroup ? chat.chatName : otherUser?.username}
                </div>
                <div className="chat-header-status flex items-center gap-1">
                  {typingUsers.length > 0 ? (
                    <span className="text-emerald-400 font-medium italic text-xs animate-pulse">
                      typing...
                    </span>
                  ) : chat.isGroup ? (
                    `${chat.participants?.length || 0} members`
                  ) : isOnline ? (
                    "Online"
                  ) : (
                    "Offline"
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="chat-icon-btn"
              title="Search messages"
            >
              <span className="material-icons text-lg">search</span>
            </button>
            <button
              onClick={onToggleInfo}
              className="chat-icon-btn"
              title="Chat Details"
            >
              <span className="material-icons text-lg">more_vert</span>
            </button>
          </div>
        </div>
      )}

      {/* In-Chat Message Search Bar */}
      {isSearchOpen && (
        <div className="inchat-search-bar">
          <span className="material-icons text-violet-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Search within this chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white focus:outline-none"
            autoFocus
          />
          {matchedIndices.length > 0 && (
            <div className="text-xs text-violet-300 font-medium">
              {currentMatchIndex + 1} of {matchedIndices.length}
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              disabled={matchedIndices.length === 0}
              onClick={() =>
                jumpToMatch(
                  currentMatchIndex > 0
                    ? currentMatchIndex - 1
                    : matchedIndices.length - 1
                )
              }
              className="text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer p-1"
            >
              <span className="material-icons text-base">keyboard_arrow_up</span>
            </button>
            <button
              disabled={matchedIndices.length === 0}
              onClick={() =>
                jumpToMatch(
                  currentMatchIndex < matchedIndices.length - 1
                    ? currentMatchIndex + 1
                    : 0
                )
              }
              className="text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer p-1"
            >
              <span className="material-icons text-base">keyboard_arrow_down</span>
            </button>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className="text-gray-400 hover:text-white cursor-pointer p-1"
            >
              <span className="material-icons text-base">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Pinned Messages Banner */}
      {pinnedMessage && (
        <div className="pinned-messages-bar">
          <div
            className="pinned-msg-content"
            onClick={() => {
              const el = document.getElementById(`msg-${pinnedMessage._id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            <span className="material-icons text-violet-400 text-base">push_pin</span>
            <div className="text-xs text-gray-300 truncate">
              <span className="font-semibold text-violet-300">
                {pinnedMessage.sender?.username || "Pinned"}:{" "}
              </span>
              <span>{pinnedMessage.content || "Media Attachment"}</span>
            </div>
          </div>
          <button
            onClick={() => handleTogglePin(pinnedMessage._id, true)}
            className="text-gray-400 hover:text-red-400 p-1 cursor-pointer"
            title="Unpin message"
          >
            <span className="material-icons text-sm">close</span>
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div
        className="chat-messages"
        ref={chatContainerRef}
        onScroll={handleMessagesScroll}
      >
        {/* Load older messages loader / button */}
        {loadingOlder && (
          <div className="flex justify-center py-2 text-violet-400 text-xs items-center gap-1.5 animate-pulse">
            <span className="material-icons text-sm animate-spin">sync</span>
            <span>Loading older messages...</span>
          </div>
        )}
        {hasMore && !loadingOlder && (
          <div className="flex justify-center py-1.5">
            <button
              type="button"
              onClick={loadOlderMessages}
              className="text-xs text-violet-400 hover:text-violet-300 bg-violet-950/40 hover:bg-violet-900/40 px-3 py-1 rounded-full transition-colors border border-violet-800/40 cursor-pointer"
            >
              Load older messages
            </button>
          </div>
        )}

        {/* Skeleton shimmer on cold load */}
        {loadingInitial && messages.length === 0 ? (
          <div className="flex flex-col gap-4 p-4">
            <div className="skeleton-bubble w-48 h-12 self-start" />
            <div className="skeleton-bubble w-64 h-16 self-end" />
            <div className="skeleton-bubble w-56 h-12 self-start" />
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty-state">
            <span className="material-icons chat-empty-icon">chat</span>
            <p className="font-semibold text-lg">No messages yet</p>
            <p className="text-sm">Send a message to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSent =
              (msg.sender?._id || msg.sender)?.toString() === currentUser?._id?.toString();
            const isSelected = selectedMessageIds.includes(msg._id);

            // Date separator check
            const currentDate = formatMessageDate(msg.createdAt);
            const prevDate =
              index > 0 ? formatMessageDate(messages[index - 1]?.createdAt) : null;
            const showDateSeparator = currentDate && currentDate !== prevDate;

            // Search highlight check
            const hasSearchMatch =
              searchQuery &&
              msg.content &&
              msg.content.toLowerCase().includes(searchQuery.toLowerCase());

            const isPinned = chat.pinnedMessages?.some(
              (p) => (p._id || p).toString() === msg._id?.toString()
            );

            // Audio state
            const audioState = audioPlaybackState[msg._id] || {
              isPlaying: false,
              currentTime: 0,
              duration: 0,
            };

            return (
              <React.Fragment key={msg._id || index}>
                {showDateSeparator && (
                  <div className="date-separator">
                    <span className="date-separator-badge">{currentDate}</span>
                  </div>
                )}

                <div
                  id={`msg-${msg._id}`}
                  className="flex items-center gap-3 w-full my-1 relative group"
                  onClick={() => {
                    if (selectedMessageIds.length > 0) {
                      toggleSelectMessage(msg._id);
                    }
                  }}
                >
                  {/* Selection Checkbox */}
                  {selectedMessageIds.length > 0 && (
                    <div
                      className="flex-shrink-0 flex items-center justify-center cursor-pointer pl-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectMessage(msg._id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="glass-checkbox"
                      />
                    </div>
                  )}

                  <div
                    className={`flex-1 flex ${
                      isSent ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`message-bubble-wrapper ${
                        isSent ? "sent" : "received"
                      }`}
                    >
                      {!isSent && chat.isGroup && (
                        <div className="message-sender-name">
                          {msg.sender?.username}
                        </div>
                      )}

                      <div
                        className={`message-bubble-row flex items-start gap-1.5 ${
                          isSent ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        <div
                          className={`message-bubble ${
                            isSelected ? "ring-2 ring-violet-500/60" : ""
                          }`}
                        >
                        {/* Reply Preview */}
                        {msg.replyTo && (
                          <div className="p-2 mb-1.5 rounded bg-black/20 border-l-2 border-violet-400 text-xs text-gray-300">
                            <span className="font-bold text-violet-300 block">
                              {msg.replyTo.sender?.username || "Replied"}
                            </span>
                            <span className="truncate block">
                              {msg.replyTo.content || "Attachment"}
                            </span>
                          </div>
                        )}

                        {/* Content / Search Highlight */}
                        {msg.content && (
                          <div className="break-words">
                            {hasSearchMatch ? (
                              <span>
                                {msg.content
                                  .split(new RegExp(`(${searchQuery})`, "gi"))
                                  .map((part, pIdx) =>
                                    part.toLowerCase() === searchQuery.toLowerCase() ? (
                                      <mark
                                        key={pIdx}
                                        className="search-match-highlight"
                                      >
                                        {part}
                                      </mark>
                                    ) : (
                                      part
                                    )
                                  )}
                              </span>
                            ) : (
                              msg.content
                            )}
                          </div>
                        )}

                        {/* Media: Image / Video / Audio / Document */}
                        {msg.media && (
                          <div className="mt-1">
                            {msg.mediaType === "image" ? (
                              <img
                                src={msg.media}
                                alt="Attachment"
                                className="message-media-img"
                                onClick={() =>
                                  setLightboxMedia({ url: msg.media, type: "image" })
                                }
                              />
                            ) : msg.mediaType === "video" ? (
                              <div
                                className="relative cursor-pointer"
                                onClick={() =>
                                  setLightboxMedia({ url: msg.media, type: "video" })
                                }
                              >
                                <video src={msg.media} className="message-media-img" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                                  <span className="material-icons text-4xl text-white">
                                    play_circle_filled
                                  </span>
                                </div>
                              </div>
                            ) : msg.mediaType === "audio" ? (
                              <div className="audio-player-widget">
                                <button
                                  type="button"
                                  onClick={() => toggleAudioPlay(msg._id, msg.media)}
                                  className="audio-play-btn"
                                >
                                  <span className="material-icons text-xl">
                                    {audioState.isPlaying ? "pause" : "play_arrow"}
                                  </span>
                                </button>
                                <div className="audio-progress-container">
                                  <div
                                    className="audio-progress-bar"
                                    onClick={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const pos = (e.clientX - rect.left) / rect.width;
                                      const audio = activeAudioRefs.current[msg._id];
                                      if (audio && audio.duration) {
                                        audio.currentTime = pos * audio.duration;
                                      }
                                    }}
                                  >
                                    <div
                                      className="audio-progress-fill"
                                      style={{
                                        width: `${
                                          audioState.duration
                                            ? (audioState.currentTime / audioState.duration) * 100
                                            : 0
                                        }%`,
                                      }}
                                    />
                                  </div>
                                  <div className="audio-time-label">
                                    <span>{formatAudioTime(audioState.currentTime)}</span>
                                    <span>{formatAudioTime(audioState.duration)}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <a
                                href={msg.media}
                                target="_blank"
                                rel="noreferrer"
                                className="doc-card"
                              >
                                <div className="doc-icon-badge">
                                  <span className="material-icons text-xl">
                                    description
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-violet-200 truncate">
                                    Attachment Document
                                  </div>
                                  <div className="text-[10px] text-gray-400">
                                    Click to download
                                  </div>
                                </div>
                                <span className="material-icons text-sm text-violet-400">
                                  download
                                </span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Timestamp & WhatsApp Delivery Ticks */}
                        <div className="message-meta">
                          {isPinned && (
                            <span className="material-icons text-[11px] text-violet-300">
                              push_pin
                            </span>
                          )}
                          {msg.isEdited && <span>(edited)</span>}
                          <TimeAgo date={msg.createdAt} />
                          {isSent && (
                            <span>
                              {msg.status === "sending" ? (
                                <span className="material-icons tick-sending">
                                  schedule
                                </span>
                              ) : msg.status === "failed" ? (
                                <span className="material-icons text-red-400 text-xs">
                                  error_outline
                                </span>
                              ) : (
                                <span
                                  className={`material-icons text-xs ${
                                    msg.readBy?.length > 1
                                      ? "tick-read"
                                      : "tick-sent"
                                  }`}
                                >
                                  {msg.readBy?.length > 1 ? "done_all" : "done"}
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        </div>

                        {/* WhatsApp Hover Action Toolbar */}
                        <div
                          className={`msg-actions-toolbar flex items-center gap-0.5 self-start mt-1 transition-all duration-150 ${
                            activeMenuMessageId === msg._id || activeReactionMessageId === msg._id
                              ? "opacity-100 scale-100 pointer-events-auto"
                              : "opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto"
                          }`}
                        >
                          <button
                            type="button"
                            className={`msg-action-btn ${
                              activeReactionMessageId === msg._id ? "active" : ""
                            }`}
                            onClick={(e) => handleOpenReaction(e, msg._id)}
                            title="React"
                            aria-label="React to message"
                          >
                            <span className="text-sm select-none leading-none">😊</span>
                          </button>
                          <button
                            type="button"
                            className={`msg-action-btn ${
                              activeMenuMessageId === msg._id ? "active" : ""
                            }`}
                            onClick={(e) => handleOpenMenu(e, msg._id)}
                            title="Message options"
                            aria-label="Message options"
                          >
                            <span className="material-icons text-base">keyboard_arrow_down</span>
                          </button>
                        </div>
                      </div>

                      {/* Reaction Pills Container */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div
                          className={`reaction-pills-container flex flex-wrap gap-1 mt-1 ${
                            isSent ? "justify-end" : "justify-start"
                          }`}
                        >
                          {Object.entries(
                            msg.reactions.reduce((acc, r) => {
                              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([emoji, count]) => {
                            const userReacted = msg.reactions.some(
                              (r) =>
                                (r.user?._id || r.user)?.toString() ===
                                  currentUser?._id?.toString() &&
                                r.emoji === emoji
                            );
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleReaction(msg._id, emoji);
                                }}
                                className={`reaction-pill ${
                                  userReacted ? "user-reacted" : ""
                                }`}
                                title="Click to toggle reaction"
                              >
                                <span>{emoji}</span>
                                <span>{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="scroll-to-bottom-btn"
          title="Scroll to latest messages"
        >
          <span className="material-icons">keyboard_arrow_down</span>
          {scrolledUnreadCount > 0 && (
            <span className="scroll-unread-badge">{scrolledUnreadCount}</span>
          )}
        </button>
      )}

      {/* Replying-to Preview Bar */}
      {replyingTo && (
        <div className="px-6 py-2 bg-slate-900/90 border-t border-violet-500/20 flex justify-between items-center text-xs text-violet-300">
          <div>
            Replying to{" "}
            <span className="font-bold">
              {replyingTo.sender?.username || "User"}
            </span>
            : "{replyingTo.content || "Attachment"}"
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-400 hover:text-white cursor-pointer font-bold text-base"
          >
            &times;
          </button>
        </div>
      )}

      {/* Editing Message Preview Bar */}
      {editingMessage && (
        <div className="px-6 py-2 bg-slate-900/95 border-t border-violet-500/25 flex justify-between items-center text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <span className="material-icons text-sm text-amber-400">edit</span>
            <span>
              Editing message:{" "}
              <span className="font-semibold text-white">
                "{editingMessage.content || "Media"}"
              </span>
            </span>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setNewMessage("");
            }}
            className="text-gray-400 hover:text-white text-base font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Pre-Send Attachment Preview Tray */}
      {filePreviews.length > 0 && (
        <div className="attachment-preview-tray">
          {filePreviews.map((preview, idx) => (
            <div key={idx} className="attachment-preview-card">
              {preview.url ? (
                preview.type.startsWith("image/") ? (
                  <img
                    src={preview.url}
                    alt="Preview"
                    className="attachment-preview-img"
                  />
                ) : (
                  <video
                    src={preview.url}
                    className="attachment-preview-img"
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center p-1 text-center">
                  <span className="material-icons text-2xl text-violet-400">
                    description
                  </span>
                  <span className="text-[9px] text-gray-300 truncate max-w-[70px]">
                    {preview.name}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="attachment-remove-btn"
                title="Remove file"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Composer / Voice Recorder */}
      {isRecordingAudio ? (
        <div className="chat-composer">
          <div className="voice-recording-tray">
            <div className="recording-indicator">
              <div className="recording-dot-pulse" />
              <span>Recording: {formatAudioTime(recordingSeconds)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={cancelRecordingAudio}
                className="text-red-400 hover:text-red-300 cursor-pointer flex items-center p-2 rounded-full hover:bg-red-500/20"
                title="Cancel recording"
              >
                <span className="material-icons">delete</span>
              </button>
              <button
                type="button"
                onClick={stopAndSendAudio}
                className="send-btn"
                title="Send voice note"
              >
                <span className="material-icons">send</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="chat-composer relative">
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="chat-icon-btn"
            title="Attach file (Images, Videos, Docs)"
          >
            <span className="material-icons">attach_file</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
            className="chat-icon-btn"
            title="Insert Emoji"
          >
            <span className="material-icons">sentiment_satisfied_alt</span>
          </button>

          {/* Emoji Picker Popover */}
          {isEmojiPickerOpen && (
            <div className="absolute bottom-16 left-12 z-50 shadow-2xl">
              <EmojiPicker
                theme="dark"
                onEmojiClick={(emojiData) => {
                  setNewMessage((prev) => prev + emojiData.emoji);
                }}
              />
            </div>
          )}

          <input
            type="text"
            placeholder={
              filePreviews.length > 0
                ? "Add a caption..."
                : "Type a message..."
            }
            value={newMessage}
            onChange={handleTyping}
            className="chat-input"
          />

          {newMessage.trim() || selectedFiles.length > 0 ? (
            <button
              type="submit"
              disabled={isSending}
              className="send-btn disabled:opacity-50"
              title="Send message"
            >
              <span className="material-icons">
                {isSending ? "hourglass_top" : "send"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecordingAudio}
              className="send-btn bg-violet-700 hover:bg-violet-600"
              title="Record voice note"
            >
              <span className="material-icons">mic</span>
            </button>
          )}
        </form>
      )}

      {/* Media Lightbox Modal */}
      {lightboxMedia && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxMedia(null)}
        >
          <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
            <a
              href={lightboxMedia.url}
              download
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-white hover:text-violet-300 p-2 bg-black/40 rounded-full cursor-pointer"
              title="Download"
            >
              <span className="material-icons text-2xl">download</span>
            </a>
            <button
              onClick={() => setLightboxMedia(null)}
              className="text-white hover:text-red-400 p-2 bg-black/40 rounded-full cursor-pointer"
              title="Close"
            >
              <span className="material-icons text-2xl">close</span>
            </button>
          </div>
          {lightboxMedia.type === "video" ? (
            <video
              controls
              autoPlay
              src={lightboxMedia.url}
              className="lightbox-content"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightboxMedia.url}
              alt="Lightbox"
              className="lightbox-content"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Floating Quick Reaction Picker (Viewport Fixed, Zero Clipping, Clamped) */}
      {activeReactionMessageId && (
        <div
          className="reaction-picker-bar"
          style={{
            top: `${reactionPosition.top}px`,
            left: `${reactionPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleReaction(activeReactionMessageId, emoji);
                setActiveReactionMessageId(null);
              }}
              className="reaction-btn"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Floating Message Context Menu (Viewport Fixed, Zero Clipping, Clamped) */}
      {activeMenuMessage && (
        <div
          className="msg-context-menu"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setReplyingTo(activeMenuMessage);
              setEditingMessage(null);
              setActiveMenuMessageId(null);
            }}
            className="msg-menu-item"
          >
            <span className="material-icons">reply</span> Reply
          </button>

          <button
            onClick={() => {
              handleTogglePin(activeMenuMessage._id, activeMenuIsPinned);
              setActiveMenuMessageId(null);
            }}
            className="msg-menu-item"
          >
            <span className="material-icons">push_pin</span>{" "}
            {activeMenuIsPinned ? "Unpin Message" : "Pin Message"}
          </button>

          {activeMenuMessage.content && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeMenuMessage.content);
                toast.info("Copied to clipboard");
                setActiveMenuMessageId(null);
              }}
              className="msg-menu-item"
            >
              <span className="material-icons">content_copy</span> Copy
            </button>
          )}

          <button
            onClick={() => {
              setSelectedMessageIds([activeMenuMessage._id]);
              setIsForwardModalOpen(true);
              setActiveMenuMessageId(null);
            }}
            className="msg-menu-item"
          >
            <span className="material-icons">shortcut</span> Forward
          </button>

          {activeMenuIsSent &&
            !activeMenuMessage.media &&
            Date.now() - new Date(activeMenuMessage.createdAt).getTime() <=
              15 * 60 * 1000 && (
              <button
                onClick={() => {
                  setEditingMessage(activeMenuMessage);
                  setNewMessage(activeMenuMessage.content || "");
                  setReplyingTo(null);
                  setActiveMenuMessageId(null);
                }}
                className="msg-menu-item"
              >
                <span className="material-icons">edit</span> Edit
              </button>
            )}

          {activeMenuIsSent && (
            <button
              onClick={() => {
                setDeletingMessageId(activeMenuMessage._id);
                setActiveMenuMessageId(null);
              }}
              className="msg-menu-item text-red-400 hover:bg-red-500/20"
            >
              <span className="material-icons text-red-400">delete</span>{" "}
              Delete
            </button>
          )}
        </div>
      )}

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
            handleBulkDelete();
          } else if (deletingMessageId) {
            handleDeleteMessage(deletingMessageId);
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
