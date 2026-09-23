import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { apiClient } from "../../../api/apiClient";
import { upsertMessage } from "./upsertMessage";
import { getCachedChat, setCachedChat } from "./chatMessageCache";

export { upsertMessage };

/**
 * Custom hook for managing the message lifecycle, caching, socket listeners, and message operations
 */
export const useChatMessages = ({ chat, currentUser, socket, onUpdateLastMessage, onPinnedMessagesChange }) => {
  const getInitialMessages = () => {
    if (!chat?._id) return [];
    // In-memory first (instant, kept live by ChatPage), then localStorage.
    const memory = getCachedChat(chat._id);
    if (memory?.messages?.length) return memory.messages;
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
  const [hasMore, setHasMore] = useState(() => Boolean(getCachedChat(chat?._id)?.hasMore));
  const [nextCursor, setNextCursor] = useState(() => getCachedChat(chat?._id)?.nextCursor || null);
  const [typingUsers, setTypingUsers] = useState([]);
  // Distinct from `loadingInitial`: that flips to false as soon as a
  // localStorage cache hydrates `messages`, which happens before the real
  // network fetch (and its authoritative `hasMore`/`nextCursor`) resolves.
  // Callers that need to know "has hasMore settled to a real value yet" —
  // e.g. deciding whether to give up looking for a message — must wait for
  // this instead, or they'll act on a stale default `hasMore: false`.
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Immediately synchronize messages if chat changes while component remains mounted
  const prevChatIdRef = useRef(chat?._id);
  const onUpdateLastMessageRef = useRef(onUpdateLastMessage);

  const onPinnedChangeRef = useRef(onPinnedMessagesChange);
  useEffect(() => {
    onUpdateLastMessageRef.current = onUpdateLastMessage;
    onPinnedChangeRef.current = onPinnedMessagesChange;
  }, [onUpdateLastMessage, onPinnedMessagesChange]);
  if (prevChatIdRef.current !== chat?._id) {
    prevChatIdRef.current = chat?._id;
    setMessages(getInitialMessages());
    setLoadingInitial(false);
  }

  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  // Per-username expiry for the incoming "typing…" indicator. If the other
  // person closes their tab mid-sentence no "stop typing" ever arrives, so
  // each name drops off on its own a few seconds after its last signal.
  const typingExpiryRef = useRef({});
  // Read receipts: an incoming message is only "read" if this tab is actually
  // visible. Receipts are throttled — a busy group chat shouldn't fire a DB
  // write per message.
  const readReceiptTimerRef = useRef(null);
  const pendingReadRef = useRef(false);
  const cacheKey = `linklet_cached_msgs_${chat?._id}`;

  // Keep the in-memory cache current (cheap) and mirror the newest
  // messages to localStorage for the next page load.
  useEffect(() => {
    if (!chat?._id || messages.length === 0) return;
    setCachedChat(chat._id, { messages, hasMore, nextCursor });
  }, [messages, hasMore, nextCursor, chat?._id]);

  useEffect(() => {
    if (!chat?._id || messages.length === 0) return;
    try {
      if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
        // Unsent optimistic bubbles carry File objects and blob: URLs that
        // don't survive a reload — only cache real, server-confirmed messages.
        const recent = messages.filter((m) => !String(m._id).startsWith("opt_")).slice(-30);
        window.localStorage.setItem(cacheKey, JSON.stringify(recent));
      }
    } catch {
      // safe fallback
    }
  }, [messages, chat?._id, cacheKey]);

  // Fetch initial messages and mark conversation as read
  useEffect(() => {
    if (!chat?._id) return;

    setInitialFetchDone(false);

    // Anything already rendered from a cache (initial state) stays on screen;
    // only show the skeleton when there's nothing at all to show.
    setLoadingInitial(getInitialMessages().length === 0);

    let cancelled = false;
    const fetchMessages = async () => {
      try {
        const res = await apiClient.get(`/chat/message/${chat._id}`, {
          params: { limit: 25 },
        });
        if (!cancelled && res.data.success) {
          const { messages: fresh, hasMore: more, nextCursor: cursor } = res.data.data;
          // Keep any optimistic (still-sending) bubbles the user added while
          // this request was in flight.
          setMessages((prev) => {
            const pending = prev.filter((m) => String(m._id).startsWith("opt_"));
            return pending.reduce((acc, m) => upsertMessage(acc, m), fresh);
          });
          setHasMore(more);
          setNextCursor(cursor);
          setCachedChat(chat._id, { messages: fresh, hasMore: more, nextCursor: cursor, fetchedAt: Date.now() });
        }
      } catch {
        if (!cancelled) toast.error("Failed to load messages");
      } finally {
        if (!cancelled) {
          setLoadingInitial(false);
          setInitialFetchDone(true);
        }
      }
      // Mark read only AFTER the messages are loaded: fired in parallel, the
      // read could land first and the fetch would come back already-read.
      if (!cancelled) markChatRead();
    };

    fetchMessages();
    return () => {
      cancelled = true;
    };
    // markChatRead is stable (refs only); chat id drives this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?._id, cacheKey]);

  // Persist "read up to now" (server updates readBy + the read cursor and
  // broadcasts the receipt), and reflect it locally. Deferred while the tab is
  // hidden — messages that arrive in a background tab stay unread until the
  // user actually comes back to them.
  const socketRef = useRef(socket);
  const currentUserIdRef = useRef(currentUser?._id);
  const chatIdRef = useRef(chat?._id);
  useEffect(() => {
    socketRef.current = socket;
    currentUserIdRef.current = currentUser?._id;
    chatIdRef.current = chat?._id;
  });

  const markChatRead = useCallback(() => {
    const chatId = chatIdRef.current;
    const me = currentUserIdRef.current?.toString();
    if (!chatId) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      pendingReadRef.current = true;
      return;
    }
    pendingReadRef.current = false;

    setMessages((prev) => {
      let changed = false;
      const next = prev.map((m) => {
        const senderId = (m.sender?._id || m.sender)?.toString();
        if (!me || senderId === me) return m;
        if (m.readBy?.some((u) => (u?._id || u)?.toString() === me)) return m;
        changed = true;
        return { ...m, readBy: [...(m.readBy || []), me] };
      });
      return changed ? next : prev;
    });

    const sock = socketRef.current;
    if (sock?.connected) {
      sock.emit("read receipt", { chatId });
    } else {
      Promise.resolve(apiClient.put?.(`/chat/message/read/${chatId}`)).catch(() => {});
    }
  }, []);

  const scheduleReadReceipt = useCallback(() => {
    if (readReceiptTimerRef.current) return;
    readReceiptTimerRef.current = setTimeout(() => {
      readReceiptTimerRef.current = null;
      markChatRead();
    }, 1000);
  }, [markChatRead]);

  useEffect(() => {
    const typingExpiries = typingExpiryRef.current;
    const onVisible = () => {
      if (document.visibilityState === "visible" && pendingReadRef.current) markChatRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (readReceiptTimerRef.current) clearTimeout(readReceiptTimerRef.current);
      Object.values(typingExpiries).forEach(clearTimeout);
    };
  }, [markChatRead]);

  // Real-time socket listeners for messages, reactions, pins, and delivery status
  useEffect(() => {
    if (!socket || !chat?._id) return;

    socket.emit("join chat", chat._id);

    const handleMessageReceived = (newMessage) => {
      const msgChatId = (newMessage.chat?._id || newMessage.chat)?.toString();
      if (msgChatId === chat._id?.toString()) {
        setMessages((prev) => upsertMessage(prev, newMessage));

        const senderId = (newMessage.sender?._id || newMessage.sender)?.toString();
        if (senderId !== currentUser?._id?.toString()) scheduleReadReceipt();

        if (onUpdateLastMessageRef.current) {
          onUpdateLastMessageRef.current(chat._id, newMessage);
        }
      }
    };

    const handleMessageDeleted = ({ chatId, messageId }) => {
      if (chatId?.toString() === chat._id?.toString()) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    };

    const handleMessagesBulkDeleted = ({ chatId, messageIds }) => {
      if (chatId?.toString() === chat._id?.toString() && Array.isArray(messageIds)) {
        const idSet = new Set(messageIds.map((id) => id.toString()));
        setMessages((prev) => prev.filter((m) => !idSet.has(m._id?.toString())));
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

    const clearTypingUser = (username) => {
      clearTimeout(typingExpiryRef.current[username]);
      delete typingExpiryRef.current[username];
      setTypingUsers((prev) => prev.filter((u) => u !== username));
    };

    const handleTyping = (room) => {
      if (room?.chatId === chat._id && room?.userId !== currentUser?._id && room?.username) {
        setTypingUsers((prev) =>
          prev.includes(room.username) ? prev : [...prev, room.username]
        );
        clearTimeout(typingExpiryRef.current[room.username]);
        typingExpiryRef.current[room.username] = setTimeout(
          () => clearTypingUser(room.username),
          5000
        );
      }
    };

    const handleStopTyping = (room) => {
      if (room?.chatId === chat._id && room?.username) {
        clearTypingUser(room.username);
      }
    };

    const handleMessageDelivered = ({ chatId, messageId }) => {
      if (chatId?.toString() === chat._id?.toString()) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m._id?.toString() === messageId?.toString()) {
              if (m.status !== "read" && !m.isRead) {
                return { ...m, status: "delivered", isDelivered: true };
              }
            }
            return m;
          })
        );
      }
    };

    const handlePinChange = ({ chatId, pinnedMessages }) => {
      if (chatId?.toString() === chat._id?.toString() && Array.isArray(pinnedMessages)) {
        onPinnedChangeRef.current?.(pinnedMessages);
      }
    };

    socket.on("message received", handleMessageReceived);
    socket.on("message pinned", handlePinChange);
    socket.on("message unpinned", handlePinChange);
    socket.on("message delivered", handleMessageDelivered);
    socket.on("message deleted", handleMessageDeleted);
    socket.on("messages_bulk_deleted", handleMessagesBulkDeleted);
    socket.on("message updated", handleMessageUpdated);
    socket.on("message reaction", handleReactionUpdate);
    socket.on("read receipt", handleReadReceipt);
    socket.on("typing", handleTyping);
    socket.on("stop typing", handleStopTyping);

    return () => {
      socket.emit("leave chat", chat._id);
      socket.off("message received", handleMessageReceived);
      socket.off("message pinned", handlePinChange);
      socket.off("message unpinned", handlePinChange);
      socket.off("message delivered", handleMessageDelivered);
      socket.off("message deleted", handleMessageDeleted);
      socket.off("messages_bulk_deleted", handleMessagesBulkDeleted);
      socket.off("message updated", handleMessageUpdated);
      socket.off("message reaction", handleReactionUpdate);
      socket.off("read receipt", handleReadReceipt);
      socket.off("typing", handleTyping);
      socket.off("stop typing", handleStopTyping);
    };
  }, [socket, chat?._id, currentUser?._id, scheduleReadReceipt]);

  // Load older messages via cursor pagination
  // Scroll position across the prepend is kept by ChatWindow's own scroll
  // anchoring (it pins the message you were looking at), so this only loads.
  const loadOlderMessages = useCallback(async () => {
    if (!chat?._id || !hasMore || !nextCursor || loadingOlder) return;

    setLoadingOlder(true);

    try {
      const res = await apiClient.get(`/chat/message/${chat._id}`, {
        params: { cursor: nextCursor, limit: 25 },
      });

      if (res.data.success) {
        const { messages: olderMessages, hasMore: more, nextCursor: cursor } = res.data.data;
        setMessages((prev) => {
          const have = new Set(prev.map((m) => String(m._id)));
          return [...olderMessages.filter((m) => !have.has(String(m._id))), ...prev];
        });
        setHasMore(more);
        setNextCursor(cursor);
      }
    } catch {
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

  // Toggle emoji reaction with instant 0ms optimistic UI updates
  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      if (!messageId || !emoji) return;

      let previousReactions = [];

      // 1. Instant optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id !== messageId) return m;
          const currentReactions = Array.isArray(m.reactions) ? m.reactions : [];
          previousReactions = currentReactions;

          const existingReactionIndex = currentReactions.findIndex(
            (r) =>
              (r.user?._id || r.user)?.toString() === currentUser?._id?.toString()
          );

          let nextReactions;
          if (existingReactionIndex > -1) {
            const existingReaction = currentReactions[existingReactionIndex];
            if (existingReaction.emoji === emoji) {
              // Same emoji clicked: toggle off
              nextReactions = currentReactions.filter(
                (_, idx) => idx !== existingReactionIndex
              );
            } else {
              // Different emoji clicked: switch emoji
              nextReactions = currentReactions.map((r, idx) =>
                idx === existingReactionIndex ? { ...r, emoji } : r
              );
            }
          } else {
            // New reaction added
            nextReactions = [
              ...currentReactions,
              { user: currentUser, emoji },
            ];
          }

          return { ...m, reactions: nextReactions };
        })
      );

      // 2. Persist to server in background
      try {
        const res = await apiClient.post("/chat/message/react", {
          chatId: chat?._id,
          messageId,
          emoji,
        });

        if (res.data?.success && res.data.data) {
          const updatedMsg = res.data.data;
          setMessages((prev) =>
            prev.map((m) => (m._id === messageId ? updatedMsg : m))
          );
          // Server broadcasts "message reaction" to the rest of the chat after
          // persisting it — no client-side relay needed.
        }
      } catch {
        // Rollback on failure
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId ? { ...m, reactions: previousReactions } : m
          )
        );
        toast.error("Failed to add reaction");
      }
    },
    [chat?._id, currentUser]
  );

  // Pin & unpin message
  const togglePin = useCallback(async (messageId, isAlreadyPinned) => {
    try {
      const endpoint = isAlreadyPinned ? "/chat/unpin" : "/chat/pin";
      const res = await apiClient.put(endpoint, {
        chatId: chat._id,
        messageId,
      });

      if (res.data.success) {
        // Server also broadcasts "message pinned"/"message unpinned" to the room.
        return res.data.data;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't update the pin");
    }
    return null;
  }, [chat?._id]);

  // Delete message
  const deleteMessage = useCallback(async (messageId) => {
    try {
      const res = await apiClient.delete(`/chat/message/${messageId}`, {
        data: { chatId: chat?._id, messageId },
        params: { chatId: chat?._id },
      });
      if (res.data.success) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
        // Server broadcasts "message deleted" to the chat room.
        toast.success("Message deleted");
      }
    } catch {
      toast.error("Failed to delete message");
    }
  }, [chat?._id]);

  // Bulk delete: your own messages are deleted for everyone, anyone else's
  // are hidden for you — the server says which is which, and only those leave
  // the screen, so nothing reappears on reload.
  const bulkDeleteMessages = useCallback(async (messageIds) => {
    try {
      const res = await apiClient.delete("/chat/message/bulk-delete", {
        data: {
          chatId: chat?._id,
          messageIds,
        },
      });
      if (res.data.success) {
        const { deletedIds = [], hiddenIds = [] } = res.data.data || {};
        const removed = new Set([...deletedIds, ...hiddenIds].map(String));
        setMessages((prev) => prev.filter((m) => !removed.has(m._id?.toString())));
        // Server broadcasts "messages_bulk_deleted" to the chat room.
        toast.success(`${removed.size} message${removed.size === 1 ? "" : "s"} deleted`);
      }
    } catch {
      toast.error("Failed to delete messages");
    }
  }, [chat?._id]);

  // "Delete for me" on someone else's message: persisted, so it stays gone.
  const hideMessageForMe = useCallback(async (messageId) => {
    let removed = null;
    setMessages((prev) => {
      removed = prev.find((m) => m._id === messageId) || null;
      return prev.filter((m) => m._id !== messageId);
    });
    try {
      await apiClient.post("/chat/message/hide", { chatId: chat?._id, messageIds: [messageId] });
      toast.success("Message deleted for you");
    } catch {
      if (removed) setMessages((prev) => upsertMessage(prev, removed).sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      ));
      toast.error("Failed to delete message");
    }
  }, [chat?._id]);

  return {
    messages,
    setMessages,
    loadingInitial,
    initialFetchDone,
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
    hideMessageForMe,
  };
};
