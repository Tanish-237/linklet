import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { toast } from "sonner";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/chat/ChatWindow";
import ChatInfoPanel from "../components/ChatInfoPanel";
import linkletLogo from "../assets/linklet-logo.webp";
import { applyIncomingMessage, prefetchChatOnIntent } from "../components/chat/hooks/chatMessageCache";
import "./ChatPage.css";
import { chatAlertsEnabled } from "../utlis/notificationPrefs";

const ChatPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const socket = useSocket();

  const handleClearHighlightMessage = useCallback(() => {
    setSearchParams(
      (prev) => {
        if (!prev.get("messageId")) return prev;
        const next = new URLSearchParams(prev);
        next.delete("messageId");
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const userChatsCacheKey = `linklet_cached_chats_${user?._id}`;
  const typingTimeoutsRef = useRef({});
  const unreadNotifCountRef = useRef({});
  const mutedChatIdsRef = useRef([]);
  const archivedChatIdsRef = useRef([]);

  // Initialize muted and archived refs from localStorage
  useEffect(() => {
    if (!user?._id) return;
    try {
      const m = localStorage.getItem(`linklet_muted_chats_${user._id}`);
      if (m) mutedChatIdsRef.current = JSON.parse(m);
      const a = localStorage.getItem(`linklet_archived_chats_${user._id}`);
      if (a) archivedChatIdsRef.current = JSON.parse(a);
    } catch {}
  }, [user?._id]);

  const [blockedUserIds, setBlockedUserIds] = useState(() => {
    try {
      const s = localStorage.getItem(`linklet_blocked_users_${user?._id}`);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [manualUnreadIds, setManualUnreadIds] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage && user?._id) {
        const s = window.localStorage.getItem(`linklet_manual_unread_${user._id}`);
        return s ? JSON.parse(s) : [];
      }
    } catch {
      return [];
    }
    return [];
  });

  // Read chats from localStorage cache for instant 0ms mount
  const initialLocalChats = () => {
    try {
      if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
        const saved = window.localStorage.getItem(userChatsCacheKey);
        return saved ? JSON.parse(saved) : [];
      }
    } catch {
      return [];
    }
    return [];
  };

  // In-memory TanStack query with local storage initialData
  const {
    data: cachedChats = [],
    refetch: fetchChats,
  } = useQuery({
    queryKey: ["chats", user?._id],
    queryFn: async () => {
      const res = await apiClient.get("/chat");
      if (res.data.success) {
        try {
          if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
            window.localStorage.setItem(userChatsCacheKey, JSON.stringify(res.data.data));
          }
        } catch {
          // safe fallback
        }
        chatsHasMoreRef.current = Boolean(res.data.hasMore);
        chatsNextCursorRef.current = res.data.nextCursor || null;
        setHasMoreChats(chatsHasMoreRef.current);
        return res.data.data;
      }
      return [];
    },
    placeholderData: initialLocalChats,
    enabled: !!user?._id,
    staleTime: 5 * 60 * 1000,
  });

  const [chats, setChats] = useState(cachedChats);
  // Chat list pagination. Page 1 arrives via the `chats` query above; deeper
  // pages are fetched on demand as the sidebar scrolls and appended in place —
  // there's no reason to hold the user's entire chat history in memory just to
  // show the 30 most recent conversations.
  const [hasMoreChats, setHasMoreChats] = useState(false);
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);
  const chatsHasMoreRef = useRef(false);
  const chatsNextCursorRef = useRef(null);
  const [activeChat, setActiveChat] = useState(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastSeenMap, setLastSeenMap] = useState({}); // userId -> lastSeen Date/string
  const [typingMap, setTypingMap] = useState({}); // chatId -> username
  const [unreadCounts, setUnreadCounts] = useState({}); // chatId -> count
  // What a chat's unread state was at the moment it was opened, taken before
  // its badge is cleared. ChatWindow uses it to place the "N unread messages"
  // divider and open the chat there (or at the latest message if 0).
  const [openedUnread, setOpenedUnread] = useState(null); // { chatId, count, lastReadAt }
  const unreadCountsRef = useRef(unreadCounts);
  useEffect(() => {
    unreadCountsRef.current = unreadCounts;
  }, [unreadCounts]);

  const openChat = useCallback((chat) => {
    if (!chat) return;
    setOpenedUnread({
      chatId: chat._id,
      count: unreadCountsRef.current[chat._id] ?? chat.unreadCount ?? 0,
      lastReadAt: chat.lastReadAt || null,
    });
    setActiveChat(chat);
    setUnreadCounts((prev) => (prev[chat._id] ? { ...prev, [chat._id]: 0 } : prev));
  }, []);

  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const fetchChatsRef = useRef(fetchChats);
  useEffect(() => {
    fetchChatsRef.current = fetchChats;
  }, [fetchChats]);

  useEffect(() => {
    if (cachedChats && cachedChats.length > 0) {
      setChats(cachedChats);

      // Initialize unread counts and extract participant lastSeen
      const initialCounts = {};
      const initialLastSeen = {};
      const currentUserId = (user?._id || user?.id)?.toString();

      cachedChats.forEach((c) => {
        if (manualUnreadIds.includes(c._id)) {
          initialCounts[c._id] = unreadCounts[c._id] || 1;
          return;
        }

        const senderId = (c.lastMessage?.sender?._id || c.lastMessage?.sender)?.toString();
        const isSentByMe = Boolean(currentUserId && senderId && senderId === currentUserId);
        const isReadByMe = Boolean(
          currentUserId &&
          c.lastMessage?.readBy?.some(
            (u) => (u._id || u)?.toString() === currentUserId
          )
        );

        // Never mark chat as unread if:
        // - Auth user is not loaded yet
        // - Current user sent the last message
        // - Chat has no last message
        // - Current user has already read the last message
        if (typeof c.unreadCount === "number") {
          // Server-computed from the user's read cursor
          initialCounts[c._id] = c.unreadCount;
        } else if (!currentUserId || isSentByMe || !c.lastMessage || isReadByMe) {
          initialCounts[c._id] = 0;
        } else {
          initialCounts[c._id] = 1;
        }

        if (Array.isArray(c.participants)) {
          c.participants.forEach((p) => {
            const pid = (p._id || p)?.toString();
            if (pid && p.lastSeen) {
              initialLastSeen[pid] = p.lastSeen;
            }
          });
        }
      });

      const targetChatId = searchParams.get("chatId");
      if (targetChatId) {
        const found = cachedChats.find((c) => c._id === targetChatId);
        if (found && activeChatRef.current?._id !== found._id) {
          unreadCountsRef.current = { ...unreadCountsRef.current, [found._id]: initialCounts[found._id] };
          openChat(found);
        }
        if (found) initialCounts[found._id] = 0;
      } else if (activeChat?._id) {
        initialCounts[activeChat._id] = 0;
      }

      setUnreadCounts((prev) => ({ ...prev, ...initialCounts }));
      setLastSeenMap((prev) => ({ ...initialLastSeen, ...prev }));
    }
  }, [cachedChats, user?._id, searchParams]);

  // Handle URL query param navigation (e.g. from Saved section or notifications)
  useEffect(() => {
    const targetChatId = searchParams.get("chatId");
    if (targetChatId && chats.length > 0) {
      const target = chats.find((c) => c._id === targetChatId);
      if (target && (!activeChat || activeChat._id !== targetChatId)) {
        openChat(target);
      }
    }
  }, [searchParams, chats, activeChat, openChat]);

  const updateChats = (updater) => {
    setChats((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      queryClient.setQueryData(["chats", user?._id], next);
      try {
        if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
          window.localStorage.setItem(userChatsCacheKey, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  };

  // Setup Socket connection & status listeners
  useEffect(() => {
    if (!socket || !user) return;

    socket.emit("setup", user);

    // Registered by reference so cleanup removes only THESE listeners —
    // socket.off("event") with no handler also strips every other
    // component's listener for that event (the chat window's, Layout's).
    const handlers = {};
    const on = (event, fn) => {
      handlers[event] = fn;
      socket.on(event, fn);
    };

    on("user online status", ({ onlineUsers }) => {
      setOnlineUsers(onlineUsers || []);
    });

    on("user_connected", ({ userId }) => {
      if (userId) {
        setOnlineUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      }
    });

    on("user_disconnected", ({ userId, lastSeen }) => {
      if (userId) {
        setOnlineUsers((prev) => prev.filter((id) => id !== userId));
        if (lastSeen) {
          setLastSeenMap((prev) => ({ ...prev, [userId]: lastSeen }));
        }
      }
    });

    on("typing", ({ chatId, username }) => {
      if (chatId && username) {
        setTypingMap((prev) => ({ ...prev, [chatId]: username }));

        // Auto-clear fallback after 4 seconds to prevent stuck typing indicator
        if (typingTimeoutsRef.current[chatId]) {
          clearTimeout(typingTimeoutsRef.current[chatId]);
        }
        typingTimeoutsRef.current[chatId] = setTimeout(() => {
          setTypingMap((prev) => {
            const next = { ...prev };
            delete next[chatId];
            return next;
          });
        }, 4000);
      }
    });

    on("stop typing", ({ chatId }) => {
      if (chatId) {
        if (typingTimeoutsRef.current[chatId]) {
          clearTimeout(typingTimeoutsRef.current[chatId]);
          delete typingTimeoutsRef.current[chatId];
        }
        setTypingMap((prev) => {
          const next = { ...prev };
          delete next[chatId];
          return next;
        });
      }
    });

    on("message received", (newMessage) => {
      const msgChatId =
        typeof newMessage.chat === "object" ? newMessage.chat._id : newMessage.chat;

      // Keep the in-memory message cache current for chats that aren't open,
      // so switching to them is instant and already up to date.
      applyIncomingMessage(newMessage);

      // Increment unread count if not in the active chat
      if (activeChatRef.current?._id !== msgChatId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msgChatId]: (prev[msgChatId] || 0) + 1,
        }));

        // Grouped Chat Notification — skip if chat is muted or archived
        try {
          if (
            mutedChatIdsRef.current.includes(msgChatId) ||
            archivedChatIdsRef.current.includes(msgChatId)
          ) {
            // Muted or Archived — no toast or alert
          } else {
            if (chatAlertsEnabled()) {
              const senderId = (newMessage.sender?._id || newMessage.sender)?.toString();
              const senderName =
                newMessage.sender?.fullName || newMessage.sender?.username || "New message";
              const previewText =
                newMessage.content ||
                (newMessage.mediaType ? `sent a ${newMessage.mediaType}` : "sent a message");

              unreadNotifCountRef.current[senderId] =
                (unreadNotifCountRef.current[senderId] || 0) + 1;
              const count = unreadNotifCountRef.current[senderId];

              const notifMsg =
                count > 1
                  ? `${senderName} (${count} new messages): ${previewText}`
                  : `${senderName}: ${previewText}`;

              toast.info(notifMsg, {
                id: `chat_sender_${senderId}`,
                duration: 4000,
              });
            }
          }
        } catch {}
      }

      updateChats((prevChats) => {
        let found = false;
        const updated = prevChats.map((chat) => {
          if (chat._id === msgChatId) {
            found = true;
            return {
              ...chat,
              lastMessage: newMessage,
              updatedAt: newMessage.createdAt || chat.updatedAt,
            };
          }
          return chat;
        });

        // If it's a new chat not yet in list, re-fetch chats
        if (!found) {
          fetchChatsRef.current();
        }

        // Re-sort with most recent message at the top (WhatsApp style)
        return updated.sort(
          (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        );
      });
    });

    on("group updated", (updatedChat) => {
      const stillAMember = (updatedChat.participants || []).some(
        (p) => (p._id || p)?.toString() === user?._id?.toString()
      );

      if (!stillAMember) {
        // We were removed (or left) — drop it from the sidebar entirely.
        updateChats((prev) => prev.filter((c) => c._id !== updatedChat._id));
        if (activeChatRef.current?._id === updatedChat._id) {
          setActiveChat(null);
        }
        return;
      }

      updateChats((prev) => {
        const exists = prev.some((c) => c._id === updatedChat._id);
        if (!exists) {
          // Newly added to a group we didn't have in the sidebar yet — refetch
          // to get it (and its lastMessage) rather than guessing its position.
          fetchChatsRef.current();
          return prev;
        }
        return prev.map((c) => (c._id === updatedChat._id ? updatedChat : c));
      });
      if (activeChatRef.current?._id === updatedChat._id) {
        setActiveChat(updatedChat);
      }
    });

    on("removed from group", ({ chatId }) => {
      if (!chatId) return;
      updateChats((prev) => prev.filter((c) => c._id !== chatId));
      if (activeChatRef.current?._id === chatId) {
        setActiveChat(null);
      }
    });

    // Read on another tab/device (or via this chat window's receipts):
    // clear the badge everywhere.
    on("chat read", ({ chatId, userId }) => {
      if (!chatId || userId?.toString() !== user?._id?.toString()) return;
      setUnreadCounts((prev) => (prev[chatId] ? { ...prev, [chatId]: 0 } : prev));
    });

    // The chat's newest message was deleted — show the new latest one.
    on("chat preview updated", ({ chatId, lastMessage }) => {
      if (!chatId) return;
      updateChats((prev) =>
        prev.map((c) => (c._id === chatId ? { ...c, lastMessage: lastMessage || null } : c))
      );
    });

    return () => {
      Object.entries(handlers).forEach(([event, fn]) => socket.off(event, fn));
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
    };
  }, [socket, user?._id]);

  const handleSelectChat = (chat) => {
    openChat(chat);
    // Clear manual unread status if marked
    setManualUnreadIds((prev) => {
      if (!prev.includes(chat._id)) return prev;
      const next = prev.filter((id) => id !== chat._id);
      try {
        if (typeof window !== "undefined" && window.localStorage && user?._id) {
          window.localStorage.setItem(`linklet_manual_unread_${user._id}`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });

    // Reset notification count for this sender
    const otherUser = chat.isGroup
      ? null
      : chat.participants?.find(
          (p) => (p._id || p)?.toString() !== user?._id?.toString()
        );
    const otherUserId = (otherUser?._id || otherUser)?.toString();
    if (otherUserId && unreadNotifCountRef.current[otherUserId]) {
      delete unreadNotifCountRef.current[otherUserId];
    }
  };

  const handleMarkAsUnread = (chatId) => {
    setManualUnreadIds((prev) => {
      const next = prev.includes(chatId) ? prev : [...prev, chatId];
      try {
        if (typeof window !== "undefined" && window.localStorage && user?._id) {
          window.localStorage.setItem(`linklet_manual_unread_${user._id}`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
    setUnreadCounts((prev) => ({ ...prev, [chatId]: 1 }));
  };

  const handleMarkAsRead = (chatId) => {
    setManualUnreadIds((prev) => {
      const next = prev.filter((id) => id !== chatId);
      try {
        if (typeof window !== "undefined" && window.localStorage && user?._id) {
          window.localStorage.setItem(`linklet_manual_unread_${user._id}`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
    setUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }));
  };

  const handleDeleteChat = (chatId) => {
    updateChats((prev) => prev.filter((c) => c._id !== chatId));
    if (activeChat?._id === chatId) {
      setActiveChat(null);
    }
  };

  const handleCloseChat = (chatId) => {
    if (activeChat?._id === chatId) {
      setActiveChat(null);
    }
  };

  const handleGroupCreated = (newGroup) => {
    updateChats((prev) => [newGroup, ...prev]);
    setActiveChat(newGroup);
  };

  const handleLoadMoreChats = async () => {
    if (!chatsHasMoreRef.current || !chatsNextCursorRef.current || isLoadingMoreChats) return;
    setIsLoadingMoreChats(true);
    try {
      const res = await apiClient.get("/chat", { params: { cursor: chatsNextCursorRef.current } });
      if (res.data.success) {
        const existingIds = new Set(chats.map((c) => c._id));
        const newChats = res.data.data.filter((c) => !existingIds.has(c._id));
        updateChats((prev) => [...prev, ...newChats]);
        chatsHasMoreRef.current = Boolean(res.data.hasMore);
        chatsNextCursorRef.current = res.data.nextCursor || null;
        setHasMoreChats(chatsHasMoreRef.current);
      }
    } catch {
      toast.error("Failed to load more chats");
    } finally {
      setIsLoadingMoreChats(false);
    }
  };

  const handlePinnedMessagesChange = useCallback((chatId, pinnedMessages) => {
    updateChats((prev) => prev.map((c) => (c._id === chatId ? { ...c, pinnedMessages } : c)));
    setActiveChat((prev) => (prev && prev._id === chatId ? { ...prev, pinnedMessages } : prev));
    // updateChats is recreated every render but only closes over stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Show in chat" from the details panel: same URL-driven jump the Saved
  // page and notifications use.
  const handleJumpToMessage = useCallback(
    (messageId) => {
      if (!activeChat?._id || !messageId) return;
      setSearchParams({ chatId: activeChat._id, messageId }, { replace: true });
      if (window.innerWidth < 1024) setShowInfoPanel(false);
    },
    [activeChat?._id, setSearchParams]
  );

  const handleUpdateChat = (updatedChat) => {
    updateChats((prev) =>
      prev.map((c) => (c._id === updatedChat._id ? updatedChat : c))
    );
    if (activeChat?._id === updatedChat._id) {
      setActiveChat(updatedChat);
    }
  };

  const otherParticipant = !activeChat?.isGroup && activeChat?.participants?.find(
    (p) => (p._id || p)?.toString() !== user?._id?.toString()
  );
  const otherParticipantId = otherParticipant ? (otherParticipant._id || otherParticipant)?.toString() : null;
  const isCurrentChatBlocked = Boolean(otherParticipantId && blockedUserIds.includes(otherParticipantId));

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <ChatSidebar
        chats={chats}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        currentUser={user}
        onlineUsers={onlineUsers}
        lastSeenMap={lastSeenMap}
        typingMap={typingMap}
        unreadCounts={unreadCounts}
        onMarkAsUnread={handleMarkAsUnread}
        onMarkAsRead={handleMarkAsRead}
        onDeleteChat={handleDeleteChat}
        onCloseChat={handleCloseChat}
        onToggleInfo={() => setShowInfoPanel(!showInfoPanel)}
        isMobileChatOpen={Boolean(activeChat)}
        onMutedChatIdsChange={(ids) => { mutedChatIdsRef.current = ids; }}
        onBlockedUserIdsChange={setBlockedUserIds}
        onArchivedChatIdsChange={(ids) => { archivedChatIdsRef.current = ids; }}
        onGroupCreated={handleGroupCreated}
        hasMoreChats={hasMoreChats}
        isLoadingMoreChats={isLoadingMoreChats}
        onLoadMoreChats={handleLoadMoreChats}
        onPrefetchChat={prefetchChatOnIntent}
      />

      {/* Main Window */}
      {activeChat ? (
        <ChatWindow
          key={activeChat._id}
          chat={activeChat}
          allChats={chats}
          currentUser={user}
          socket={socket}
          onlineUsers={onlineUsers}
          lastSeenMap={lastSeenMap}
          onToggleInfo={() => setShowInfoPanel(!showInfoPanel)}
          onBackToSidebar={() => setActiveChat(null)}
          isBlocked={isCurrentChatBlocked}
          highlightMessageId={searchParams.get("messageId")}
          onClearHighlight={handleClearHighlightMessage}
          unreadSnapshot={openedUnread?.chatId === activeChat._id ? openedUnread : null}
          onPinnedMessagesChange={handlePinnedMessagesChange}
        />
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 select-none text-center bg-gray-950/40">
          <div className="w-20 h-20 rounded-[28px] bg-violet-950/50 border border-violet-500/25 flex items-center justify-center mb-5 shadow-2xl shadow-violet-500/15 p-3.5 transition-transform duration-300 hover:scale-105">
            <img
              src={linkletLogo}
              alt="Linklet"
              className="w-full h-full object-cover rounded-2xl shadow-md"
            />
          </div>
          <h3 className="text-xl font-semibold text-gray-100 tracking-tight mb-2">Linklet Chats</h3>
          <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
            Search a person to start chatting
          </p>
        </div>
      )}

      {/* Slide-out Info Panel */}
      {showInfoPanel && activeChat && (
        <ChatInfoPanel
          chat={activeChat}
          currentUser={user}
          onClose={() => setShowInfoPanel(false)}
          onUpdateChat={handleUpdateChat}
          onJumpToMessage={handleJumpToMessage}
        />
      )}
    </div>
  );
};

export default ChatPage;
