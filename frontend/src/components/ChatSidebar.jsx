import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "../api/apiClient";
import { toast } from "sonner";
import { formatChatListTime } from "../utlis/chatDateUtils";
import CreateGroupModal from "./CreateGroupModal";
import defaultAvatar from "../assets/default-avatar.webp";
import defaultGroupAvatar from "../assets/default-group.svg";
import { optimizeAvatar } from "../utlis/cloudinary";

const ChatSidebar = ({
  chats = [],
  activeChat,
  onSelectChat,
  onOpenCreateGroup,
  currentUser,
  onlineUsers = [],
  typingMap = {},
  unreadCounts = {},
  onMarkAsUnread,
  onMarkAsRead,
  onDeleteChat,
  onCloseChat,
  onToggleInfo,
  isMobileChatOpen = false,
  onMutedChatIdsChange,
  onBlockedUserIdsChange,
  onArchivedChatIdsChange,
  onGroupCreated,
  hasMoreChats = false,
  isLoadingMoreChats = false,
  onLoadMoreChats,
  onPrefetchChat,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  const pinnedStorageKey = `linklet_pinned_chats_${currentUser?._id}`;
  const mutedStorageKey = `linklet_muted_chats_${currentUser?._id}`;
  const archivedStorageKey = `linklet_archived_chats_${currentUser?._id}`;
  const blockedStorageKey = `linklet_blocked_users_${currentUser?._id}`;

  // Pin/mute/archive are server-persisted per-user chat settings (see backend
  // chat.service.js setChatPinned/Muted/Archived) and arrive merged onto each
  // chat in the `chats` prop. localStorage is kept only as an instant-paint
  // cache (same pattern as blockedUserIds below) and — for mute specifically —
  // as the channel Layout.jsx's global toast listener reads, since it mounts
  // outside this component and never sees the `chats` prop.
  const deriveIdsWithFlag = (flag) =>
    (chats || []).filter((c) => c?.[flag]).map((c) => c._id);

  const [pinnedChatIds, setPinnedChatIds] = useState(() => {
    const fromChats = deriveIdsWithFlag("pinned");
    if (fromChats.length > 0) return fromChats;
    try { const s = localStorage.getItem(pinnedStorageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [mutedChatIds, setMutedChatIds] = useState(() => {
    const fromChats = deriveIdsWithFlag("muted");
    if (fromChats.length > 0) return fromChats;
    try { const s = localStorage.getItem(mutedStorageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [archivedChatIds, setArchivedChatIds] = useState(() => {
    const fromChats = deriveIdsWithFlag("archived");
    if (fromChats.length > 0) return fromChats;
    try { const s = localStorage.getItem(archivedStorageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // One-time resync once the server-fetched `chats` prop first lands (it starts
  // as [] or a localStorage placeholder, then gets replaced by the real fetch).
  // Deliberately NOT re-run on every later `chats` change — that array's
  // reference changes on every new message (lastMessage bump), which would
  // otherwise stomp an optimistic pin/mute/archive toggle with the pre-toggle
  // flag still sitting in the (not yet refetched) chats prop.
  const hasHydratedSettingsRef = useRef(false);
  useEffect(() => {
    if (hasHydratedSettingsRef.current || !Array.isArray(chats) || chats.length === 0) return;
    hasHydratedSettingsRef.current = true;
    setPinnedChatIds(deriveIdsWithFlag("pinned"));
    setMutedChatIds(deriveIdsWithFlag("muted"));
    setArchivedChatIds(deriveIdsWithFlag("archived"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats]);
  // Blocking is enforced server-side (see backend chat.service.js), so the list of
  // who this user has blocked is sourced from their own profile (currentUser),
  // never purely from localStorage. localStorage is kept only as an instant-paint
  // cache so the UI doesn't flash "unblocked" for a split second on reload.
  const [blockedUserIds, setBlockedUserIds] = useState(() => {
    if (Array.isArray(currentUser?.blockedUsers)) {
      return currentUser.blockedUsers.map((id) => (id._id || id)?.toString());
    }
    try { const s = localStorage.getItem(blockedStorageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  useEffect(() => {
    if (Array.isArray(currentUser?.blockedUsers)) {
      setBlockedUserIds(currentUser.blockedUsers.map((id) => (id._id || id)?.toString()));
    }
  }, [currentUser?.blockedUsers]);

  useEffect(() => {
    if (onMutedChatIdsChange) onMutedChatIdsChange(mutedChatIds);
  }, [mutedChatIds, onMutedChatIdsChange]);

  useEffect(() => {
    if (onBlockedUserIdsChange) onBlockedUserIdsChange(blockedUserIds);
  }, [blockedUserIds, onBlockedUserIdsChange]);

  useEffect(() => {
    if (onArchivedChatIdsChange) onArchivedChatIdsChange(archivedChatIds);
  }, [archivedChatIds, onArchivedChatIdsChange]);

  const [menuChat, setMenuChat] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuChat) return;

    const handleOutside = (e) => {
      // If clicking any chat chevron toggle button, let handleOpenContextMenu handle toggle
      if (e.target && e.target.closest && e.target.closest(".chat-item-chevron-btn")) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuChat(null);
      }
    };
    const handleScroll = () => {
      setMenuChat(null);
    };

    // Use capture phase so any click anywhere immediately closes the dropdown
    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("touchstart", handleOutside, true);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("touchstart", handleOutside, true);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [menuChat]);

  const searchTimeoutRef = useRef(null);
  const searchAbortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (searchAbortControllerRef.current) searchAbortControllerRef.current.abort();
    };
  }, []);

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchAbortControllerRef.current) searchAbortControllerRef.current.abort();

    if (query.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        searchAbortControllerRef.current = new AbortController();
        try {
          const res = await apiClient.get(`/chat/search?query=${encodeURIComponent(query.trim())}`, {
            signal: searchAbortControllerRef.current.signal,
          });
          if (res.data.success) setUserSearchResults(res.data.data);
        } catch (err) {
          if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
            // ignore aborted searches
          }
        }
      }, 300);
    } else {
      setUserSearchResults([]);
    }
  };

  const startDirectChat = async (targetUserId) => {
    try {
      const res = await apiClient.post("/chat", { userId: targetUserId });
      if (res.data.success) {
        onSelectChat(res.data.data);
        setSearchQuery("");
        setUserSearchResults([]);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to start chat");
    }
  };

  const getChatDisplayName = (chat) => {
    if (chat.isGroup) return chat.chatName;
    const other = chat.participants?.find(
      (p) => (p._id || p)?.toString() !== currentUser?._id?.toString()
    );
    return other ? (other.fullName || other.username) : "Direct Message";
  };

  const getChatDisplayAvatar = (chat) => {
    if (chat.isGroup) return chat.groupImage || defaultGroupAvatar;
    const other = chat.participants?.find(
      (p) => (p._id || p)?.toString() !== currentUser?._id?.toString()
    );
    return other?.avatar || defaultAvatar;
  };

  const getOtherUserId = (chat) => {
    if (chat.isGroup) return null;
    const other = chat.participants?.find(
      (p) => (p._id || p)?.toString() !== currentUser?._id?.toString()
    );
    return (other?._id || other)?.toString() || null;
  };

  const isUserOnline = (chat) => {
    if (chat.isGroup) return false;
    const other = chat.participants?.find(
      (p) => (p._id || p)?.toString() !== currentUser?._id?.toString()
    );
    return other
      ? onlineUsers.some((id) => id.toString() === (other._id || other)?.toString())
      : false;
  };

  const isChatBlocked = useCallback((chat) => {
    if (chat.isGroup) return false;
    const otherId = getOtherUserId(chat);
    return otherId ? blockedUserIds.includes(otherId) : false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockedUserIds]);

  const togglePinChat = async (chatId, e) => {
    e?.stopPropagation();
    setMenuChat(null);
    const wasPinned = pinnedChatIds.includes(chatId);
    const nextPinned = !wasPinned;

    setPinnedChatIds((prev) => {
      const next = nextPinned ? [chatId, ...prev] : prev.filter((id) => id !== chatId);
      try { localStorage.setItem(pinnedStorageKey, JSON.stringify(next)); } catch {}
      return next;
    });

    try {
      if (nextPinned) {
        await apiClient.put("/chat/chat-settings/pin", { chatId });
      } else {
        await apiClient.delete("/chat/chat-settings/pin", { data: { chatId } });
      }
      toast.info(nextPinned ? "Chat pinned" : "Chat unpinned");
    } catch (error) {
      // Roll back the optimistic toggle — most commonly hitting the server's
      // MAX_PINNED_CHATS cap, which only the request can tell us about.
      setPinnedChatIds((prev) => {
        const rolledBack = wasPinned ? [chatId, ...prev] : prev.filter((id) => id !== chatId);
        try { localStorage.setItem(pinnedStorageKey, JSON.stringify(rolledBack)); } catch {}
        return rolledBack;
      });
      toast.error(error.response?.data?.message || "Failed to update pinned status");
    }
  };

  const toggleMuteChat = async (chatId, e) => {
    e?.stopPropagation();
    setMenuChat(null);
    const wasMuted = mutedChatIds.includes(chatId);
    const nextMuted = !wasMuted;

    setMutedChatIds((prev) => {
      const next = nextMuted ? [...prev, chatId] : prev.filter((id) => id !== chatId);
      try { localStorage.setItem(mutedStorageKey, JSON.stringify(next)); } catch {}
      return next;
    });

    try {
      await apiClient.put("/chat/chat-settings/mute", { chatId, muted: nextMuted });
      toast.info(nextMuted ? "Notifications muted" : "Notifications unmuted");
    } catch (error) {
      setMutedChatIds((prev) => {
        const rolledBack = wasMuted ? [...prev, chatId] : prev.filter((id) => id !== chatId);
        try { localStorage.setItem(mutedStorageKey, JSON.stringify(rolledBack)); } catch {}
        return rolledBack;
      });
      toast.error(error.response?.data?.message || "Failed to update mute status");
    }
  };

  const toggleArchiveChat = async (chatId, e) => {
    e?.stopPropagation();
    setMenuChat(null);
    const wasArchived = archivedChatIds.includes(chatId);
    const nextArchived = !wasArchived;

    setArchivedChatIds((prev) => {
      const next = nextArchived ? [...prev, chatId] : prev.filter((id) => id !== chatId);
      try { localStorage.setItem(archivedStorageKey, JSON.stringify(next)); } catch {}
      return next;
    });

    try {
      await apiClient.put("/chat/chat-settings/archive", { chatId, archived: nextArchived });
      toast.info(nextArchived ? "Chat archived" : "Chat unarchived");
    } catch (error) {
      setArchivedChatIds((prev) => {
        const rolledBack = wasArchived ? [...prev, chatId] : prev.filter((id) => id !== chatId);
        try { localStorage.setItem(archivedStorageKey, JSON.stringify(rolledBack)); } catch {}
        return rolledBack;
      });
      toast.error(error.response?.data?.message || "Failed to update archive status");
    }
  };

  const toggleBlockUser = async (chat, e) => {
    e?.stopPropagation();
    const otherId = getOtherUserId(chat);
    if (!otherId) return;
    setMenuChat(null);
    try {
      const res = await apiClient.post(`/profile/block/${otherId}`);
      if (res.data?.success) {
        const nowBlocked = res.data.isBlocked;
        setBlockedUserIds((prev) => {
          const next = nowBlocked
            ? [...new Set([...prev, otherId])]
            : prev.filter((id) => id !== otherId);
          try { localStorage.setItem(blockedStorageKey, JSON.stringify(next)); } catch {}
          return next;
        });
        toast.info(nowBlocked ? "User blocked" : "User unblocked");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update block status");
    }
  };

  const handleDeleteChat = async (chat) => {
    setMenuChat(null);
    try {
      await apiClient.delete(`/chat/${chat._id}`);
      if (onDeleteChat) onDeleteChat(chat._id);
      toast.info(chat.isGroup ? "You left the group" : "Chat deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete chat");
    }
  };

  const handleOpenContextMenu = (chat, e) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Re-clicking the dropdown button closes the dropdown
    if (menuChat && menuChat._id === chat._id) {
      setMenuChat(null);
      return;
    }

    const targetEl = e.currentTarget || e.target;
    const rect = targetEl.getBoundingClientRect();

    // Exactly where we clicked: prefer event coordinates, fallback to target element
    const clickX = e.clientX && e.clientX > 0 ? e.clientX : rect.left;
    const clickY = e.clientY && e.clientY > 0 ? e.clientY : rect.bottom;

    const estimatedMenuHeight = 310;
    const menuWidth = 200;

    // Horizontal positioning: align left to clickX, clamped inside screen
    let left = Math.round(clickX);
    if (left + menuWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - menuWidth - 10);
    }

    // 2. Vertical positioning:
    // If sufficient space below -> top-left corner right where we clicked
    // Else -> bottom-left corner right where we clicked
    const spaceBelow = window.innerHeight - clickY;
    let top, bottom;

    if (spaceBelow >= estimatedMenuHeight) {
      top = Math.max(10, Math.round(clickY));
      bottom = undefined;
    } else {
      bottom = Math.max(10, Math.round(window.innerHeight - clickY));
      top = undefined;
    }

    setMenuPosition({ top, bottom, left, right: undefined });
    setMenuChat(chat);
  };

  const renderMessagePreview = (chat) => {
    const isTyping = typingMap[chat._id];
    if (isTyping) {
      return (
        <span className="text-emerald-400 font-medium italic flex items-center gap-1 animate-pulse text-xs">
          typing...
        </span>
      );
    }
    if (!chat.lastMessage) return <span className="text-xs text-gray-500">No messages yet</span>;
    const lastMsg = chat.lastMessage;
    const isSentByMe = (lastMsg.sender?._id || lastMsg.sender)?.toString() === currentUser?._id?.toString();
    let mediaLabel = "";
    if (lastMsg.mediaType === "audio") mediaLabel = "🎤 Voice note";
    else if (lastMsg.mediaType === "image") mediaLabel = "📷 Photo";
    else if (lastMsg.mediaType === "video") mediaLabel = "🎥 Video";
    else if (lastMsg.mediaType === "document") mediaLabel = "📄 Document";
    const content = lastMsg.content || mediaLabel;
    const isLastMsgRead = Boolean(
      lastMsg.isRead ||
      lastMsg.status === "read" ||
      lastMsg.status === "seen" ||
      (lastMsg.readBy && lastMsg.readBy.length > 1)
    );

    // Check if recipient is online for double grey delivered ticks in sidebar
    let isRecipientOnline = false;
    if (chat && onlineUsers && onlineUsers.length > 0) {
      if (!chat.isGroup && Array.isArray(chat.participants)) {
        const recipient = chat.participants.find(
          (p) => (p._id || p)?.toString() !== currentUser?._id?.toString()
        );
        const recipientId = (recipient?._id || recipient)?.toString();
        isRecipientOnline = Boolean(recipientId && onlineUsers.includes(recipientId));
      } else if (chat.isGroup && Array.isArray(chat.participants)) {
        isRecipientOnline = chat.participants.some((p) => {
          const pid = (p._id || p)?.toString();
          return pid && pid !== currentUser?._id?.toString() && onlineUsers.includes(pid);
        });
      }
    }

    const isDelivered = Boolean(
      isLastMsgRead ||
      lastMsg.status === "delivered" ||
      lastMsg.isDelivered ||
      isRecipientOnline
    );

    const senderPrefix = chat.isGroup && !isSentByMe && lastMsg.sender
      ? `${lastMsg.sender.fullName || lastMsg.sender.username}: `
      : isSentByMe ? "You: " : "";

    const tickClass = isLastMsgRead ? "tick-read" : isDelivered ? "sidebar-tick-delivered" : "sidebar-tick-sent";
    const tickIcon = isLastMsgRead || isDelivered ? "done_all" : "done";
    const tickTitle = isLastMsgRead ? "Read" : isDelivered ? "Delivered" : "Sent";

    return (
      <span className="flex items-center gap-0.5 truncate text-xs text-gray-400">
        {isSentByMe && (
          <span
            className={`material-icons mr-1 ${tickClass}`}
            title={tickTitle}
          >
            {tickIcon}
          </span>
        )}
        <span className="truncate">{senderPrefix}{content}</span>
      </span>
    );
  };

  const getChatUnreadCount = (chat) => {
    if (!chat) return 0;
    return unreadCounts[chat._id] || 0;
  };

  const totalUnreadChatsCount = chats.filter((c) => getChatUnreadCount(c) > 0 && !archivedChatIds.includes(c._id)).length;
  const totalGroupsCount = chats.filter((c) => c.isGroup && !archivedChatIds.includes(c._id)).length;
  const totalArchivedCount = archivedChatIds.length;

  let filteredChats = chats.filter((chat) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = getChatDisplayName(chat).toLowerCase();
      const content = (chat.lastMessage?.content || "").toLowerCase();
      if (!name.includes(q) && !content.includes(q)) return false;
    }
    const isArchived = archivedChatIds.includes(chat._id);
    if (activeFilter === "archived") return isArchived;
    if (isArchived) return false;
    if (activeFilter === "unread") return getChatUnreadCount(chat) > 0;
    if (activeFilter === "groups") return chat.isGroup;
    return true;
  });

  filteredChats.sort((a, b) => {
    const aPinned = pinnedChatIds.includes(a._id);
    const bPinned = pinnedChatIds.includes(b._id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return new Date(b.lastMessage?.createdAt || b.updatedAt || 0) - new Date(a.lastMessage?.createdAt || a.updatedAt || 0);
  });

  return (
    <div className={`chat-sidebar ${isMobileChatOpen ? "mobile-hidden !hidden md:!flex" : "flex"}`}>
      {/* Header */}
      <div className="chat-sidebar-header">
        <h2 className="chat-sidebar-title">
          Chats
          <span className="sr-only">Messages</span>
        </h2>
        <div className="chat-sidebar-actions relative">
          <button
            type="button"
            onClick={() => {
              setIsCreateGroupOpen((prev) => !prev);
              if (onOpenCreateGroup) onOpenCreateGroup();
            }}
            className={`chat-icon-btn ${isCreateGroupOpen ? "active" : ""}`}
            title="New group"
            aria-label="New group"
          >
            <span className="material-icons">group_add</span>
          </button>
          <CreateGroupModal
            isOpen={isCreateGroupOpen}
            onClose={() => setIsCreateGroupOpen(false)}
            onGroupCreated={(group) => {
              setIsCreateGroupOpen(false);
              if (onGroupCreated) onGroupCreated(group);
            }}
          />
        </div>
      </div>

      {/* Combined Search */}
      <div className="chat-search-box">
        <div className="chat-input-wrapper">
          <span className="chat-search-icon"><span className="material-icons text-lg">search</span></span>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={handleSearch}
            className="chat-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setUserSearchResults([]); }}
              className="absolute right-3 text-gray-400 hover:text-fg"
            >
              <span className="material-icons text-base">close</span>
            </button>
          )}
        </div>
        {userSearchResults.length > 0 && (
          <div className="chat-user-search-results">
            {userSearchResults.map((user) => (
              <div key={user._id} onClick={() => startDirectChat(user._id)} className="chat-user-result-item">
                <img loading="lazy" decoding="async" src={optimizeAvatar(user.avatar, 48) || defaultAvatar} alt={user.username} className="w-9 h-9 rounded-full border border-violet-500/30 object-cover" />
                <div>
                  <div className="text-sm font-semibold text-emerald-300">{user.username}</div>
                  <div className="text-xs text-gray-400">{user.fullName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Pills */}
      <div className="chat-filter-pills">
        {[
          { id: "all", label: "All" },
          { id: "unread", label: totalUnreadChatsCount > 0 ? `Unread ${totalUnreadChatsCount}` : "Unread" },
          { id: "groups", label: totalGroupsCount > 0 ? `Groups ${totalGroupsCount}` : "Groups" },
          { id: "archived", label: totalArchivedCount > 0 ? `Archived ${totalArchivedCount}` : "Archived" },
        ].map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setActiveFilter(pill.id)}
            className={`chat-filter-pill ${activeFilter === pill.id ? "active" : ""}`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Chat List */}
      <div
        className="chat-list"
        onScroll={(e) => {
          if (!hasMoreChats || isLoadingMoreChats || !onLoadMoreChats) return;
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
            onLoadMoreChats();
          }
        }}
      >
        {filteredChats.length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-sm">
            {activeFilter === "archived"
              ? "No archived chats."
              : activeFilter !== "all"
              ? `No ${activeFilter} chats found.`
              : "No conversations yet."}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = activeChat?._id === chat._id;
            const online = isUserOnline(chat);
            const unread = getChatUnreadCount(chat);
            const isPinned = pinnedChatIds.includes(chat._id);
            const isMuted = mutedChatIds.includes(chat._id);
            const isArchived = archivedChatIds.includes(chat._id);
            const isBlocked = isChatBlocked(chat);
            const timeDate = chat.lastMessage?.createdAt || chat.updatedAt;

            return (
              <div
                key={chat._id}
                role="button"
                tabIndex={0}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${getChatDisplayName(chat)}${unread > 0 ? `, ${unread} unread` : ""}`}
                onClick={() => onSelectChat(chat)}
                // Warm this chat's messages while the pointer is on its way to
                // clicking it, so opening it renders instantly.
                onMouseEnter={() => onPrefetchChat?.(chat._id)}
                onMouseLeave={() => onPrefetchChat?.(null)}
                onFocus={() => onPrefetchChat?.(chat._id)}
                onTouchStart={() => onPrefetchChat?.(chat._id, 0)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectChat(chat);
                  }
                }}
                onContextMenu={(e) => handleOpenContextMenu(chat, e)}
                className={`chat-item group ${isActive ? "active" : ""}`}
              >
                <div className="chat-avatar-container">
                  <img loading="lazy" decoding="async" src={getChatDisplayAvatar(chat)} alt={getChatDisplayName(chat)} className="chat-avatar" />
                  {online && !isBlocked && <div className="online-dot" />}
                </div>

                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name">
                      {getChatDisplayName(chat)}
                      {isBlocked && <span className="ml-1.5 text-[10px] text-red-400 font-normal">(blocked)</span>}
                    </span>
                    <div className="chat-item-meta">
                      {timeDate && (
                        <span className={`chat-item-time ${unread > 0 && !isMuted ? "unread-time" : ""}`}>
                          {formatChatListTime(timeDate)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleOpenContextMenu(chat, e)}
                        className={`chat-item-chevron-btn ${menuChat?._id === chat._id ? "open" : ""}`}
                        title="Chat options"
                      >
                        <span className="material-icons text-base">expand_more</span>
                      </button>
                    </div>
                  </div>

                  <div className="chat-item-bottom">
                    <span className="chat-item-preview">
                      {isBlocked ? (
                        <span className="text-red-400/70 text-xs italic">Messages blocked</span>
                      ) : (
                        renderMessagePreview(chat)
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      {isMuted && <span className="material-icons text-gray-500 text-[14px]">volume_off</span>}
                      {isPinned && <span className="material-icons chat-pinned-icon">push_pin</span>}
                      {isArchived && <span className="material-icons text-gray-500 text-[14px]">archive</span>}
                      {unread > 0 && !isMuted && <span className="unread-badge">{unread > 99 ? "99+" : unread}</span>}
                      {unread > 0 && isMuted && (
                        <span className="unread-badge" style={{ background: "rgba(100,116,139,0.7)" }}>{unread > 99 ? "99+" : unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {isLoadingMoreChats && (
          <div className="text-center text-gray-500 py-3 text-xs">Loading more chats…</div>
        )}
      </div>

      {/* WhatsApp Context Menu Dropdown mounted directly on document.body */}
      {menuChat && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPosition.top !== undefined ? `${menuPosition.top}px` : "auto",
            bottom: menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : "auto",
            left: menuPosition.left !== undefined ? `${menuPosition.left}px` : "auto",
            right: "auto",
            zIndex: 99999,
          }}
          className="chat-item-menu"
          onClick={(e) => e.stopPropagation()}
        >
          {activeChat?._id === menuChat._id && (
            <button type="button" onClick={() => { if (onCloseChat) onCloseChat(menuChat._id); setMenuChat(null); }} className="chat-item-menu-btn">
              <span className="material-icons text-base">close</span> Close Chat
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const u = getChatUnreadCount(menuChat);
              if (u > 0) { if (onMarkAsRead) onMarkAsRead(menuChat._id); }
              else { if (onMarkAsUnread) onMarkAsUnread(menuChat._id); }
              setMenuChat(null);
            }}
            className="chat-item-menu-btn"
          >
            <span className="material-icons text-base">
              {getChatUnreadCount(menuChat) > 0 ? "done_all" : "mark_chat_unread"}
            </span>
            {getChatUnreadCount(menuChat) > 0 ? "Mark as read" : "Mark as unread"}
          </button>
          <button type="button" onClick={(e) => togglePinChat(menuChat._id, e)} className="chat-item-menu-btn">
            <span className="material-icons text-base">push_pin</span>
            {pinnedChatIds.includes(menuChat._id) ? "Unpin" : "Pin"}
          </button>
          <button type="button" onClick={(e) => toggleMuteChat(menuChat._id, e)} className="chat-item-menu-btn">
            <span className="material-icons text-base">{mutedChatIds.includes(menuChat._id) ? "volume_up" : "volume_off"}</span>
            {mutedChatIds.includes(menuChat._id) ? "Unmute" : "Mute"}
          </button>
          <button type="button" onClick={(e) => toggleArchiveChat(menuChat._id, e)} className="chat-item-menu-btn">
            <span className="material-icons text-base">{archivedChatIds.includes(menuChat._id) ? "unarchive" : "archive"}</span>
            {archivedChatIds.includes(menuChat._id) ? "Unarchive" : "Archive"}
          </button>
          {!menuChat.isGroup && (
            <button
              type="button"
              onClick={(e) => toggleBlockUser(menuChat, e)}
              className={`chat-item-menu-btn ${isChatBlocked(menuChat) ? "" : "text-orange-400"}`}
            >
              <span className={`material-icons text-base ${isChatBlocked(menuChat) ? "" : "text-orange-400"}`}>
                {isChatBlocked(menuChat) ? "lock_open" : "block"}
              </span>
              {isChatBlocked(menuChat) ? "Unblock" : "Block"}
            </button>
          )}
          <div className="chat-item-menu-divider" />
          <button
            type="button"
            onClick={() => { onSelectChat(menuChat); if (onToggleInfo) onToggleInfo(); setMenuChat(null); }}
            className="chat-item-menu-btn"
          >
            <span className="material-icons text-base">info</span>
            {menuChat.isGroup ? "Group info" : "Contact info"}
          </button>
          <button
            type="button"
            onClick={() => handleDeleteChat(menuChat)}
            className="chat-item-menu-btn danger"
          >
            <span className="material-icons text-base">delete</span>
            {menuChat.isGroup ? "Leave group" : "Delete chat"}
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ChatSidebar;
