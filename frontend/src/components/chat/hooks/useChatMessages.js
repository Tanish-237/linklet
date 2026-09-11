import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { apiClient } from "../../../api/apiClient";

/**
 * Custom hook for managing the message lifecycle, caching, socket listeners, and message operations
 */
export const useChatMessages = ({ chat, currentUser, socket, onUpdateLastMessage }) => {
  const getInitialMessages = () => {
    if (!chat?._id) return [];
    try {
      if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
        const cached = window.localStorage.getItem(`linklet_cached_msgs_${chat._id}`);
        if (cached) return JSON.parse(cached);
      }
    } catch {
      // safe fallback
    }
    return [];
  };

  const [messages, setMessages] = useState(getInitialMessages);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);

  // Immediately synchronize messages if chat changes while component remains mounted
  const prevChatIdRef = useRef(chat?._id);
  if (prevChatIdRef.current !== chat?._id) {
    prevChatIdRef.current = chat?._id;
    setMessages(getInitialMessages());
    setLoadingInitial(false);
  }

  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const cacheKey = `linklet_cached_msgs_${chat?._id}`;

  // Sync latest messages to localStorage cache
  useEffect(() => {
    if (!chat?._id || messages.length === 0) return;
    try {
      if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
        const recent = messages.slice(-30);
        window.localStorage.setItem(cacheKey, JSON.stringify(recent));
      }
    } catch {
      // safe fallback
    }
  }, [messages, chat?._id, cacheKey]);

  // Fetch initial messages and mark conversation as read
  useEffect(() => {
    if (!chat?._id) return;

    // Fast-hydrate from localStorage cache
    try {
      if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
        const cached = window.localStorage.getItem(cacheKey);
        if (cached) {
          setMessages(JSON.parse(cached));
          setLoadingInitial(false);
        } else {
          setLoadingInitial(true);
        }
      } else {
        setLoadingInitial(true);
      }
    } catch {
      setLoadingInitial(true);
    }

    const fetchMessages = async () => {
      try {
        const res = await apiClient.get(`/chat/message/${chat._id}`, {
          params: { limit: 25 },
        });
        if (res.data.success) {
          setMessages(res.data.data.messages);
          setHasMore(res.data.data.hasMore);
          setNextCursor(res.data.data.nextCursor);
        }
      } catch (error) {
        toast.error("Failed to load messages");
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchMessages();

    // Mark as read on server & emit real-time read receipt
    Promise.resolve(apiClient.put?.(`/chat/message/read/${chat._id}`)).catch(() => {});
    if (socket) {
      socket.emit("read receipt", {
        chatId: chat._id,
        userId: currentUser?._id,
      });
    }
  }, [chat?._id, cacheKey, currentUser?._id, socket]);

  // Real-time socket listeners for messages, reactions, pins, and delivery status
  useEffect(() => {
    if (!socket || !chat?._id) return;

    socket.emit("join chat", chat._id);

    const handleMessageReceived = (newMessage) => {
      const msgChatId = (newMessage.chat?._id || newMessage.chat)?.toString();
      if (msgChatId === chat._id?.toString()) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMessage._id)) return prev;
          return [...prev, newMessage];
        });

        // Mark as read immediately if chat is active
        Promise.resolve(apiClient.put?.(`/chat/message/read/${chat._id}`)).catch(() => {});
        socket.emit("read receipt", {
          chatId: chat._id,
          userId: currentUser?._id,
        });

        if (onUpdateLastMessage) {
          onUpdateLastMessage(chat._id, newMessage);
        }
      }
    };

    const handleMessageDeleted = ({ chatId, messageId }) => {
      if (chatId?.toString() === chat._id?.toString()) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    };

    const handleMessageUpdated = (updatedMessage) => {
      const msgChatId = (updatedMessage.chat?._id || updatedMessage.chat)?.toString();
      if (msgChatId === chat._id?.toString()) {
        setMessages((prev) =>
          prev.map((m) => (m._id === updatedMessage._id ? updatedMessage : m))
        );
      }
    };

    const handleReactionUpdate = ({ chatId, messageId, reactions }) => {
      if (chatId?.toString() === chat._id?.toString()) {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
        );
      }
    };

    const handleReadReceipt = ({ chatId, userId }) => {
      if (chatId?.toString() === chat._id?.toString() && userId) {
        setMessages((prev) =>
          prev.map((m) => {
            const hasRead = m.readBy?.some(
              (id) => (id._id || id)?.toString() === userId.toString()
            );
            if (!hasRead) {
              return { ...m, readBy: [...(m.readBy || []), userId] };
            }
            return m;
          })
        );
      }
    };

    const handleTyping = (room) => {
      if (room?.chatId === chat._id && room?.userId !== currentUser?._id) {
        setTypingUsers((prev) =>
          prev.includes(room.username) ? prev : [...prev, room.username]
        );
      }
    };

    const handleStopTyping = (room) => {
      if (room?.chatId === chat._id) {
        setTypingUsers((prev) => prev.filter((u) => u !== room.username));
      }
    };

    socket.on("message received", handleMessageReceived);
    socket.on("message deleted", handleMessageDeleted);
    socket.on("message updated", handleMessageUpdated);
    socket.on("message reaction", handleReactionUpdate);
    socket.on("read receipt", handleReadReceipt);
    socket.on("typing", handleTyping);
    socket.on("stop typing", handleStopTyping);

    return () => {
      socket.emit("leave chat", chat._id);
      socket.off("message received", handleMessageReceived);
      socket.off("message deleted", handleMessageDeleted);
      socket.off("message updated", handleMessageUpdated);
      socket.off("message reaction", handleReactionUpdate);
      socket.off("read receipt", handleReadReceipt);
      socket.off("typing", handleTyping);
      socket.off("stop typing", handleStopTyping);
    };
  }, [socket, chat?._id, currentUser?._id, onUpdateLastMessage]);

  // Load older messages via cursor pagination
  const loadOlderMessages = useCallback(async (container) => {
    if (!chat?._id || !hasMore || !nextCursor || loadingOlder) return;

    setLoadingOlder(true);
    const previousScrollHeight = container ? container.scrollHeight : 0;

    try {
      const res = await apiClient.get(`/chat/message/${chat._id}`, {
        params: { cursor: nextCursor, limit: 25 },
      });

      if (res.data.success) {
        const { messages: olderMessages, hasMore: more, nextCursor: cursor } = res.data.data;
        setMessages((prev) => [...olderMessages, ...prev]);
        setHasMore(more);
        setNextCursor(cursor);

        // Preserve user scroll position after prepending older messages
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop += newScrollHeight - previousScrollHeight;
          }
        });
      }
    } catch (error) {
      toast.error("Failed to load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }, [chat?._id, hasMore, nextCursor, loadingOlder]);

  // Typing debouncer emitter
  const emitTypingActivity = useCallback(() => {
    if (!socket || !chat?._id) return;
    const now = Date.now();
    const otherUser = chat.isGroup
      ? null
      : chat.participants?.find(
          (p) => (p._id || p)?.toString() !== currentUser?._id?.toString()
        );
    const recipientId = (otherUser?._id || otherUser)?.toString();

    if (now - lastTypingEmitRef.current > 2000) {
      socket.emit("typing", {
        chatId: chat._id,
        userId: currentUser?._id,
        username: currentUser?.username,
        recipientId,
      });
      lastTypingEmitRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop typing", {
        chatId: chat._id,
        userId: currentUser?._id,
        username: currentUser?.username,
        recipientId,
      });
    }, 2500);
  }, [socket, chat?._id, chat?.isGroup, chat?.participants, currentUser]);

  const emitStopTypingImmediate = useCallback(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (socket && chat?._id) {
      const otherUser = chat.isGroup
        ? null
        : chat.participants?.find(
            (p) => (p._id || p)?.toString() !== currentUser?._id?.toString()
          );
      const recipientId = (otherUser?._id || otherUser)?.toString();

      socket.emit("stop typing", {
        chatId: chat._id,
        userId: currentUser?._id,
        username: currentUser?.username,
        recipientId,
      });
    }
  }, [socket, chat?._id, chat?.isGroup, chat?.participants, currentUser]);

  // Toggle emoji reaction
  const toggleReaction = useCallback(async (messageId, emoji) => {
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
  }, [chat?._id, socket]);

  // Pin & unpin message
  const togglePin = useCallback(async (messageId, isAlreadyPinned) => {
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
        return updatedChat;
      }
    } catch (error) {
      toast.error("Failed to update pinned status");
    }
    return null;
  }, [chat?._id, socket]);

  // Delete message
  const deleteMessage = useCallback(async (messageId) => {
    try {
      const res = await apiClient.delete(`/chat/message/${messageId}`, {
        data: { chatId: chat?._id, messageId },
        params: { chatId: chat?._id },
      });
      if (res.data.success) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
        socket?.emit("message deleted", {
          chatId: chat._id,
          messageId,
        });
        toast.success("Message deleted");
      }
    } catch (error) {
      toast.error("Failed to delete message");
    }
  }, [chat?._id, socket]);

  // Bulk delete messages
  const bulkDeleteMessages = useCallback(async (messageIds) => {
    try {
      const res = await apiClient.delete("/chat/message/bulk-delete", {
        data: {
          chatId: chat?._id,
          messageIds,
        },
      });
      if (res.data.success) {
        setMessages((prev) => prev.filter((m) => !messageIds.includes(m._id)));
        messageIds.forEach((id) => {
          socket?.emit("message deleted", {
            chatId: chat._id,
            messageId: id,
          });
        });
        toast.success(`${messageIds.length} messages deleted`);
      }
    } catch (error) {
      toast.error("Failed to delete messages");
    }
  }, [chat?._id, socket]);

  return {
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
  };
};
