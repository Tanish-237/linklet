import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { toast } from "react-toastify";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";
import ChatInfoPanel from "../components/ChatInfoPanel";
import linkletLogo from "../assets/linklet-logo.png";
import "./ChatPage.css";

const ChatPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const socket = useSocket();

  const handleClearHighlightMessage = () => {
    if (searchParams.get("messageId")) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("messageId");
      setSearchParams(newParams, { replace: true });
    }
  };

  const userChatsCacheKey = `linklet_cached_chats_${user?._id}`;
  const blockedStorageKey = `linklet_blocked_users_${user?._id}`;
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
        } catch (e) {
          // safe fallback
        }
        return res.data.data;
      }
      return [];
    },
    placeholderData: initialLocalChats,
    enabled: !!user?._id,
    staleTime: 5 * 60 * 1000,
  });

  const [chats, setChats] = useState(cachedChats);
  const [activeChat, setActiveChat] = useState(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastSeenMap, setLastSeenMap] = useState({}); // userId -> lastSeen Date/string
  const [typingMap, setTypingMap] = useState({}); // chatId -> username
  const [unreadCounts, setUnreadCounts] = useState({}); // chatId -> count

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
        if (!currentUserId || isSentByMe || !c.lastMessage || isReadByMe) {
          initialCounts[c._id] = 0;
        } else {
          initialCounts[c._id] = c.unreadCount || 1;
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
        if (found) {
          setActiveChat(found);
          initialCounts[found._id] = 0;
        }
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
        setActiveChat(target);
      }
    }
  }, [searchParams, chats, activeChat]);

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

    socket.on("user online status", ({ onlineUsers }) => {
      setOnlineUsers(onlineUsers || []);
    });

    socket.on("user_connected", ({ userId }) => {
      if (userId) {
        setOnlineUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      }
    });

    socket.on("user_disconnected", ({ userId, lastSeen }) => {
      if (userId) {
        setOnlineUsers((prev) => prev.filter((id) => id !== userId));
        if (lastSeen) {
          setLastSeenMap((prev) => ({ ...prev, [userId]: lastSeen }));
        }
      }
    });

    socket.on("typing", ({ chatId, username }) => {
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

    socket.on("stop typing", ({ chatId }) => {
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

    socket.on("message received", (newMessage) => {
      const msgChatId =
        typeof newMessage.chat === "object" ? newMessage.chat._id : newMessage.chat;

      // Increment unread count if not in the active chat
      if (activeChat?._id !== msgChatId) {
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
            const rawPrefs = localStorage.getItem("linklet_notif_prefs");
            const notifPrefs = rawPrefs ? JSON.parse(rawPrefs) : { chatAlerts: true };
            if (notifPrefs.chatAlerts !== false) {
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
                toastId: `chat_sender_${senderId}`,
                autoClose: 4000,
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
          fetchChats();
        }

        // Re-sort with most recent message at the top (WhatsApp style)
        return updated.sort(
          (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        );
      });
    });

    socket.on("group updated", (updatedChat) => {
      updateChats((prev) =>
        prev.map((c) => (c._id === updatedChat._id ? updatedChat : c))
      );
      if (activeChat?._id === updatedChat._id) {
        setActiveChat(updatedChat);
      }
    });

    return () => {
      socket.off("user online status");
      socket.off("user_connected");
      socket.off("user_disconnected");
      socket.off("typing");
      socket.off("stop typing");
      socket.off("message received");
      socket.off("group updated");
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
    };
  }, [socket, user, activeChat, fetchChats]);

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
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
    // Clear unread count for selected chat
    setUnreadCounts((prev) => ({ ...prev, [chat._id]: 0 }));

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

  // Auto-select chat from URL parameter (e.g. from Saved section)
  useEffect(() => {
    const urlChatId = searchParams.get("chatId");
    if (urlChatId && chats?.length > 0 && activeChat?._id !== urlChatId) {
      const found = chats.find((c) => c._id === urlChatId);
      if (found) {
        setActiveChat(found);
      }
    }
  }, [searchParams, chats, activeChat?._id]);

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <ChatSidebar
        chats={chats}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        onOpenCreateGroup={() => setIsGroupModalOpen(true)}
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
        />
      )}
    </div>
  );
};

export default ChatPage;
